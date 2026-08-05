'use client';
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { NewOrdersProvider } from '@/context/NewOrdersContext';
import { AdminGuard } from '@/components/guards/AdminGuard';
import { useRestaurant } from '@/context/RestaurantContext';
import { StaffProvider } from '@/context/StaffContext';
import { StaffGate } from '@/components/guards/StaffGate';
import { SuperAdminNotificationsProvider } from '@/context/SuperAdminNotificationsContext';
import { SuperAdminMessageOverlay } from '@/components/staff/SuperAdminMessageOverlay';
import { ImpersonationBanner } from '@/components/impersonation/ImpersonationBanner';

function makeBellWavUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const sr = 22050, dur = 0.9, n = (sr * dur) | 0;
    const buf = new ArrayBuffer(44 + n * 2); const v = new DataView(buf);
    const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o+i, s.charCodeAt(i)); };
    ws(0,'RIFF'); v.setUint32(4,36+n*2,true); ws(8,'WAVE'); ws(12,'fmt '); v.setUint32(16,16,true);
    v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,sr,true); v.setUint32(28,sr*2,true);
    v.setUint16(32,2,true); v.setUint16(34,16,true); ws(36,'data'); v.setUint32(40,n*2,true);
    for (let i=0; i<n; i++) { const t=i/sr, hz=t<0.42?880:587, env=t<0.42?Math.exp(-t*4):Math.exp(-(t-0.42)*4); v.setInt16(44+i*2,(Math.sin(2*Math.PI*hz*t)*env*0.4*32767)|0,true); }
    return URL.createObjectURL(new Blob([buf], { type:'audio/wav' }));
  } catch { return null; }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { restaurantId } = useRestaurant();
  const bellRef         = useRef<HTMLAudioElement | null>(null);
  const initialDone     = useRef(false);

  useEffect(() => {
    const url = makeBellWavUrl(); if (!url) return;
    bellRef.current = new Audio(url); bellRef.current.volume = 0.8;
    const unlock = () => { bellRef.current?.play().then(() => { bellRef.current!.pause(); bellRef.current!.currentTime = 0; }).catch(() => {}); };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    // mark initial load done after short delay so we don't ring on page mount
    const t = setTimeout(() => { initialDone.current = true; }, 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase.channel('admin-layout-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: 'restaurant_id=eq.' + restaurantId }, ({ new: row }: any) => {
        if (!initialDone.current) return;
        // طلبات أنشأها موظف من داخل لوحة التحكم (كاشير محلي POS، أو مودال
        // "الطلب للزبون" السريع بالداشبورد) — الموظف هو من أنشأها بنفسه،
        // لا داعي لتنبيهه بجرس "طلب جديد" عن فعله الخاص. الجرس يجب أن يرنّ
        // فقط لطلبات الزبون الحقيقي من منيو الواجهة العامة (delivery أو
        // pickup تم إنشاؤهما من cart/page.tsx أو orders/page.tsx لدى الزبون).
        if (row?.created_by_staff) return;
        if (bellRef.current) { bellRef.current.currentTime = 0; bellRef.current.play().catch(() => {}); }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId]);

  return (
    <AdminGuard>
      <StaffProvider>
        <StaffGate>
          <NewOrdersProvider>
            <SuperAdminNotificationsProvider>
              <ImpersonationBanner />
              {children}
              <SuperAdminMessageOverlay />
            </SuperAdminNotificationsProvider>
          </NewOrdersProvider>
        </StaffGate>
      </StaffProvider>
    </AdminGuard>
  );
}
