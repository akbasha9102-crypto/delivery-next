import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const secret = request.headers.get('x-api-secret');
  if (!secret || secret !== process.env.API_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { title, body, url, tag } = await request.json();

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, push_subscription')
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
        if (err.statusCode === 410) {
          await supabase.from('drivers').update({ push_subscription: null }).eq('id', driver.id);
        }
      }
    })
  );

  return Response.json({ ok: true, sent: drivers.length });
}
