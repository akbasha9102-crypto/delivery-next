import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyOwnerRequest } from '@/lib/auth/staff-auth';
import { logStaffAction } from '@/lib/utils/staff-actions-log';

// POST /api/approvals/:id/resolve — { action: 'approve'|'reject' }
// مالك فقط (جلسة Supabase). عند approve: ينفّذ العملية المعلّقة فعلياً
// (void/refund/discount_override)، ويحدّث approval_requests.status —
// هذا التحديث يُبَث تلقائياً عبر Supabase Realtime الموجود فعلاً للعميل
// الآخر (لا حاجة لبناء آلية Realtime هنا، فقط ضمان أن الـ UPDATE يحصل فعلاً).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: approvalId } = await ctx.params;

  let body: { action?: 'approve' | 'reject' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { action } = body;
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "action يجب أن يكون 'approve' أو 'reject'" }, { status: 400 });
  }

  const { data: approval, error: approvalError } = await supabaseAdmin
    .from('approval_requests')
    .select('*')
    .eq('id', approvalId)
    .maybeSingle();

  if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 500 });
  if (!approval) return NextResponse.json({ error: 'طلب الموافقة غير موجود' }, { status: 404 });
  if (approval.status !== 'pending') {
    return NextResponse.json({ error: 'طلب الموافقة تمت معالجته بالفعل' }, { status: 409 });
  }

  const auth = await verifyOwnerRequest(req, approval.restaurant_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // من حلّ الطلب يُسجَّل من auth.userId (هوية موثَّقة من الجلسة)، لا من حقل بجسم الطلب.
  const resolvedAt = new Date().toISOString();

  if (action === 'reject') {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('approval_requests')
      .update({ status: 'rejected', resolved_at: resolvedAt })
      .eq('id', approvalId)
      .select('*')
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await logStaffAction({
      restaurant_id: approval.restaurant_id,
      performed_by_auth_id: auth.userId,
      action_type: 'approval_rejected',
      entity_type: 'approval_request',
      entity_id: approvalId,
      before_data: { status: 'pending' },
      after_data: { status: 'rejected' },
    });

    return NextResponse.json({ resolved: true, approval: updated });
  }

  // action === 'approve' — نفّذ العملية المعلّقة فعلياً حسب request_type
  if (approval.order_id) {
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, status, total_amount')
      .eq('id', approval.order_id)
      .maybeSingle();

    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: 'الطلب المرتبط بالموافقة غير موجود' }, { status: 404 });

    if (approval.request_type === 'void_order') {
      await supabaseAdmin.from('orders').update({ status: 'voided' }).eq('id', order.id);
      await logStaffAction({
        restaurant_id: approval.restaurant_id,
        performed_by_auth_id: approval.requested_by_user_id,
        action_type: 'order_void',
        entity_type: 'order',
        entity_id: order.id,
        before_data: { status: order.status },
        after_data: { status: 'voided', reason: approval.reason, via_approval: approvalId },
      });
    } else if (approval.request_type === 'refund') {
      await supabaseAdmin.from('orders').update({ status: 'refunded' }).eq('id', order.id);
      await logStaffAction({
        restaurant_id: approval.restaurant_id,
        performed_by_auth_id: approval.requested_by_user_id,
        action_type: 'order_refund',
        entity_type: 'order',
        entity_id: order.id,
        before_data: { status: order.status },
        after_data: { status: 'refunded', reason: approval.reason, via_approval: approvalId },
      });
    } else if (approval.request_type === 'discount_override') {
      const pct = Number(approval.amount) || 0;
      const originalTotal = Number(order.total_amount) || 0;
      const newTotal = Math.round(originalTotal * (1 - pct / 100) * 100) / 100;
      await supabaseAdmin.from('orders').update({ total_amount: newTotal }).eq('id', order.id);
      await logStaffAction({
        restaurant_id: approval.restaurant_id,
        performed_by_auth_id: approval.requested_by_user_id,
        action_type: 'discount_applied',
        entity_type: 'order',
        entity_id: order.id,
        before_data: { total_amount: originalTotal },
        after_data: { total_amount: newTotal, discount_pct: pct, via_approval: approvalId },
      });
    }
    // 'price_override' محجوز لنقطة مستقبلية — لا يوجد endpoint حالي ينشئه، لذا لا تنفيذ إضافي هنا
  }

  const { data: updatedApproval, error: updateError } = await supabaseAdmin
    .from('approval_requests')
    .update({ status: 'approved', resolved_at: resolvedAt })
    .eq('id', approvalId)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await logStaffAction({
    restaurant_id: approval.restaurant_id,
    performed_by_auth_id: auth.userId,
    action_type: 'approval_approved',
    entity_type: 'approval_request',
    entity_id: approvalId,
    before_data: { status: 'pending' },
    after_data: { status: 'approved' },
  });

  return NextResponse.json({ resolved: true, approval: updatedApproval });
}
