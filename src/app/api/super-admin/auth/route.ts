import { NextResponse } from 'next/server';
import { safeCompare } from '@/lib/utils/safe-compare';
import { getClientIp, isRateLimited, recordAttempt } from '@/lib/utils/rate-limit';

export async function POST(req: Request) {
  const { username, password } = await req.json();

  const validUser = process.env.SUPER_ADMIN_USERNAME;
  const validPass = process.env.SUPER_ADMIN_PASSWORD;
  const token     = process.env.SUPER_ADMIN_SESSION_TOKEN;

  if (!validUser || !validPass || !token) {
    return NextResponse.json({ ok: false, error: 'server misconfigured' }, { status: 500 });
  }

  // حد المحاولات قبل أي مقارنة — يحمي لوحة سوبر أدمن (صلاحيات كاملة على كل
  // مطاعم النظام) من هجوم قوة غاشمة على كلمة المرور.
  const ip = getClientIp(req);
  if (await isRateLimited('super_admin_login', ip, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: 'too many attempts' }, { status: 429 });
  }

  if (!safeCompare(String(username ?? ''), validUser) || !safeCompare(String(password ?? ''), validPass)) {
    // نسجّل المحاولة هنا فقط (بيانات دخول خاطئة فعلاً) — حتى لا تُحتسَب
    // تسجيلات دخول سوبر أدمن الناجحة نفسها ضد حد المحاولات لاحقاً.
    await recordAttempt('super_admin_login', ip);
    return NextResponse.json({ ok: false, error: 'invalid credentials' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('sa_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 أيام (قُلّصت من 30 — جلسة أقصر تحدّ نافذة تعرّض أي جلسة مسروقة)
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('sa_session', '', { maxAge: 0, path: '/' });
  return res;
}
