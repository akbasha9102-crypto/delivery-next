import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';
import { logStaffAction } from '@/lib/utils/staff-actions-log';
import { notifyOwnerPush } from '@/lib/api/notify-owner-push';

// حد أعلى تراكمي للإلغاءات بنفس الوردية (مضروب في max_void_amount) — يمنع
// تفادي السقف الفردي بتقسيم الإلغاءات لعدة طلبات صغيرة (ثغرة H2 بالمراجعة
// الأمنية). قيمة قابلة للتعديل لاحقاً كإعداد بالمطعم.
const SHIFT_VOID_MULTIPLIER = 3;

// POST /api/orders/:id/void — { reason } + ترويسة x-staff-token
// الهوية (staff_id/role) تُستخرَج حصراً من توكن موقَّع (راجع resolveStaffIdentity)
// وليس من أي حقل بجسم الطلب — يمنع انتحال هوية موظف آخر (ثغرة C1 بالمراجعة الأمنية).
// مالك/مدير: ينفّذ مباشرة. كاشير ضمن max_void_amount (فردياً وتراكمياً بالوردية): ينفّذ مباشرة.
// كاشير فوق أي من الحدين: يُنشئ approval_requests (status='pending') ويرجع 202.
// "الإلغاء" = تغيير status فقط (لا حذف حقيقي أبداً) — راجع خطة RBAC قسم 5.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  let body: { reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { reason } = body;
  if (!reason?.trim()) return NextResponse.json({ error: 'reason مطلوب لإلغاء الطلب' }, { status: 400 });

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, restaurant_id, status, total_amount')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

  const identityRes = await resolveStaffIdentity(req, order.restaurant_id);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const staff = identityRes.identity;

  if (order.status === 'voided' || order.status === 'refunded') {
    return NextResponse.json({ error: 'الطلب ملغى/مسترجع بالفعل' }, { status: 409 });
  }

  const amount = Number(order.total_amount) || 0;

  let cumulativeVoided = 0;
  if (!staff.is_privileged) {
    const { data: openShift } = await supabaseAdmin
      .from('cashier_shifts')
      .select('opened_at')
      .eq('staff_user_id', staff.user_id)
      .eq('status', 'open')
      .maybeSingle();

    if (openShift) {
      const { data: priorVoids } = await supabaseAdmin
        .from('staff_actions_log')
        .select('after_data')
        .eq('performed_by_auth_id', staff.user_id)
        .eq('action_type', 'order_void')
        .gte('created_at', openShift.opened_at);

      cumulativeVoided = (priorVoids ?? []).reduce((sum, row) => {
        const after = row.after_data as { amount?: number } | null;
        return sum + (Number(after?.amount) || 0);
      }, 0);
    }
  }

  const needsApproval =
    !staff.is_privileged &&
    (amount > staff.max_void_amount || cumulativeVoided + amount > staff.max_void_amount * SHIFT_VOID_MULTIPLIER);

  if (needsApproval) {
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('approval_requests')
      .insert({
        restaurant_id: staff.restaurant_id,
        requested_by_user_id: staff.user_id,
        request_type: 'void_order',
        order_id: order.id,
        amount,
        reason: reason.trim(),
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
      after_data: { request_type: 'void_order', order_id: order.id, amount, reason },
    });

    await notifyOwnerPush(staff.restaurant_id, {
      title: 'طلب موافقة: إلغاء طلب',
      body: `${staff.display_name} يطلب إلغاء طلب بقيمة ${amount.toFixed(2)}`,
      url: '/admin/approvals',
      tag: 'approval-request',
    });

    return NextResponse.json({ pending: true, approval_id: approval.id }, { status: 202 });
  }

  const beforeStatus = order.status;
  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'voided' })
    .eq('id', orderId)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await logStaffAction({
    restaurant_id: staff.restaurant_id,
    performed_by_auth_id: staff.user_id,
    performed_by_label: staff.display_name,
    action_type: 'order_void',
    entity_type: 'order',
    entity_id: orderId,
    before_data: { status: beforeStatus },
    after_data: { status: 'voided', reason: reason.trim(), amount },
  });

  return NextResponse.json({ voided: true, order: updatedOrder });
}
