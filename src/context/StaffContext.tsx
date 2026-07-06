'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRestaurant } from '@/context/RestaurantContext';
import { listStaff, verifyPin, type StaffMember, type StaffRole, type VerifyPinSuccess } from '@/lib/staffApi';

export type ActiveStaff = {
  staffId: string | null;   // null = المالك (لا صف restaurant_staff بالضرورة)
  displayName: string;
  role: StaffRole;
  maxDiscountPct: number;
  maxVoidAmount: number;
};

const OWNER_ACTIVE: ActiveStaff = {
  staffId: null,
  displayName: 'المالك',
  role: 'owner',
  maxDiscountPct: 100,
  maxVoidAmount: Number.MAX_SAFE_INTEGER,
};

const IDLE_LOCK_MS = 2 * 60 * 1000; // دقيقتان خمول → قفل تلقائي (auto-lock) — للكاشير/المدير فقط، ليس للمالك

function storageKey(restaurantId: string) {
  return `dasha_active_staff:${restaurantId}`;
}

type StaffCtxValue = {
  ready: boolean;                 // انتهى تحديد الحالة (تحميل قائمة الموظفين + محاولة الاستعادة من sessionStorage)
  activeStaff: ActiveStaff | null;
  staffList: StaffMember[];
  staffListLoading: boolean;
  staffFeatureEnabled: boolean;   // هل يوجد موظفون مُعرَّفون فعلاً لهذا المطعم (أي أن صاحب المطعم فعّل نظام الكاشير)
  isOwner: boolean;
  isManager: boolean;
  isCashier: boolean;
  isRestricted: boolean;          // اختصار: الدور الحالي كاشير (كل قيود المصفوفة تُطبَّق)
  setOwnerActive: () => void;
  loginWithPin: (pin: string) => Promise<{ ok: true } | { ok: false; status: number; error: string }>;
  switchUser: () => void;         // تسجيل خروج من الهوية الحالية (يدوي) — يعيد شاشة "من أنت؟"
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
  setOwnerActive: () => {},
  loginWithPin: async () => ({ ok: false, status: 0, error: 'غير جاهز' }),
  switchUser: () => {},
  refreshStaffList: async () => {},
});

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const { restaurantId } = useRestaurant();
  const [activeStaff, setActiveStaffState] = useState<ActiveStaff | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffListLoading, setStaffListLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((staff: ActiveStaff | null) => {
    if (!restaurantId || typeof window === 'undefined') return;
    try {
      if (staff) sessionStorage.setItem(storageKey(restaurantId), JSON.stringify(staff));
      else sessionStorage.removeItem(storageKey(restaurantId));
    } catch { /* sessionStorage قد يكون غير متاح (خصوصية متصفح) — تجاهل بصمت */ }
  }, [restaurantId]);

  const setOwnerActive = useCallback(() => {
    setActiveStaffState(OWNER_ACTIVE);
    persist(OWNER_ACTIVE);
  }, [persist]);

  const switchUser = useCallback(() => {
    setActiveStaffState(null);
    persist(null);
  }, [persist]);

  const refreshStaffList = useCallback(async () => {
    if (!restaurantId) return;
    setStaffListLoading(true);
    const res = await listStaff(restaurantId);
    if (res.ok) {
      const list = Array.isArray(res.data) ? res.data : ((res.data as { staff?: StaffMember[] })?.staff ?? []);
      setStaffList((list as StaffMember[]).filter(s => s.is_active));
    } else {
      // فشل الطلب (مثلاً 404 لأن نقطة الـ API لم تُنشر بعد من فريق الـ Backend) — لا نكسر الواجهة،
      // ببساطة نتعامل مع الوضع كأنه "ميزة الكاشير غير مفعّلة بعد" فيستمر المالك بتجربته الحالية دون أي احتكاك.
      setStaffList([]);
    }
    setStaffListLoading(false);
  }, [restaurantId]);

  // 1) عند توفر restaurantId: حاول استعادة الهوية الفعّالة من sessionStorage، وحمّل قائمة الموظفين
  useEffect(() => {
    if (!restaurantId) return;
    setHydrated(false);
    try {
      const raw = sessionStorage.getItem(storageKey(restaurantId));
      if (raw) setActiveStaffState(JSON.parse(raw));
    } catch { /* تجاهل */ }
    refreshStaffList().then(() => setHydrated(true));
  }, [restaurantId, refreshStaffList]);

  // 2) إن لم تكن هناك هوية فعّالة محفوظة، وتبيّن بعد التحميل أن لا يوجد موظفون مُعرَّفون إطلاقاً
  //    (صاحب المطعم لم يفعّل نظام الكاشير بعد) → لا نعرض شاشة "من أنت؟" أبداً، ونُبقي المالك بنفس تجربته اليوم
  //    بالضبط (بدون أي احتكاك إضافي) — هذا أهم قرار للحفاظ على "لا تعديل على تجربة المالك الحالية".
  useEffect(() => {
    if (!hydrated || staffListLoading || activeStaff) return;
    if (staffList.length === 0) setOwnerActive();
  }, [hydrated, staffListLoading, activeStaff, staffList, setOwnerActive]);

  const loginWithPin = useCallback(async (pin: string) => {
    if (!restaurantId) return { ok: false as const, status: 0, error: 'تعذّر تحديد المطعم' };
    const res = await verifyPin(restaurantId, pin);
    if (!res.ok) {
      const status = res.status;
      const error = 'pending' in res && res.pending ? 'بانتظار موافقة' : (('error' in res && res.error) || 'PIN غير صحيح');
      return { ok: false as const, status, error };
    }
    const data = res.data as VerifyPinSuccess;
    const staff: ActiveStaff = {
      staffId: data.staff_id,
      displayName: data.display_name,
      role: data.role,
      maxDiscountPct: data.max_discount_pct,
      maxVoidAmount: data.max_void_amount,
    };
    setActiveStaffState(staff);
    persist(staff);
    return { ok: true as const };
  }, [restaurantId, persist]);

  // 3) قفل تلقائي بعد خمول (Auto-lock) — يُطبَّق فقط على الأدوار المقيَّدة (كاشير/مدير)، وليس المالك،
  //    حتى لا نضيف أي احتكاك جديد لتجربة المالك الحالية التي لا تعرف مفهوم "الخمول" أصلاً اليوم.
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

  // إغلاق التبويب/الجهاز يمسح تلقائياً بحكم استخدام sessionStorage (لا حاجة لمنطق إضافي)

  const isOwner = activeStaff?.role === 'owner';
  const isManager = activeStaff?.role === 'manager';
  const isCashier = activeStaff?.role === 'cashier';

  return (
    <StaffCtx.Provider value={{
      ready: hydrated && !staffListLoading,
      activeStaff,
      staffList,
      staffListLoading,
      staffFeatureEnabled: staffList.length > 0,
      isOwner,
      isManager,
      isCashier,
      isRestricted: isCashier,
      setOwnerActive,
      loginWithPin,
      switchUser,
      refreshStaffList,
    }}>
      {children}
    </StaffCtx.Provider>
  );
}

export const useStaff = () => useContext(StaffCtx);
