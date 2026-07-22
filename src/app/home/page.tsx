'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LandingPage from './LandingPage';

export default function HomePage() {
  const router = useRouter();
  const [noSlug, setNoSlug] = useState(false);

  useEffect(() => {
    const slug = localStorage.getItem('currentRestaurantSlug');
    if (slug) {
      router.replace(`/menu/${slug}`);
    } else {
      setNoSlug(true);
    }
  }, [router]);

  if (!noSlug) return <div className="min-h-screen bg-gray-50 dark:bg-slate-950" />;

  return <LandingPage />;
}
