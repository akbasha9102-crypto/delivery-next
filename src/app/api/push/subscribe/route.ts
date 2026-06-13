import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gbmwrvnmvobvieembxmf.supabase.co',
  'sb_publishable_DB8lKUjdnAah-jNbpFV22w_7Id2Eggr'
);

export async function POST(request: Request) {
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
