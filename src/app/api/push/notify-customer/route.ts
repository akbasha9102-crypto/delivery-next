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

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

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
    .select('push_subscription, push_enabled')
    .eq('id', order_id)
    .single();

  if (!order?.push_enabled || !order?.push_subscription) {
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
    if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
      await supabase
        .from('orders')
        .update({ push_subscription: null, push_enabled: false })
        .eq('id', order_id);
    }
    return Response.json({ ok: true, warning: pushErr.message });
  }
}
