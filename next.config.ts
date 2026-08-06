import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// معرّف النشر (deploymentId) — يمنع "version skew": بعد كل npm run build يتغيّر
// هاش ملفات JS/CSS بمجلد .next/static وتُحذف النسخة القديمة. الموظف اللي فاتح
// تبويب من قبل عملية النشر ولسا ما عمل تحديث للصفحة، لما يدوس على قسم فرعي
// (إحصائيات/أرشيف) بتنقل من جانب العميل (client-side)، هذا التنقل يطلب ملفات
// الهاش القديم اللي بقت 404 — فتفشل الصفحة بالتحميل من غير أيقونات ولا تنسيق.
// بوجود deploymentId، Next.js يكتشف الفرق بين هوية العميل وهوية السيرفر ويعمل
// hard navigation (تحديث كامل) بدل تنقل جزئي معطوب.
//
// مهم: نعتمد على SHA فقط (بدون أي طابع زمني). السبب: next.config.ts ملف حي
// يُعاد استيراده وتنفيذه بعمليتين منفصلتين بتوقيتين مختلفين — مرة أثناء
// npm run build (القيمة تُخبَز داخل HTML الصفحات الثابتة كسمة data-dpl-id،
// وتُضمَّن ببنية السيرفر كـ NEXT_DEPLOYMENT_ID وقت البناء)، ومرة أخرى لاحقاً
// عند إقلاع next start (عملية Node منفصلة كلياً، لأن next.config.ts يحوي أيضاً
// دوال حية مثل redirects()/headers() لازم تُنفَّذ وقت الطلب، فـ Next لا يقدر
// يقرأ نسخة JSON مجمّدة للإعداد كامل — يعيد تقييم الملف من جديد وقت الإقلاع).
// لو استخدمنا Date.now()، القيمة المحسوبة وقت البناء تختلف عن القيمة المحسوبة
// لاحقاً وقت إقلاع next start (حتى لو نفس commit تماماً بدون أي تعديل بينهما) —
// وهذا فعلياً سبب عطل اليوم: كل طلب تنقل من العميل يحمل x-deployment-id من
// وقت البناء، بينما السيرفر الحي يقارنه بقيمته هو (من وقت الإقلاع) — تعارض
// دائم يفرض hard navigation بكل ضغطة، للأبد، لحد النشرة الجاية. commit SHA
// وحده حتمي (deterministic) ومبني على حالة git بالقرص — نفس الاستدعاء بعمليتين
// مختلفتين يرجع نفس النص طالما ما صار commit جديد بينهما، وهذا مضمون بترتيب
// النشر بهذا المشروع (بناء ← إعادة تشغيل ← بعدين commit، راجع CLAUDE.md).
function getDeploymentId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // git غير متوفر (حالة نادرة جداً) — نرجّع نص فارغ بدل تعطيل البناء بالكامل.
    // Next.js يتعامل مع deploymentId الفارغ/undefined كـ "الميزة معطّلة" (حسب
    // التوثيق الرسمي) — تدهور مقبول، أفضل من فشل البناء كلياً.
    return '';
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
