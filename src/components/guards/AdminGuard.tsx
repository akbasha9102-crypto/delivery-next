'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/context/RestaurantContext';
import { useSettings } from '@/context/SettingsContext';
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { restaurantId, setRestaurant } = useRestaurant();
  const { is_suspended: liveIsSuspended, loaded: settingsLoaded } = useSettings();
  const [checking,  setChecking]  = useState(true);
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    const run = async () => {
      // Super admin preview mode — bypass normal auth
      const previewRes = await fetch('/api/super-admin/preview-check').catch(() => null);
      if (previewRes?.ok) {
        const { ok, restaurant } = await previewRes.json().catch(() => ({ ok: false, restaurant: null }));
        if (ok && restaurant?.id) {
          setRestaurant(restaurant.id, restaurant.name ?? null);
          setChecking(false);
          return;
        }
        if (ok) { router.replace('/login'); return; }
      }

      // Normal Supabase auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }

      // جلب مطعم المستخدم عبر API (service role — يتجاوز RLS)
      const res = await fetch('/api/admin/my-restaurant', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => null);

      if (!res?.ok) { router.replace('/login'); return; }

      const { restaurant, is_suspended } = await res.json().catch(() => ({}));

      if (!restaurant?.id) { router.replace('/login'); return; }

      setRestaurant(restaurant.id, restaurant.name ?? null);

      if (is_suspended) { setSuspended(true); setChecking(false); return; }

      setChecking(false);
    };

    run();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/login');
    });
    return () => subscription.unsubscribe();
  }, [router, setRestaurant]);

  // مراقبة تعليق حيّة أثناء الجلسة — تستهلك useSettings (نفس قناة
  // postgres_changes التي يفتحها SettingsProvider أصلاً بـ layout.tsx)
  // بدل فحص my-restaurant عند mount فقط، فيظهر تعليق المطعم فوراً
  // حتى لو حصل بعد أن دخل المستخدم للوحة أصلاً.
  useEffect(() => {
    if (!checking && restaurantId && settingsLoaded && liveIsSuspended) {
      setSuspended(true);
    }
  }, [checking, restaurantId, settingsLoaded, liveIsSuspended]);

  if (checking) return <FullScreenSpinner />;

  if (suspended) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center" dir="rtl">
      <div>
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-black text-red-400 mb-2">الحساب موقوف</h1>
        <p className="text-slate-400 text-sm">تم تعليق اشتراكك في المنصة. تواصل مع الإدارة.</p>
      </div>
    </div>
  );

  return <>{children}</>;
}
