import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// GET → set preview cookie and redirect to admin dashboard
export async function GET() {
  const jar = await cookies();
  const session = jar.get('sa_session')?.value;
  const expected = process.env.SUPER_ADMIN_SESSION_TOKEN;

  if (!session || session !== expected) {
    return NextResponse.redirect('/super-admin/login');
  }

  const res = NextResponse.redirect(
    new URL('/admin/dashboard', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
  );
  res.cookies.set('sa_preview', expected, {
    httpOnly: true, sameSite: 'strict', path: '/', maxAge: 60 * 60,
  });
  return res;
}

// DELETE → clear preview cookie
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('sa_preview', '', { maxAge: 0, path: '/' });
  return res;
}
