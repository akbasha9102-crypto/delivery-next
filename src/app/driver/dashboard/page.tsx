'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Bell, BellOff, LogOut, Phone, MapPin, ChevronRight, Loader2 } from 'lucide-react';

type Order = {
  id: string;
  client_name: string;
  client_phone: string;
  delivery_address: string | null;
  total_amount: number;
  status: 'preparing' | 'ready' | 'completed';
  created_at: string;
};

type Session = { id: string; name: string };

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(b64: string) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64  = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from([...atob(base64)].map(c => c.charCodeAt(0)));
}

const STATUS_LABEL: Record<string, string> = {
  preparing: 'قيد التجهيز',
  ready:     'جاهز — اذهب للمطعم',
  completed: 'مكتمل',
};
const STATUS_COLOR: Record<string, string> = {
  preparing: 'bg-blue-500',
  ready:     'bg-green-500',
  completed: 'bg-gray-400',
};

export default function DriverDashboard() {
  const router  = useRouter();
  const [session,      setSession]      = useState<Session | null>(null);
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [notifStatus,  setNotifStatus]  = useState<NotificationPermission>('default');
  const [subscribing,  setSubscribing]  = useState(false);

  // تحميل الجلسة
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('driver_session') : null;
    if (!raw) { router.replace('/driver'); return; }
    setSession(JSON.parse(raw));
  }, [router]);

  // جلب الطلبات النشطة
  const fetchOrders = useCallback(async (driverId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('id, client_name, client_phone, delivery_address, total_amount, status, created_at')
      .eq('driver_id', driverId)
      .in('status', ['preparing', 'ready'])
      .order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
  }, []);

  // تسجيل SW وتحميل الطلبات
  useEffect(() => {
    if (!session) return;

    // تحقق من إذن الإشعارات الحالي
    if ('Notification' in window) setNotifStatus(Notification.permission);

    // سجّل الـ service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        // لو الإذن موجود مسبقاً، جدّد الاشتراك تلقائياً
        if (Notification.permission === 'granted') {
          reg.pushManager.getSubscription().then(sub => {
            if (sub) saveSubscription(session.id, sub);
            else subscribeToPush(session.id, reg);
          });
        }
      }).catch(() => {});
    }

    fetchOrders(session.id);

    // realtime للطلبات
    const ch = supabase.channel(`driver-orders-${session.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `driver_id=eq.${session.id}`,
      }, () => fetchOrders(session.id))
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [session, fetchOrders]);

  async function saveSubscription(driverId: string, sub: PushSubscription) {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_id: driverId, subscription: sub.toJSON() }),
    });
  }

  async function subscribeToPush(driverId: string, reg: ServiceWorkerRegistration) {
    try {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await saveSubscription(driverId, sub);
    } catch {}
  }

  const enableNotifications = async () => {
    if (!session) return;
    setSubscribing(true);
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
    if (perm === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      await subscribeToPush(session.id, reg);
    }
    setSubscribing(false);
  };

  const logout = () => {
    localStorage.removeItem('driver_session');
    router.replace('/driver');
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-800 border-b border-slate-700 px-4 py-4 flex items-center justify-between">
        <button onClick={logout} className="p-2 rounded-xl bg-slate-700 active:scale-90 transition-all">
          <LogOut size={18} className="text-slate-300" />
        </button>
        <div className="text-center">
          <p className="font-black text-white text-lg">🏍️ {session.name}</p>
        </div>
        <button
          onClick={notifStatus === 'granted' ? undefined : enableNotifications}
          disabled={subscribing || notifStatus === 'denied'}
          className={`p-2 rounded-xl transition-all active:scale-90 ${
            notifStatus === 'granted'
              ? 'bg-green-600/30 text-green-400'
              : notifStatus === 'denied'
              ? 'bg-red-900/30 text-red-400'
              : 'bg-amber-500 text-white'
          }`}
          title={notifStatus === 'granted' ? 'الإشعارات مفعّلة' : notifStatus === 'denied' ? 'محظور من الإعدادات' : 'فعّل الإشعارات'}
        >
          {subscribing
            ? <Loader2 size={18} className="animate-spin" />
            : notifStatus === 'denied'
            ? <BellOff size={18} />
            : <Bell size={18} />
          }
        </button>
      </header>

      <div className="px-4 pt-5 space-y-4 max-w-lg mx-auto">
        {/* إشعار تفعيل */}
        {notifStatus === 'default' && (
          <button
            onClick={enableNotifications}
            disabled={subscribing}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {subscribing ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
            فعّل الإشعارات لتستلم الطلبات فورياً
          </button>
        )}
        {notifStatus === 'denied' && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 text-center text-red-300 text-sm">
            الإشعارات محظورة — افتح إعدادات المتصفح وأعط الإذن يدوياً
          </div>
        )}

        {/* قائمة الطلبات */}
        {orders.length === 0 ? (
          <div className="text-center mt-20 space-y-3">
            <p className="text-6xl">😴</p>
            <p className="text-slate-400 text-lg font-bold">لا يوجد طلبات الآن</p>
            <p className="text-slate-500 text-sm">ستظهر هنا فور تعيينك على طلب</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-400 text-sm text-right font-medium">طلباتك النشطة ({orders.length})</p>
            {orders.map(order => (
              <a
                key={order.id}
                href={`/delivery/${order.id}`}
                className="block bg-slate-800 rounded-2xl p-4 border border-slate-700 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ChevronRight size={18} className="text-slate-400" />
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${STATUS_COLOR[order.status]}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>
                  <p className="font-black text-white text-lg">{order.client_name}</p>
                </div>
                <div className="space-y-1.5 text-right">
                  {order.delivery_address && (
                    <p className="text-slate-400 text-sm flex items-center gap-1 justify-end">
                      <span>{order.delivery_address}</span>
                      <MapPin size={12} className="flex-shrink-0" />
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <a
                      href={`tel:${order.client_phone}`}
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-sm font-bold active:scale-95 transition-all"
                    >
                      <Phone size={14} /> اتصال
                    </a>
                    <p className="text-green-400 font-black text-lg">
                      {order.total_amount.toLocaleString()} <span className="text-xs font-normal text-slate-500">د.ع</span>
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
