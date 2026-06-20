import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/super-admin/dashboard')) {
    const token = request.cookies.get('sa_session')?.value;
    const expected = process.env.SUPER_ADMIN_SESSION_TOKEN;
    if (!token || token !== expected) {
      return NextResponse.redirect(new URL('/super-admin/login', request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/super-admin/dashboard/:path*'],
};
