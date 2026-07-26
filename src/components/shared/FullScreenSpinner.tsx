'use client';

/**
 * شاشة تحميل كاملة الصفحة (سبينر) — تُستخدم بحرّاس صفحات /admin
 * (AdminGuard, StaffGate, OwnerOnly) أثناء التحقق من الجلسة/المطعم/الهوية.
 * الخلفية والبرتقالي مطابقان تماماً لخلفية وأزرار الداشبورد الفعلية.
 */
export function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#212121] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
