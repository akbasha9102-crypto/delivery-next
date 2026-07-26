'use client';
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
  const { ready, activeStaff, isCashier } = useStaff();

  if (!ready || !activeStaff) {
    return <FullScreenSpinner />;
  }

  return (
    <>
      {children}
      {isCashier && <MyApprovalToast />}
    </>
  );
}
