'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/super-admin/login'); return; }
      const role = session.user.user_metadata?.role;
      const email = session.user.email;
      const superEmail = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;
      const isSuperAdmin = role === 'super_admin' || (superEmail && email === superEmail);
      if (!isSuperAdmin) { router.replace('/super-admin/login'); return; }
      setOk(true);
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/super-admin/login');
    });
    return () => subscription.unsubscribe();
  }, [router]);

  if (!ok) return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return <>{children}</>;
}
