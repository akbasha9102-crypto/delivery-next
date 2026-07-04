import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';

// مقارنة نصّين بأمان زمني — نحسب sha256 hash لكل منهما أولاً لضمان أن كلا
// المُدخلين لهما نفس الطول دائماً (timingSafeEqual يرمي خطأ إن اختلف الطول)،
// ما يمنع استنتاج المحتوى الصحيح تدريجياً عبر قياس زمن الاستجابة.
function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export async function POST(req: Request) {
  const { username, password } = await req.json();

  const validUser = process.env.SUPER_ADMIN_USERNAME;
  const validPass = process.env.SUPER_ADMIN_PASSWORD;
  const token     = process.env.SUPER_ADMIN_SESSION_TOKEN;

  if (!validUser || !validPass || !token) {
    return NextResponse.json({ ok: false, error: 'server misconfigured' }, { status: 500 });
  }

  if (!safeCompare(String(username ?? ''), validUser) || !safeCompare(String(password ?? ''), validPass)) {
    return NextResponse.json({ ok: false, error: 'invalid credentials' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('sa_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 يوم
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('sa_session', '', { maxAge: 0, path: '/' });
  return res;
}
