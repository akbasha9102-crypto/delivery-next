import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function POST(request: Request) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  const secret = request.headers.get('x-api-secret');
  if (secret !== process.env.API_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { title, body, url, restaurant_id } = await request.json();
  if (!title || !body) {
    return Response.json({ error: 'missing title or body' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // فقط سائقو المطعم المحدد
  let q = supabase
    .from('drivers')
    .select('id, push_subscription')
    .not('push_subscription', 'is', null);

  if (restaurant_id) {
    q = q.eq('restaurant_id', restaurant_id) as typeof q;
  }

  const { data: drivers, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!drivers || drivers.length === 0) return Response.json({ sent: 0 });

  const payload = JSON.stringify({ title, body, url: url || '/dashboard', tag: 'new-order' });
  const staleIds: string[] = [];

  await Promise.all(
    drivers.map(async (d) => {
      try {
        await webpush.sendNotification(d.push_subscription as webpush.PushSubscription, payload);
      } catch (err: unknown) {
        const e = err as { statusCode?: number };
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          staleIds.push(d.id);
        }
      }
    })
  );

  // حذف الاشتراكات المنتهية
  if (staleIds.length > 0) {
    await supabase
      .from('drivers')
      .update({ push_subscription: null })
      .in('id', staleIds);
  }

  return Response.json({ sent: drivers.length - staleIds.length });
}
