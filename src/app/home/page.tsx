'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const slug = localStorage.getItem('currentRestaurantSlug');
    if (slug) {
      router.replace(`/menu/${slug}`);
    }
  }, [router]);

  return <div className="min-h-screen bg-gray-50 dark:bg-slate-950" />;
}
