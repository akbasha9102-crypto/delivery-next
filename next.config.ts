import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ملاحظة أمنية: كان هنا experimental.staleTimes.dynamic = 120 (يبقي صفحات مثل
  // المنيو/السائقين/الإعدادات محفوظة بكاش المتصفح دقيقتين). هذا يعني أن حارس
  // OwnerOnly لا يُعاد تقييمه عند التنقل ضمن نافذة الكاش — فإذا زار المالك هذه
  // الصفحات ثم بدّل هويته لكاشير خلال دقيقتين، يُعرَض له نفس المحتوى المخزَّن
  // القديم (المفتوح بالكامل) بدل التحقق الفعلي من صلاحياته. أُزيل الإعداد
  // فيرجع للسلوك الافتراضي (dynamic: 0 — بلا كاش) حتى يعمل RBAC بشكل موثوق.
  async redirects() {
    return [
      {
        source: '/driver/:path*',
        destination: '/drivers/:path*',
        permanent: false, // 307 — قابل للتغيير لاحقاً، لا نريد تثبيت التحويلة بذاكرة تخزين طويلة الأمد بمتصفحات/PWA السائقين
      },
    ];
  },
  // رؤوس أمان — كانت غائبة بالكامل (ثغرة حرجة #3 بالمراجعة الأمنية الشاملة):
  // بلا X-Frame-Options أي صفحة (بما فيها تسجيل دخول السوبر-أدمن وأزرار
  // الاسترجاع/الإلغاء بلوحة الكاشير) قابلة للتضمين بإطار iframe خفي من موقع
  // مهاجم (clickjacking). CSP بوضع Report-Only فقط مبدئياً — هذا التطبيق يعتمد
  // بشدة على خرائط (Leaflet/MapLibre من unpkg.com/tiles.openfreemap.org/
  // cartocdn.com) وSupabase Realtime، وتفعيل CSP بوضع الإنفاذ مباشرة بلا رصد
  // مسبق قد يكسر مسارات حساسة (تتبع الطلب، تنقل السائق) — يُفعَّل الإنفاذ لاحقاً
  // بعد مراجعة تقارير Report-Only فعلياً من الإنتاج.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://tiles.openfreemap.org https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://tiles.openfreemap.org https://unpkg.com",
      "worker-src 'self' blob: https://unpkg.com",
      "frame-src https://maps.google.com",
      "frame-ancestors 'none'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
