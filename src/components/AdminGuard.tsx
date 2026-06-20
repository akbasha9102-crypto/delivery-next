'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking,   setChecking]   = useState(true);
  const [suspended,  setSuspended]  = useState(false);

  useEffect(() => {
    const run = async () => {
      // Super admin preview mode — bypass normal auth
      const previewRes = await fetch('/api/super-admin/preview-check').catch(() => null);
      if (previewRes?.ok) {
        const { ok } = await previewRes.json().catch(() => ({ ok: false }));
        if (ok) { setChecking(false); return; }
      }

      // Normal Supabase auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }

      // Check if restaurant is suspended by super admin
      const { data: rs } = await supabase
        .from('restaurant_settings')
        .select('is_suspended')
        .limit(1)
        .maybeSingle();

      if (rs?.is_suspended) { setSuspended(true); setChecking(false); return; }

      setChecking(false);
    };

    run();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/login');
    });
    return () => subscription.unsubscribe();
  }, [router]);

  if (checking) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
    </div>
  );

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
