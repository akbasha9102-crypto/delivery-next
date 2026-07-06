'use client';
import { useState } from 'react';
import { Users } from 'lucide-react';
import { useStaff } from '@/context/StaffContext';
import { WhoAreYouScreen } from '@/components/staff/WhoAreYouScreen';
import { ApprovalsBell } from '@/components/staff/ApprovalsBell';
import { MyApprovalToast } from '@/components/staff/MyApprovalToast';

/**
 * الطبقة التي تُدرَج بعد AdminGuard مباشرة (تغلّف children داخل AdminLayout):
 * - إن لم تُحدَّد بعد هوية فعّالة (ولم يتم تجاوزها تلقائياً كـ"مالك" — انظر StaffContext) تعرض شاشة "من أنت؟".
 * - غير ذلك: تعرض محتوى الداشبورد كما هو + زر "تبديل المستخدم" ثابت + جرس الموافقات (للمالك/المدير)
 *   أو إشعار حالة الطلب (للكاشير).
 */
export function StaffGate({ children }: { children: React.ReactNode }) {
  const { ready, activeStaff, isOwner, isManager, isCashier, switchUser, staffFeatureEnabled } = useStaff();
  const [confirmSwitch, setConfirmSwitch] = useState(false);

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

      {/* زر تبديل المستخدم — ثابت وظاهر بكل الداشبورد. يظهر فقط إن كانت ميزة الموظفين مفعّلة أصلاً
          (أي أن صاحب المطعم أضاف كاشير واحداً على الأقل)، حتى لا نضيف عنصر واجهة لا معنى له لمن لم يفعّل الميزة. */}
      {staffFeatureEnabled && (
        <>
          {confirmSwitch && (
            <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmSwitch(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-xs text-center" onClick={e => e.stopPropagation()} dir="rtl">
                <p className="font-bold text-gray-900 dark:text-slate-100 mb-1">تبديل المستخدم؟</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">سيتم تسجيل خروجك من هوية «{activeStaff.displayName}» الحالية</p>
                <div className="flex gap-2">
                  <button onClick={() => { setConfirmSwitch(false); switchUser(); }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-all">تبديل</button>
                  <button onClick={() => setConfirmSwitch(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-bold text-sm active:scale-95 transition-all">إلغاء</button>
                </div>
              </div>
            </div>
          )}
          <button onClick={() => setConfirmSwitch(true)}
            className="fixed bottom-24 right-4 md:bottom-6 md:right-[86px] z-40 flex items-center gap-1.5 px-3 h-11 rounded-full bg-slate-800/90 dark:bg-slate-700 text-white text-xs font-bold shadow-lg active:scale-90 transition-all">
            <Users size={15} />
            {activeStaff.displayName}
          </button>

          {(isOwner || isManager) && <ApprovalsBell />}
          {isCashier && <MyApprovalToast />}
        </>
      )}
    </>
  );
}
