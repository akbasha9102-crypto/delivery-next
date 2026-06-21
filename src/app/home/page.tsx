'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-6xl">🍽️</div>
      <h1 className="text-xl font-black text-gray-900 dark:text-white">لم يتم تحديد المطعم</h1>
      <p className="text-gray-500 dark:text-slate-400 text-sm">
        يرجى الوصول للموقع عن طريق رابط المطعم المخصص
      </p>
    </div>
  );
}
