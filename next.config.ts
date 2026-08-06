import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// معرّف النشر (deploymentId) — يمنع "version skew": بعد كل npm run build يتغيّر
// هاش ملفات JS/CSS بمجلد .next/static وتُحذف النسخة القديمة. الموظف اللي فاتح
// تبويب من قبل عملية النشر ولسا ما عمل تحديث للصفحة، لما يدوس على قسم فرعي
// (إحصائيات/أرشيف) بتنقل من جانب العميل (client-side)، هذا التنقل يطلب ملفات
// الهاش القديم اللي بقت 404 — فتفشل الصفحة بالتحميل من غير أيقونات ولا تنسيق.
// بوجود deploymentId، Next.js يكتشف الفرق بين هوية العميل وهوية السيرفر ويعمل
// hard navigation (تحديث كامل) بدل تنقل جزئي معطوب. نجمع commit SHA (لتتبّع
// النشرة بسهولة بالسجلات) مع Date.now() (لضمان تفرّد المعرّف بكل بناء فعلي حتى
// لو صار البناء بدون commit جديد — الديبلوي هنا "npm run build" فقط، ممكن
// يشتغل على تعديلات غير مرفوعة بـ commit بعد).
function getDeploymentId(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return `${sha}-${Date.now()}`;
  } catch {
    // git غير متوفر (حالة نادرة جداً — كل سير عمل النشر بهذا المشروع مبني على
    // git أصلاً) — نستخدم الطابع الزمني فقط بدل تعطيل البناء بالكامل.
    return `${Date.now()}`;
  }
}

const nextConfig: NextConfig = {
  deploymentId: getDeploymentId(),
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
