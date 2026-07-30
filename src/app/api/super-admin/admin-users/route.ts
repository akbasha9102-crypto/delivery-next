import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getClientIp } from '@/lib/utils/rate-limit';
import { logSuperAdminAction } from '@/lib/utils/super-admin-audit-log';
import { MIN_STAFF_PASSWORD_LENGTH } from '@/lib/auth/staff-auth';

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
  if (password?.trim()) {
    if (password.trim().length < MIN_STAFF_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `كلمة المرور يجب أن تكون ${MIN_STAFF_PASSWORD_LENGTH} أحرف/أرقام على الأقل` }, { status: 400 });
    }
    updates.password = password.trim();
  }

  if (!Object.keys(updates).length)
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // سجل تدقيق: لا نُدرج قيمة كلمة المرور نفسها إطلاقاً هنا، فقط أسماء
  // الحقول التي تغيّرت والإيميل الجديد إن وُجد (راجع تعليق super-admin-audit-log.ts).
  await logSuperAdminAction({
    action: 'admin_user_updated',
    targetUserId: userId,
    details: { fields_changed: Object.keys(updates), new_email: updates.email ?? null },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
