'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStaff } from '@/context/StaffContext';

/**
 * حارس صفحات "المالك/المدير فقط" — يمنع الوصول البصري والملاحي معاً:
 * - لا يُظهر محتوى الصفحة إطلاقاً للكاشير (ليس إخفاءً بـ CSS بل عدم render أصلاً).
 * - يُعيد توجيه أي محاولة وصول مباشر عبر الرابط بعيداً عن الصفحة تلقائياً.
 * يُستخدم بلف عنصر الصفحة الجذر فقط — بدون أي تعديل على منطق الصفحة نفسها.
 */
export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, isCashier } = useStaff();

  useEffect(() => {
    if (ready && isCashier) router.replace('/admin/dashboard');
  }, [ready, isCashier, router]);

  if (!ready || isCashier) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
