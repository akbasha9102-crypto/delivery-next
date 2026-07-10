import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

const MIGRATION_SQL = `
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS admin_email TEXT,
  ADD COLUMN IF NOT EXISTS admin_password TEXT,
  ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
`;

export async function POST() {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Try via rpc exec_sql (works if function exists)
  const { error: rpcErr } = await supabaseAdmin.rpc('exec_sql', { sql: MIGRATION_SQL });
  if (!rpcErr) return NextResponse.json({ ok: true, method: 'rpc' });

  // Try via PostgREST SQL endpoint (newer Supabase versions)
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        },
        body: JSON.stringify({ query: MIGRATION_SQL }),
      }
    );
    if (res.ok) return NextResponse.json({ ok: true, method: 'sql-endpoint' });
  } catch { /* ignore */ }

  return NextResponse.json({
    ok: false,
    error: 'migration_required',
    sql: MIGRATION_SQL.trim(),
  }, { status: 422 });
}
