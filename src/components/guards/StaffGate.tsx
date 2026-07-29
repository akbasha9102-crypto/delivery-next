'use client';
import { useEffect } from 'react';
import { useStaff } from '@/context/StaffContext';
import { MyApprovalToast } from '@/components/staff/MyApprovalToast';
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner';

/**
 * الطبقة التي تُدرَج بعد AdminGuard مباشرة (تغلّف children داخل AdminLayout):
 * - أثناء تحديد الهوية (تحميل + تفعيل المالك تلقائياً في StaffContext) تعرض سبينر.
 * - غير ذلك: تعرض محتوى الداشبورد كما هو + إشعار حالة الطلب (للكاشير).
 *   شاشة اختيار الهوية ("من أنت؟") أُزيلت نهائياً — الجلسة المشتركة تُفعَّل كمالك
 *   تلقائياً دائماً؛ الموظفون الحقيقيون (تسجيل دخول مستقل من /login) يحتفظون بدورهم كما هو.
 */
export function StaffGate({ children }: { children: React.ReactNode }) {
  const { ready, activeStaff, isCashier, switchUser } = useStaff();

  // ready===true مع activeStaff===null يعني جلسة صالحة (AdminGuard تحقق منها مسبقاً)
  // لكن بلا دور معروف بهذا المطعم — مثلاً حساب موظف أُلغي حديثاً. بدون هذا التحويل
  // يعلق المستخدم على سبينر بلا نهاية بلا أي مخرج (خطأ #4 بتقرير الفحص).
  useEffect(() => {
    if (!ready || activeStaff) return;
    const t = setTimeout(() => switchUser(), 2000);
    return () => clearTimeout(t);
  }, [ready, activeStaff, switchUser]);

  if (!ready) return <FullScreenSpinner />;

  if (!activeStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#212121] p-6 text-center" dir="rtl">
        <div>
          <p className="text-gray-500 dark:text-slate-400 font-bold mb-1">تعذّر تحديد صلاحيتك بهذا المطعم</p>
          <p className="text-gray-400 dark:text-slate-500 text-sm">جاري تحويلك لتسجيل الدخول من جديد...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {isCashier && <MyApprovalToast />}
    </>
  );
}
