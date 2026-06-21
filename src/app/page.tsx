'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const email = session.user.email || '';
        if (email.endsWith('@c.delivery')) {
          // زبون سجّل بالهاتف → نرجعه للمنيو
          const slug = localStorage.getItem('currentRestaurantSlug');
          if (slug) router.replace(`/menu/${slug}`);
          else router.replace('/home');
        } else {
          // أدمن → لوحة التحكم
          router.replace('/admin/dashboard');
        }
      } else {
        router.replace('/home');
      }
    });
  }, []);

  return <div className="h-full bg-gray-50 dark:bg-slate-900" />;
}
