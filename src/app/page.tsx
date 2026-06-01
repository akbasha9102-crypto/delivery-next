'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/admin/dashboard');
      else router.replace('/home');
    });
  }, []);

  return <div className="h-full bg-gray-50 dark:bg-slate-900" />;
}
