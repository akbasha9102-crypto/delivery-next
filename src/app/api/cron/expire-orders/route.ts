import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
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
