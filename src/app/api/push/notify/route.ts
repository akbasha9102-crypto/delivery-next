import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

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
    if (err.statusCode === 410) {
      await supabase.from('drivers').update({ push_subscription: null }).eq('id', driver_id);
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}
