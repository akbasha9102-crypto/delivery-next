'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurant } from '@/context/RestaurantContext';
import { useSettings } from '@/context/SettingsContext';
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner';

/**
 * حارس صفحات "الباقة المحترفين فقط" — يمنع الوصول البصري والملاحي معاً
 * لمطعم بباقة standard، على نمط OwnerOnly:
 * - لا يعرض المحتوى قبل تأكيد الباقة من مصدر شبكي حي (RestaurantContext،
 *   المُعبَّأ من /api/admin/my-restaurant بلا أي كاش) — وليس من كاش
 *   SettingsContext المحلي (localStorage rs_settings_v2_*)، تفادياً لنفس
 *   فئة الثغرة الموثّقة بـ next.config.ts (إزالة staleTimes سابقاً لنفس السبب).
 * - يراقب تبديل الباقة حيّاً أثناء الجلسة عبر useSettings (نفس قناة
 *   postgres_changes)، بنمط "تشديد فقط، لا تخفيف" (liveBlocked أحادي
 *   الاتجاه) — يطابق تعامل AdminGuard مع is_suspended.
 * - يتجاوز القيد كلياً في preview mode لسوبر أدمن (نفس سلوك AdminGuard
 *   الحالي مع is_suspended).
 */
export function RequireProfessionalPackage({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { subscriptionTier, isSuperAdminPreview } = useRestaurant();
  const { subscription_tier: liveTier } = useSettings();
  const [liveBlocked, setLiveBlocked] = useState(false);

  const checking = !isSuperAdminPreview && subscriptionTier === null;

  useEffect(() => {
    if (!checking && liveTier === 'standard') setLiveBlocked(true);
  }, [checking, liveTier]);

  const blocked = !isSuperAdminPreview && (subscriptionTier === 'standard' || liveBlocked);

  useEffect(() => {
    if (!checking && blocked) router.replace('/admin/settings');
  }, [checking, blocked, router]);

  if (!isSuperAdminPreview && (checking || blocked)) return <FullScreenSpinner />;

  return <>{children}</>;
}
