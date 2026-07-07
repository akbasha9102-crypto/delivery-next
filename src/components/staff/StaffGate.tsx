'use client';
import { useStaff } from '@/context/StaffContext';
import { WhoAreYouScreen } from '@/components/staff/WhoAreYouScreen';
import { MyApprovalToast } from '@/components/staff/MyApprovalToast';

/**
 * الطبقة التي تُدرَج بعد AdminGuard مباشرة (تغلّف children داخل AdminLayout):
 * - إن لم تُحدَّد بعد هوية فعّالة (ولم يتم تجاوزها تلقائياً كـ"مالك" — انظر StaffContext) تعرض شاشة "من أنت؟".
 * - غير ذلك: تعرض محتوى الداشبورد كما هو + إشعار حالة الطلب (للكاشير).
 *   زر "تبديل المستخدم" وجرس الموافقات انتقلا لصفحة الإعدادات (لم يعودا عائمين فوق الشاشة).
 */
export function StaffGate({ children }: { children: React.ReactNode }) {
  const { ready, activeStaff, isCashier } = useStaff();

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeStaff) {
    return <WhoAreYouScreen />;
  }

  return (
    <>
      {children}
      {isCashier && <MyApprovalToast />}
    </>
  );
}
