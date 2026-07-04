import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET → set preview cookie and redirect to admin dashboard
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const session = jar.get('sa_session')?.value;
  const expected = process.env.SUPER_ADMIN_SESSION_TOKEN;

  if (!session || session !== expected) {
    return NextResponse.redirect(new URL('/super-admin/login', req.url));
  }

  const rid = req.nextUrl.searchParams.get('rid');
  if (!rid) {
    return NextResponse.redirect(new URL('/super-admin/dashboard', req.url));
  }

  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('id', rid)
    .maybeSingle();

  if (!restaurant?.id) {
    return NextResponse.redirect(new URL('/super-admin/dashboard', req.url));
  }

  const res = NextResponse.redirect(new URL('/admin/dashboard', req.url));
  res.cookies.set('sa_preview', expected, {
    httpOnly: true, sameSite: 'strict', path: '/', maxAge: 60 * 60,
  });
  res.cookies.set('sa_preview_restaurant', restaurant.id, {
    httpOnly: true, sameSite: 'strict', path: '/', maxAge: 60 * 60,
  });
  return res;
}

// DELETE → clear preview cookie
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('sa_preview', '', { maxAge: 0, path: '/' });
  res.cookies.set('sa_preview_restaurant', '', { maxAge: 0, path: '/' });
  return res;
}
