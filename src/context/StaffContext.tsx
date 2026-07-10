'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRestaurant } from '@/context/RestaurantContext';
import { supabase } from '@/lib/supabase/client';
import { getMyStaffContext, listStaff, type StaffMember, type StaffRole } from '@/lib/api/staffApi';

export type ActiveStaff = {
  staffId: string;        // auth.uid() لهذه الجلسة — owner/manager/cashier/driver جميعاً
  displayName: string;
  role: StaffRole;
  maxDiscountPct: number;
  maxVoidAmount: number;
  // Supabase access_token الفعلي لهذه الجلسة — يُرسل كـ Authorization: Bearer
  // لكل نداء API حساس. الخادم يتحقق من التوقيع ويستخرج role/restaurant_id من
  // الـ JWT نفسه (custom_access_token_hook)، وليس من أي شيء يرسله العميل.
  staffToken: string;
};

const IDLE_LOCK_MS = 2 * 60 * 1000; // دقيقتان خمول → قفل تلقائي — للأدوار المقيَّدة فقط، ليس المالك

type StaffCtxValue = {
  ready: boolean;
  activeStaff: ActiveStaff | null;
  staffList: StaffMember[];
  staffListLoading: boolean;
  staffFeatureEnabled: boolean;
  isOwner: boolean;
  isManager: boolean;
  isCashier: boolean;
  isRestricted: boolean;
  switchUser: () => void;
  refreshStaffList: () => Promise<void>;
};

const StaffCtx = createContext<StaffCtxValue>({
  ready: false,
  activeStaff: null,
  staffList: [],
  staffListLoading: true,
  staffFeatureEnabled: false,
  isOwner: false,
  isManager: false,
  isCashier: false,
  isRestricted: false,
  switchUser: () => {},
  refreshStaffList: async () => {},
});

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const { restaurantId } = useRestaurant();
  const [activeStaff, setActiveStaff] = useState<ActiveStaff | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffListLoading, setStaffListLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const switchUser = useCallback(() => {
    setActiveStaff(null);
    supabase.auth.signOut().finally(() => {
      if (typeof window !== 'undefined') window.location.href = '/login';
    });
  }, []);

  const refreshStaffList = useCallback(async () => {
    if (!restaurantId) return;
    setStaffListLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await listStaff(restaurantId, session?.access_token);
    if (res.ok) {
      const list = Array.isArray(res.data) ? res.data : ((res.data as { staff?: StaffMember[] })?.staff ?? []);
      setStaffList((list as StaffMember[]).filter(s => s.is_active));
    } else {
      setStaffList([]);
    }
    setStaffListLoading(false);
  }, [restaurantId]);

  // كل جلسة (مالك أو موظف) هي حساب Supabase Auth حقيقي الآن — لا يوجد فرق
  // بينهما بنيوياً بعد إزالة نظام PIN فوق جلسة مشتركة. نجيب الدور/الحدود
  // مرة واحدة من /api/staff/my-context (يقرأ الآن claims الجلسة الموثّقة
  // سيرفر-سايد، لا توكن HMAC).
  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setReady(false);

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.access_token) {
        setActiveStaff(null);
        setReady(true);
        return;
      }

      const myCtx = await getMyStaffContext(session.access_token);
      if (cancelled) return;

      if (myCtx.ok) {
        setActiveStaff({
          staffId: myCtx.data.staff_id,
          displayName: myCtx.data.display_name,
          role: myCtx.data.role,
          maxDiscountPct: myCtx.data.max_discount_pct,
          maxVoidAmount: myCtx.data.max_void_amount,
          staffToken: session.access_token,
        });
      } else {
        // لا دور معروف لهذه الجلسة على هذا المطعم (مثلاً حساب مُعطَّل) — لا نفترض أنه مالك.
        setActiveStaff(null);
      }

      await refreshStaffList();
      if (cancelled) return;
      setReady(true);
    })();

    return () => { cancelled = true; };
  }, [restaurantId, refreshStaffList]);

  // قفل تلقائي بعد خمول — للأدوار المقيَّدة فقط (manager/cashier/driver)، ليس المالك
  useEffect(() => {
    if (!activeStaff || activeStaff.role === 'owner') {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return;
    }
    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => switchUser(), IDLE_LOCK_MS);
    };
    const events: (keyof DocumentEventMap)[] = ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'];
    events.forEach(ev => document.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      events.forEach(ev => document.removeEventListener(ev, reset));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [activeStaff, switchUser]);

  const isOwner = activeStaff?.role === 'owner';
  const isManager = activeStaff?.role === 'manager';
  const isCashier = activeStaff?.role === 'cashier';

  return (
    <StaffCtx.Provider value={{
      ready,
      activeStaff,
      staffList,
      staffListLoading,
      staffFeatureEnabled: staffList.length > 0,
      isOwner,
      isManager,
      isCashier,
      isRestricted: isCashier,
      switchUser,
      refreshStaffList,
    }}>
      {children}
    </StaffCtx.Provider>
  );
}

export const useStaff = () => useContext(StaffCtx);
