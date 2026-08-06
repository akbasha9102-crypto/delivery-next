'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 دقيقة خمول → تسجيل خروج تلقائي

type ImpersonationState = { restaurantId: string; restaurantName: string; startedAt: number; logId: string | null };

// يُركَّب داخل src/app/admin/layout.tsx (يظهر بكل تبويبات لوحة تحكم المطعم).
// لا يعرض شيئاً إطلاقاً إن لم تكن هناك جلسة انتحال نشطة بـ sessionStorage.
export function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const exitingRef = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('impersonation_active');
      if (raw) setState(JSON.parse(raw));
    } catch {
      setState(null);
    }
  }, []);

  const exitImpersonation = async () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    if (state?.logId) {
      try {
        await fetch('/api/super-admin/impersonate/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logId: state.logId }),
        });
      } catch { /* best-effort */ }
    }
    try { await supabase.auth.signOut(); } catch { /* best-effort */ }
    sessionStorage.removeItem('impersonation_active');
    window.location.assign('/super-admin/dashboard');
  };

  useEffect(() => {
    if (!state) return;

    const markActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('mousemove', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity);
    window.addEventListener('click', markActivity);

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_LIMIT_MS) {
        exitImpersonation();
      }
    }, 60 * 1000); // فحص كل دقيقة

    return () => {
      window.removeEventListener('mousemove', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('click', markActivity);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state) return null;

  return (
    <div className="sticky top-0 z-[100] w-full bg-amber-500 text-black px-4 py-2 flex items-center justify-between gap-3 text-sm font-bold shadow-md" dir="rtl">
      <span>⚠️ أنت متصل الآن كصاحب مطعم: {state.restaurantName}</span>
      <button
        onClick={() => exitImpersonation()}
        className="bg-black/80 text-amber-300 px-3 py-1 rounded-lg text-xs font-bold hover:bg-black transition-colors active:scale-95"
      >
        خروج من وضع الانتحال
      </button>
    </div>
  );
}
