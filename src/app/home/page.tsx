'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LandingPage from './LandingPage';
import { getPendingSignup } from '@/lib/pendingSignup';

export default function HomePage() {
  const router = useRouter();
  const [noSlug, setNoSlug] = useState(false);

  useEffect(() => {
    const slug = localStorage.getItem('currentRestaurantSlug');
    if (slug) {
      router.replace(`/menu/${slug}`);
      return;
    }
    if (getPendingSignup()) {
      router.replace('/track-signup');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only localStorage check on mount, no external system to defer to
    setNoSlug(true);
  }, [router]);

  if (!noSlug) return <div className="min-h-screen bg-gray-50 dark:bg-slate-950" />;

  return <LandingPage />;
}
