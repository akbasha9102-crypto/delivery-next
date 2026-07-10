import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';
import { logStaffAction } from '@/lib/utils/staff-actions-log';
import { notifyOwnerPush } from '@/lib/api/notify-owner-push';

// POST /api/orders/:id/discount — { discount_pct } + ترويسة x-staff-token
// الهوية تُستخرَج حصراً من توكن موقَّع (راجع resolveStaffIdentity) — لا يُثَق
// بأي staff_id من جسم الطلب (إصلاح ثغرة C1 بالمراجعة الأمنية).
// مالك/مدير: نسبة حرة. كاشير ≤ max_discount_pct: مباشرة، وإلا: موافقة.
//
// إصلاح ثغرة أمنية (H1): الفحص التراكمي يقارن الآن بالسعر الأصلي المحفوظ
// بـ orders.pre_discount_total (يُضبَط مرة واحدة فقط عند أول خصم)، وليس
// بآخر total_amount — يمنع تجاوز max_discount_pct فعلياً بتكرار خصومات
// صغيرة متتالية على نفس الطلب.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  let body: { discount_pct?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const pct = Number(body.discount_pct);
  if (Number.isNaN(pct) || pct <= 0 || pct > 100) {
    return NextResponse.json({ error: 'discount_pct يجب أن يكون بين 0 و 100' }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, restaurant_id, status, total_amount, pre_discount_total')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

  const identityRes = await resolveStaffIdentity(req, order.restaurant_id);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const staff = identityRes.identity;

  if (order.status === 'voided' || order.status === 'refunded') {
    return NextResponse.json({ error: 'لا يمكن تطبيق خصم على طلب ملغى/مسترجع' }, { status: 409 });
  }

  // السعر الأصلي الحقيقي: إن كان هذا أول خصم يُطبَّق (pre_discount_total لا يزال فارغاً)
  // نحفظه الآن من total_amount الحالي؛ وإلا نستخدم القيمة المحفوظة مسبقاً.
  const originalTotal = Number(order.pre_discount_total ?? order.total_amount) || 0;
  const currentTotal = Number(order.total_amount) || 0;
  const proposedTotal = Math.round(originalTotal * (1 - pct / 100) * 100) / 100;
  const cumulativePct = originalTotal > 0 ? ((originalTotal - proposedTotal) / originalTotal) * 100 : pct;

  const needsApproval = !staff.is_privileged && cumulativePct > staff.max_discount_pct;

  if (needsApproval) {
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('approval_requests')
      .insert({
        restaurant_id: staff.restaurant_id,
        requested_by_user_id: staff.user_id,
        request_type: 'discount_override',
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
      after_data: { request_type: 'discount_override', order_id: order.id, discount_pct: pct, cumulative_pct: cumulativePct },
    });

    await notifyOwnerPush(staff.restaurant_id, {
      title: 'طلب موافقة: تجاوز حد الخصم',
      body: `${staff.display_name} يطلب خصم تراكمي ${cumulativePct.toFixed(1)}% يتجاوز حده المسموح`,
      url: '/admin/approvals',
      tag: 'approval-request',
    });

    return NextResponse.json({ pending: true, approval_id: approval.id }, { status: 202 });
  }

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ total_amount: proposedTotal, pre_discount_total: originalTotal })
    .eq('id', orderId)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await logStaffAction({
    restaurant_id: staff.restaurant_id,
    performed_by_auth_id: staff.user_id,
    performed_by_label: staff.display_name,
    action_type: 'discount_applied',
    entity_type: 'order',
    entity_id: orderId,
    before_data: { total_amount: currentTotal },
    after_data: { total_amount: proposedTotal, discount_pct: pct, cumulative_pct: cumulativePct },
  });

  return NextResponse.json({ applied: true, order: updatedOrder });
}
