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
};

export default nextConfig;
