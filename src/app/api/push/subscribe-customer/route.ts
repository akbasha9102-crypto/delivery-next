import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json() as { order_id?: string; subscription?: { endpoint?: string } };
  const { order_id, subscription } = body;

  if (!order_id || !subscription?.endpoint) {
    return Response.json({ error: 'missing fields' }, { status: 400 });
  }

  // أمان: اقبل فقط طلبات حديثة (أقل من 5 دقائق) ولم تُسجَّل بعد
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('id', order_id)
    .is('push_subscription', null)
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .single();

  if (!order) {
    return Response.json({ error: 'order not found or already subscribed' }, { status: 404 });
  }

  const { error } = await supabase
    .from('orders')
    .update({ push_subscription: subscription, push_enabled: true })
    .eq('id', order_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
