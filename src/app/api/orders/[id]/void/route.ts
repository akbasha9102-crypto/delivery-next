import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getStaffContext, isPrivilegedRole } from '@/lib/staff-auth';
import { logStaffAction } from '@/lib/staff-actions-log';
import { notifyOwnerPush } from '@/lib/notify-owner-push';

// POST /api/orders/:id/void — { staff_id, reason }
// مالك/مدير: ينفّذ مباشرة. كاشير ضمن max_void_amount: ينفّذ مباشرة.
// كاشير فوق الحد: يُنشئ approval_requests (status='pending') ويرجع 202.
// "الإلغاء" = تغيير status فقط (لا حذف حقيقي أبداً) — راجع خطة RBAC قسم 5.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  let body: { staff_id?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { staff_id, reason } = body;
  if (!staff_id) return NextResponse.json({ error: 'staff_id مطلوب' }, { status: 400 });
  if (!reason?.trim()) return NextResponse.json({ error: 'reason مطلوب لإلغاء الطلب' }, { status: 400 });

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
    return NextResponse.json({ error: 'الطلب ملغى/مسترجع بالفعل' }, { status: 409 });
  }

  const amount = Number(order.total_amount) || 0;
  const needsApproval = !isPrivilegedRole(staff.role) && amount > Number(staff.max_void_amount);

  if (needsApproval) {
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('approval_requests')
      .insert({
        restaurant_id: staff.restaurant_id,
        requested_by: staff_id,
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
      staff_id,
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
    staff_id,
    action_type: 'order_void',
    entity_type: 'order',
    entity_id: orderId,
    before_data: { status: beforeStatus },
    after_data: { status: 'voided', reason: reason.trim() },
  });

  return NextResponse.json({ voided: true, order: updatedOrder });
}
