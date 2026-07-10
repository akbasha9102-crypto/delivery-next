import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

// GET — list all Supabase auth users
export async function GET() {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    users: data.users.map(u => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
    })),
  });
}

// PATCH — update a user's email and/or password
export async function PATCH(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId, email, password } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const updates: { email?: string; password?: string } = {};
  if (email?.trim())    updates.email    = email.trim();
  if (password?.trim()) updates.password = password.trim();

  if (!Object.keys(updates).length)
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
