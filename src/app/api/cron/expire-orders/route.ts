import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'rejected' })
    .eq('status', 'pending')
    .is('driver_id', null)
    .lt('created_at', cutoff)
    .select('id');

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ expired: data?.length ?? 0 });
}
