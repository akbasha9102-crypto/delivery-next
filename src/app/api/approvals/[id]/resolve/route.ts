import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyOwnerRequest } from '@/lib/auth/staff-auth';
import { logStaffAction } from '@/lib/utils/staff-actions-log';
import { returnStockForOrder } from '@/lib/utils/return-stock';

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
      performed_by_label: 'المالك',
      action_type: 'approval_rejected',
      entity_type: 'approval_request',
      entity_id: approvalId,
      before_data: { status: 'pending' },
      after_data: { status: 'rejected' },
    });

    return NextResponse.json({ resolved: true, approval: updated });
  }

  // اسم الكاشير الأصلي الذي طلب الموافقة — لعرضه بسجل التدقيق بدل "غير معروف"
  let requesterLabel: string | null = null;
  if (approval.requested_by_user_id) {
    const { data: requesterRole } = await supabaseAdmin
      .from('user_roles')
      .select('display_name')
      .eq('user_id', approval.requested_by_user_id)
      .eq('restaurant_id', approval.restaurant_id)
      .maybeSingle();
    requesterLabel = requesterRole?.display_name ?? null;
  }

  // action === 'approve' — نفّذ العملية المعلّقة فعلياً حسب request_type
  if (approval.order_id) {
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, restaurant_id, status, total_amount, pre_discount_total, coupon_code')
      .eq('id', approval.order_id)
      .maybeSingle();

    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: 'الطلب المرتبط بالموافقة غير موجود' }, { status: 404 });

    // الطلب قد تكون تغيّرت حالته لملغى/مسترجع بطريقة أخرى أثناء انتظار هذه الموافقة —
    // نفس الحارس الموجود بمساري void/refund المباشرين، لمنع تطبيق إجراء فوق حالة
    // نهائية أصلاً (خطأ #14 بتقرير الفحص). نرفض طلب الموافقة تلقائياً بدل تطبيقه بصمت.
    if (order.status === 'voided' || order.status === 'refunded') {
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
        performed_by_label: 'المالك',
        action_type: 'approval_rejected',
        entity_type: 'approval_request',
        entity_id: approvalId,
        before_data: { status: 'pending' },
        after_data: { status: 'rejected', reason: 'order_status_changed_meanwhile' },
      });

      return NextResponse.json({ error: 'حالة الطلب تغيّرت (ملغى/مسترجع مسبقاً) — تم رفض طلب الموافقة تلقائياً', approval: updated }, { status: 409 });
    }

    if (approval.request_type === 'void_order') {
      await supabaseAdmin.from('orders').update({ status: 'voided' }).eq('id', order.id);
      await returnStockForOrder(approval.restaurant_id, order.id, 'إلغاء طلب (عبر موافقة)');
      await logStaffAction({
        restaurant_id: approval.restaurant_id,
        performed_by_auth_id: approval.requested_by_user_id,
        performed_by_label: requesterLabel,
        action_type: 'order_void',
        entity_type: 'order',
        entity_id: order.id,
        before_data: { status: order.status },
        after_data: { status: 'voided', reason: approval.reason, via_approval: approvalId },
      });
    } else if (approval.request_type === 'refund') {
      await supabaseAdmin.from('orders').update({ status: 'refunded' }).eq('id', order.id);
      await returnStockForOrder(approval.restaurant_id, order.id, 'استرجاع طلب (عبر موافقة)');
      await logStaffAction({
        restaurant_id: approval.restaurant_id,
        performed_by_auth_id: approval.requested_by_user_id,
        performed_by_label: requesterLabel,
        action_type: 'order_refund',
        entity_type: 'order',
        entity_id: order.id,
        before_data: { status: order.status },
        after_data: { status: 'refunded', reason: approval.reason, via_approval: approvalId },
      });
    } else if (approval.request_type === 'discount_override') {
      const pct = Number(approval.amount) || 0;
      const currentTotal = Number(order.total_amount) || 0;
      const originalTotal = Number(order.pre_discount_total ?? order.total_amount) || 0;
      const newTotal = Math.round(originalTotal * (1 - pct / 100) * 100) / 100;
      await supabaseAdmin.from('orders').update({ total_amount: newTotal, pre_discount_total: originalTotal }).eq('id', order.id);
      await logStaffAction({
        restaurant_id: approval.restaurant_id,
        performed_by_auth_id: approval.requested_by_user_id,
        performed_by_label: requesterLabel,
        action_type: 'discount_applied',
        entity_type: 'order',
        entity_id: order.id,
        before_data: { total_amount: currentTotal },
        after_data: { total_amount: newTotal, discount_pct: pct, via_approval: approvalId },
      });
    } else if (approval.request_type === 'coupon_override') {
      // كوبون رجعي: نعيد جلب كود/نسبة الكوبون الحيّة من الإعدادات وقت الموافقة (لا نثق
      // بـ approval.amount كمصدر حقيقة نهائي — قد يتغيّر الكوبون بالإعدادات بين وقت الطلب
      // ووقت الموافقة)، ونحسب من pre_discount_total (السعر الأصلي الحقيقي) وليس total_amount
      // الحالي — بخلاف فرع discount_override أعلاه الذي يحسب من total_amount مباشرة.
      if (!order.coupon_code) {
        const { data: settings } = await supabaseAdmin
          .from('restaurant_settings')
          .select('coupon_code, coupon_discount_pct, coupon_enabled, coupon_allow_retroactive')
          .eq('restaurant_id', order.restaurant_id)
          .maybeSingle();

        const pct = Number(settings?.coupon_discount_pct) || 0;
        const configuredCode = (settings?.coupon_code || '').trim().toUpperCase();

        if (settings?.coupon_enabled && settings?.coupon_allow_retroactive && configuredCode && pct > 0) {
          const originalTotal = Number(order.pre_discount_total ?? order.total_amount) || 0;
          const currentTotal = Number(order.total_amount) || 0;
          const discountAmount = Math.round(originalTotal * (pct / 100) * 100) / 100;
          const newTotal = Math.round((originalTotal - discountAmount) * 100) / 100;

          await supabaseAdmin.from('orders').update({
            total_amount: newTotal,
            pre_discount_total: originalTotal,
            coupon_code: configuredCode,
            discount_amount: discountAmount,
          }).eq('id', order.id);

          await logStaffAction({
            restaurant_id: approval.restaurant_id,
            performed_by_auth_id: approval.requested_by_user_id,
            performed_by_label: requesterLabel,
            action_type: 'coupon_applied',
            entity_type: 'order',
            entity_id: order.id,
            before_data: { total_amount: currentTotal },
            after_data: { total_amount: newTotal, coupon_code: configuredCode, discount_pct: pct, via_approval: approvalId },
          });
        }
        // إن لم يعد الكوبون مفعّلاً/مطابقاً وقت الموافقة، لا تُطبَّق أي تغييرات على الطلب —
        // الموافقة تُسجَّل approved أدناه بأي حال، دون تنفيذ صامت لعملية لم تعد صالحة.
      }
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
    performed_by_label: 'المالك',
    action_type: 'approval_approved',
    entity_type: 'approval_request',
    entity_id: approvalId,
    before_data: { status: 'pending' },
    after_data: { status: 'approved' },
  });

  return NextResponse.json({ resolved: true, approval: updatedApproval });
}
