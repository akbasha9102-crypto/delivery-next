import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getStaffContext, isPrivilegedRole } from '@/lib/staff-auth';
import { logStaffAction } from '@/lib/staff-actions-log';
import { notifyOwnerPush } from '@/lib/notify-owner-push';

// POST /api/orders/:id/discount — { staff_id, discount_pct }
// مالك/مدير: نسبة حرة. كاشير ≤ max_discount_pct: مباشرة، وإلا: موافقة.
//
// ملاحظة مهمة للفريق: جدول orders لا يملك عمود discount_pct/subtotal منفصل
// (لم نُضِف أي عمود جديد على orders التزاماً بألا نلمس جدولاً موجوداً).
// لذلك الخصم يُطبَّق مباشرة على total_amount الحالي لحظة الطلب، والتفصيل
// الكامل (النسبة، القيمة قبل/بعد) يُحفظ فقط بـ staff_actions_log (before/after).
// الأثر العملي: تطبيق خصم ثانٍ على نفس الطلب لاحقاً سيُحتسب فوق القيمة
// المخصومة أصلاً (لا يوجد "سعر أصلي" محفوظ للرجوع إليه). إذا احتاج المنتج
// دعم خصومات متعددة/قابلة للتراجع بدقة مستقبلاً، يُنصح بإضافة عمود
// original_total_amount على orders بـ migration منفصلة لاحقاً.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  let body: { staff_id?: string; discount_pct?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { staff_id, discount_pct } = body;
  if (!staff_id) return NextResponse.json({ error: 'staff_id مطلوب' }, { status: 400 });

  const pct = Number(discount_pct);
  if (Number.isNaN(pct) || pct <= 0 || pct > 100) {
    return NextResponse.json({ error: 'discount_pct يجب أن يكون بين 0 و 100' }, { status: 400 });
  }

  const staff = await getStaffContext(staff_id);
  if (!staff) return NextResponse.json({ error: 'موظف غير صالح أو معطّل' }, { status: 403 });

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, restaurant_id, status, total_amount')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order || order.restaurant_id !== staff.restaurant_id) {
    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
  }
  if (order.status === 'voided' || order.status === 'refunded') {
    return NextResponse.json({ error: 'لا يمكن تطبيق خصم على طلب ملغى/مسترجع' }, { status: 409 });
  }

  const needsApproval = !isPrivilegedRole(staff.role) && pct > Number(staff.max_discount_pct);

  if (needsApproval) {
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('approval_requests')
      .insert({
        restaurant_id: staff.restaurant_id,
        requested_by: staff_id,
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
      staff_id,
      action_type: 'approval_requested',
      entity_type: 'approval_request',
      entity_id: approval.id,
      after_data: { request_type: 'discount_override', order_id: order.id, discount_pct: pct },
    });

    await notifyOwnerPush(staff.restaurant_id, {
      title: 'طلب موافقة: تجاوز حد الخصم',
      body: `${staff.display_name} يطلب خصم ${pct}% يتجاوز حده المسموح`,
      url: '/admin/approvals',
      tag: 'approval-request',
    });

    return NextResponse.json({ pending: true, approval_id: approval.id }, { status: 202 });
  }

  const originalTotal = Number(order.total_amount) || 0;
  const newTotal = Math.round(originalTotal * (1 - pct / 100) * 100) / 100;

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ total_amount: newTotal })
    .eq('id', orderId)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await logStaffAction({
    restaurant_id: staff.restaurant_id,
    staff_id,
    action_type: 'discount_applied',
    entity_type: 'order',
    entity_id: orderId,
    before_data: { total_amount: originalTotal },
    after_data: { total_amount: newTotal, discount_pct: pct },
  });

  return NextResponse.json({ applied: true, order: updatedOrder });
}
