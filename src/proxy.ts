import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/super-admin/dashboard')) {
    const token = request.cookies.get('sa_session')?.value;
    // مفتاح إيقاف طارئ (kill switch): تدوير قيمة SUPER_ADMIN_SESSION_TOKEN
    // بمتغيرات البيئة وإعادة النشر يُبطل فوراً كل كوكيز sa_session الحالية
    // بكل مكان (بما فيها أي جلسة مسروقة يُشتبه بها) — لا حاجة لنظام تدوير/
    // انتهاء صلاحية توكن إضافي، مدة الكوكي (7 أيام، راجع super-admin/auth/route.ts)
    // هي السقف الطبيعي أصلاً.
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
