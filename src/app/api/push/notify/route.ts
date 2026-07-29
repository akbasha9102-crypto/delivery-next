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
  // بخطأ throw فوري ينهار به المسار بالكامل بخطأ 500 غير معالج — بدل تجاهل
  // الإشعار بهدوء كما هو مطبّق فعلاً بـ notify-owner-push.ts (خطأ #19 بتقرير الفحص).
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json({ ok: true, skipped: true, warning: 'VAPID env vars missing' });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const { driver_id, title, body, url, tag } = await request.json();
  if (!driver_id || !title) {
    return Response.json({ error: 'missing fields' }, { status: 400 });
  }

  const { data: driver } = await supabase
    .from('drivers')
    .select('push_subscription')
    .eq('id', driver_id)
    .single();

  if (!driver?.push_subscription) {
    return Response.json({ error: 'no subscription' }, { status: 404 });
  }

  try {
    await webpush.sendNotification(
      driver.push_subscription,
      JSON.stringify({ title, body, url: url || '/', tag: tag || 'delivery' })
    );
    return Response.json({ ok: true });
  } catch (err: any) {
    // اشتراك منتهي الصلاحية - احذفه
    if (err.statusCode === 410 || err.statusCode === 404) {
      await supabase.from('drivers').update({ push_subscription: null }).eq('id', driver_id);
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}
