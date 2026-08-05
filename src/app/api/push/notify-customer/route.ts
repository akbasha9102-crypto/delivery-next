import webpush from 'web-push';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';

// POST /api/push/notify-customer — يرسل إشعار حالة الطلب للزبون. كان
// محمياً بسر ثابت مسرَّب عبر NEXT_PUBLIC_API_SECRET (ثغرة حرجة #1 بالمراجعة
// الأمنية) — الآن يتحقق أن المستدعي فعلاً موظف/مالك بنفس مطعم الطلب.
export async function POST(request: NextRequest) {
  const supabase = supabaseAdmin;

  const { order_id, title, body, tag } = await request.json() as {
    order_id: string;
    title: string;
    body: string;
    tag?: string;
  };

  if (!order_id || !title) {
    return Response.json({ error: 'missing fields' }, { status: 400 });
  }

  const { data: order } = await supabase
    .from('orders')
    .select('restaurant_id, push_subscription, push_enabled')
    .eq('id', order_id)
    .single();

  if (!order) return Response.json({ error: 'order not found' }, { status: 404 });

  const identityRes = await resolveStaffIdentity(request, order.restaurant_id);
  if (!identityRes.ok) return Response.json({ error: identityRes.error }, { status: identityRes.status });

  // بدون هذا التحقق، غياب أي متغير من الثلاثة يُسقط webpush.setVapidDetails
  // بخطأ throw فوري ينهار به المسار بالكامل بخطأ 500 غير معالج (خطأ #19 بتقرير الفحص).
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json({ ok: true, skipped: true, warning: 'VAPID env vars missing' });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  if (!order.push_enabled || !order.push_subscription) {
    return Response.json({ ok: true, skipped: true });
  }

  try {
    await webpush.sendNotification(
      order.push_subscription as Parameters<typeof webpush.sendNotification>[0],
      JSON.stringify({ title, body, url: '/track', tag: tag ?? 'order-status' })
    );
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const pushErr = err as { statusCode?: number; message?: string };
    console.error('[push/notify-customer] sendNotification failed for order', order_id, pushErr);
    if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
      await supabase
        .from('orders')
        .update({ push_subscription: null, push_enabled: false })
        .eq('id', order_id);
    }
    return Response.json({ ok: true, warning: pushErr.message });
  }
}
