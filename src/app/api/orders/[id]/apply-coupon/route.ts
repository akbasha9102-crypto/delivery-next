import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';
import { logStaffAction } from '@/lib/utils/staff-actions-log';
import { notifyOwnerPush } from '@/lib/api/notify-owner-push';

// POST /api/orders/:id/apply-coupon — { coupon_code } + ترويسة Authorization: Bearer
// كوبون رجعي: يطبّق كوبون الخصم الحالي للمطعم (نفس كوبون /cart) على طلب
// موجود مسبقاً (POS/كاشير محلي فقط بهذه المرحلة). الهوية تُستخرَج حصراً من
// resolveStaffIdentity — لا يُوثَق بأي staff_id من جسم الطلب (نفس نمط discount/route.ts).
// مالك/مدير: يطبّق مباشرة. كاشير ≤ max_discount_pct: مباشرة، وإلا: موافقة.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  let body: { coupon_code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const submittedCode = (body.coupon_code || '').trim().toUpperCase();
  if (!submittedCode) return NextResponse.json({ error: 'coupon_code مطلوب' }, { status: 400 });

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, restaurant_id, status, total_amount, pre_discount_total, coupon_code')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

  const identityRes = await resolveStaffIdentity(req, order.restaurant_id);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const staff = identityRes.identity;

  if (order.status === 'voided' || order.status === 'refunded') {
    return NextResponse.json({ error: 'لا يمكن تطبيق كوبون على طلب ملغى/مسترجع' }, { status: 409 });
  }

  if (order.coupon_code) {
    return NextResponse.json({ error: 'تم تطبيق كوبون على هذا الطلب بالفعل' }, { status: 409 });
  }

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('restaurant_settings')
    .select('coupon_code, coupon_discount_pct, coupon_enabled, coupon_allow_retroactive')
    .eq('restaurant_id', order.restaurant_id)
    .maybeSingle();

  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });
  if (!settings || !settings.coupon_enabled || !settings.coupon_allow_retroactive) {
    return NextResponse.json({ error: 'الكوبون الرجعي غير مفعّل لهذا المطعم' }, { status: 400 });
  }

  const configuredCode = (settings.coupon_code || '').trim().toUpperCase();
  if (!configuredCode || configuredCode !== submittedCode) {
    return NextResponse.json({ error: 'كود الكوبون غير صحيح' }, { status: 400 });
  }

  const pct = Number(settings.coupon_discount_pct) || 0;
  if (pct <= 0) return NextResponse.json({ error: 'نسبة خصم الكوبون غير صالحة' }, { status: 400 });

  // السعر الأصلي الحقيقي: إن كان هذا أول خصم يُطبَّق (pre_discount_total لا يزال فارغاً)
  // نحفظه الآن من total_amount الحالي؛ وإلا نستخدم القيمة المحفوظة مسبقاً — نفس منطق discount/route.ts.
  const originalTotal = Number(order.pre_discount_total ?? order.total_amount) || 0;
  const currentTotal = Number(order.total_amount) || 0;
  const discountAmount = Math.round(originalTotal * (pct / 100) * 100) / 100;
  const newTotal = Math.round((originalTotal - discountAmount) * 100) / 100;

  const needsApproval = !staff.is_privileged && pct > staff.max_discount_pct;

  if (needsApproval) {
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('approval_requests')
      .insert({
        restaurant_id: staff.restaurant_id,
        requested_by_user_id: staff.user_id,
        request_type: 'coupon_override',
        order_id: order.id,
        amount: pct,
        status: 'pending',
      })
      .select('*')
      .single();

    if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 500 });

    await logStaffAction({
      restaurant_id: staff.restaurant_id,
      performed_by_auth_id: staff.user_id,
      performed_by_label: staff.display_name,
      action_type: 'approval_requested',
      entity_type: 'approval_request',
      entity_id: approval.id,
      after_data: { request_type: 'coupon_override', order_id: order.id, coupon_code: submittedCode, discount_pct: pct },
    });

    await notifyOwnerPush(staff.restaurant_id, {
      title: 'طلب موافقة: تطبيق كوبون رجعي',
      body: `${staff.display_name} يطلب تطبيق كوبون خصم ${pct}% يتجاوز حده المسموح`,
      url: '/admin/approvals',
      tag: 'approval-request',
    });

    return NextResponse.json({ pending: true, approval_id: approval.id }, { status: 202 });
  }

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      total_amount: newTotal,
      pre_discount_total: originalTotal,
      coupon_code: submittedCode,
      discount_amount: discountAmount,
    })
    .eq('id', orderId)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await logStaffAction({
    restaurant_id: staff.restaurant_id,
    performed_by_auth_id: staff.user_id,
    performed_by_label: staff.display_name,
    action_type: 'coupon_applied',
    entity_type: 'order',
    entity_id: orderId,
    before_data: { total_amount: currentTotal },
    after_data: { total_amount: newTotal, coupon_code: submittedCode, discount_pct: pct },
  });

  return NextResponse.json({ applied: true, order: updatedOrder });
}
