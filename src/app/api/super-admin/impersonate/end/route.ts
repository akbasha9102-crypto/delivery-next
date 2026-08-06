import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

// POST /api/super-admin/impersonate/end — { logId } → يسجّل وقت انتهاء جلسة
// انتحال هوية (ended_at) بسجل impersonation_log. Best-effort دائماً: يُستدعى
// من ImpersonationBanner عند الخروج (يدوي أو تلقائي بعد خمول)، ولا يجب أن
// يمنع تسجيل الخروج الفعلي (auth.signOut + تحويل) لو فشل.
export async function POST(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { logId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { logId } = body;
  if (!logId) return NextResponse.json({ error: 'logId مطلوب' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('impersonation_log')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', logId)
    .is('ended_at', null);

  if (error) {
    console.error('[impersonation] failed to record ended_at:', error.message, { logId });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
