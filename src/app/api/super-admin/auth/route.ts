import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { username, password } = await req.json();

  const validUser = process.env.SUPER_ADMIN_USERNAME;
  const validPass = process.env.SUPER_ADMIN_PASSWORD;
  const token     = process.env.SUPER_ADMIN_SESSION_TOKEN;

  if (!validUser || !validPass || !token) {
    return NextResponse.json({ ok: false, error: 'server misconfigured' }, { status: 500 });
  }

  if (username !== validUser || password !== validPass) {
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
