import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { driver_id, subscription } = await request.json();
  if (!driver_id || !subscription) {
    return Response.json({ error: 'missing fields' }, { status: 400 });
  }
  const { error } = await supabase
    .from('drivers')
    .update({ push_subscription: subscription })
    .eq('id', driver_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
