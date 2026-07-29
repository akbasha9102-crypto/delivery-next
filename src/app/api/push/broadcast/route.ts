import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const secret = request.headers.get('x-api-secret');
  if (!secret || secret !== process.env.API_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // بدون هذا التحقق، غياب أي متغير من الثلاثة يُسقط webpush.setVapidDetails
  // بخطأ throw فوري ينهار به المسار بالكامل بخطأ 500 غير معالج (خطأ #19 بتقرير الفحص).
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json({ ok: true, sent: 0, warning: 'VAPID env vars missing' });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const { title, body, url, tag, restaurant_id } = await request.json();

  if (!restaurant_id) {
    return Response.json({ error: 'restaurant_id مطلوب' }, { status: 400 });
  }

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, push_subscription')
    .eq('restaurant_id', restaurant_id)
    .not('push_subscription', 'is', null);

  if (!drivers?.length) return Response.json({ ok: true, sent: 0 });

  await Promise.allSettled(
    drivers.map(async (driver) => {
      if (!driver.push_subscription) return;
      try {
        await webpush.sendNotification(
          driver.push_subscription,
          JSON.stringify({ title, body, url: url || '/driver/dashboard', tag: tag || 'new-order' })
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('drivers').update({ push_subscription: null }).eq('id', driver.id);
        }
      }
    })
  );

  return Response.json({ ok: true, sent: drivers.length });
}
