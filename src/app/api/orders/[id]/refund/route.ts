import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';
import { logStaffAction } from '@/lib/utils/staff-actions-log';
import { notifyOwnerPush } from '@/lib/api/notify-owner-push';
import { returnStockForOrder } from '@/lib/utils/return-stock';

// POST /api/orders/:id/refund — { reason } + ترويسة x-staff-token
// الهوية تُستخرَج حصراً من توكن موقَّع (راجع resolveStaffIdentity) — لا يُثَق
// بأي staff_id من جسم الطلب (إصلاح ثغرة C1 بالمراجعة الأمنية).
// مالك/مدير: ينفّذ مباشرة. كاشير: يحتاج موافقة دائماً بدون أي سقف (لا استثناء).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  let body: { reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { reason } = body;
  if (!reason?.trim()) return NextResponse.json({ error: 'reason مطلوب للاسترجاع' }, { status: 400 });

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, restaurant_id, status, total_amount, pending_edit_id')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

  const identityRes = await resolveStaffIdentity(req, order.restaurant_id);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const staff = identityRes.identity;

  if (order.status === 'refunded' || order.status === 'voided') {
    return NextResponse.json({ error: 'الطلب ملغى/مسترجع بالفعل' }, { status: 409 });
  }

  const amount = Number(order.total_amount) || 0;

  // الكاشير: موافقة إلزامية دائماً بدون سقف. المالك/المدير فقط ينفّذ مباشرة.
  if (!staff.is_privileged) {
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('approval_requests')
      .insert({
        restaurant_id: staff.restaurant_id,
        requested_by_user_id: staff.user_id,
        request_type: 'refund',
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
      after_data: { request_type: 'refund', order_id: order.id, amount, reason },
    });

    await notifyOwnerPush(staff.restaurant_id, {
      title: 'طلب موافقة: استرجاع مبلغ',
      body: `${staff.display_name} يطلب استرجاع ${amount.toFixed(2)}`,
      url: '/admin/approvals',
      tag: 'approval-request',
    });

    return NextResponse.json({ pending: true, approval_id: approval.id }, { status: 202 });
  }

  const beforeStatus = order.status;
  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'refunded' })
    .eq('id', orderId)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await returnStockForOrder(staff.restaurant_id, orderId, 'استرجاع طلب');

  // تنظيف إضافي best-effort: تعديل زبون معلّق على طلب اُسترجع للتو يجب ألا يبقى
  // قابلاً للقبول لاحقاً (حراسة reviewEdit الوحيدة هي kitchen_ready_at IS NULL،
  // وطلب مسترجَع لا يزال يحقق هذا الشرط) — لا تُفشل الاسترجاع الأساسي (نجح فعلاً)
  // بسبب عطل بهذه الخطوة الثانوية، فقط سجّل الخطأ (نفس نمط returnStockForOrder أعلاه).
  if (order.pending_edit_id) {
    try {
      await supabaseAdmin.from('order_edits')
        .update({ status: 'rejected', rejected_at: new Date().toISOString() })
        .eq('id', order.pending_edit_id);
      await supabaseAdmin.from('orders')
        .update({ pending_edit_id: null })
        .eq('id', orderId);
    } catch (err) {
      console.error('تعذّر تنظيف pending_edit_id بعد استرجاع الطلب', orderId, err);
    }
  }

  await logStaffAction({
    restaurant_id: staff.restaurant_id,
    performed_by_auth_id: staff.user_id,
      performed_by_label: staff.display_name,
    action_type: 'order_refund',
    entity_type: 'order',
    entity_id: orderId,
    before_data: { status: beforeStatus },
    after_data: { status: 'refunded', reason: reason.trim(), amount },
  });

  return NextResponse.json({ refunded: true, order: updatedOrder });
}
