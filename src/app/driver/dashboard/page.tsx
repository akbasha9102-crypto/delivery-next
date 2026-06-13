'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Bell, BellOff, LogOut, MessageCircle, MapPin, ChevronLeft, Loader2, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

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

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)  return `${diff} ث`;
  if (diff < 3600) return `${Math.floor(diff / 60)} د`;
  return `${Math.floor(diff / 3600)} س`;
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function DriverDashboard() {
  const router = useRouter();
  const [session,     setSession]     = useState<Session | null>(null);
  const [active,      setActive]      = useState<Order[]>([]);
  const [completed,   setCompleted]   = useState<Order[]>([]);
  const [notifStatus, setNotifStatus] = useState<NotificationPermission>('default');
  const [subscribing, setSubscribing] = useState(false);
  const [tick,        setTick]        = useState(0);

  // تحديث المؤقت كل دقيقة
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // تحميل الجلسة
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('driver_session') : null;
    if (!raw) { router.replace('/driver'); return; }
    setSession(JSON.parse(raw));
  }, [router]);

  const fetchOrders = useCallback(async (driverId: string) => {
    const [{ data: activeData }, { data: doneData }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, client_name, client_phone, delivery_address, total_amount, status, created_at')
        .eq('driver_id', driverId)
        .in('status', ['preparing', 'ready'])
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, client_name, client_phone, delivery_address, total_amount, status, created_at')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .gte('created_at', todayStart())
        .order('created_at', { ascending: false }),
    ]);
    setActive((activeData as Order[]) || []);
    setCompleted((doneData as Order[]) || []);
  }, []);

  useEffect(() => {
    if (!session) return;
    if ('Notification' in window) setNotifStatus(Notification.permission);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        if (Notification.permission === 'granted') {
          reg.pushManager.getSubscription().then(sub => {
            if (sub) saveSubscription(session.id, sub);
            else subscribeToPush(session.id, reg);
          });
        }
      }).catch(() => {});
    }
    fetchOrders(session.id);
    const ch = supabase.channel(`driver-orders-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `driver_id=eq.${session.id}` },
        () => fetchOrders(session.id))
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

  const readyOrders    = active.filter(o => o.status === 'ready');
  const preparingOrders = active.filter(o => o.status === 'preparing');
  const todayEarnings  = completed.reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-10">

      {/* هيدر */}
      <header className="sticky top-0 z-40 bg-slate-800/95 backdrop-blur border-b border-slate-700/60 px-4 py-3.5 flex items-center justify-between">
        <button onClick={logout} className="p-2 rounded-xl bg-slate-700 active:scale-90 transition-all">
          <LogOut size={17} className="text-slate-300" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">🏍️</span>
          <p className="font-black text-white text-base">{session.name}</p>
        </div>
        <button
          onClick={notifStatus === 'granted' ? undefined : enableNotifications}
          disabled={subscribing || notifStatus === 'denied'}
          className={`p-2 rounded-xl transition-all active:scale-90 ${
            notifStatus === 'granted'  ? 'bg-green-600/30 text-green-400' :
            notifStatus === 'denied'   ? 'bg-red-900/30 text-red-400' :
                                         'bg-amber-500 text-white'
          }`}
        >
          {subscribing ? <Loader2 size={17} className="animate-spin" /> :
           notifStatus === 'denied' ? <BellOff size={17} /> : <Bell size={17} />}
        </button>
      </header>

      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">

        {/* تنبيه الإشعارات */}
        {notifStatus === 'default' && (
          <button onClick={enableNotifications} disabled={subscribing}
            className="w-full py-3.5 bg-amber-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            {subscribing ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
            فعّل الإشعارات لتستلم الطلبات فوراً
          </button>
        )}
        {notifStatus === 'denied' && (
          <div className="bg-red-900/30 border border-red-700/60 rounded-2xl p-3.5 text-center text-red-300 text-sm">
            🔕 الإشعارات محظورة — افتح إعدادات المتصفح وأعط الإذن يدوياً
          </div>
        )}

        {/* إحصائيات اليوم */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700/60 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 size={15} className="text-green-400" />
              <span className="text-slate-400 text-xs font-medium">توصيلات اليوم</span>
            </div>
            <p className="text-white font-black text-3xl">{completed.length}</p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700/60 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp size={15} className="text-green-400" />
              <span className="text-slate-400 text-xs font-medium">مجموع اليوم</span>
            </div>
            <p className="text-green-400 font-black text-2xl">{todayEarnings.toLocaleString()}</p>
            <p className="text-slate-500 text-xs">دينار</p>
          </div>
        </div>

        {/* طلبات "جاهزة" — أولوية قصوى */}
        {readyOrders.map(order => (
          <div key={order.id} className="bg-amber-500 rounded-3xl overflow-hidden shadow-lg shadow-amber-900/40">
            <div className="px-4 py-2 bg-amber-600/50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-amber-200" />
                <span className="text-amber-200 text-xs font-medium">{timeAgo(order.created_at)}</span>
              </div>
              <span className="text-amber-100 text-xs font-black tracking-wide">🔔 اذهب للمطعم الآن</span>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-amber-900 font-black text-2xl">
                  {order.total_amount.toLocaleString()}
                  <span className="text-sm font-normal"> د.ع</span>
                </span>
                <div className="text-right">
                  <p className="font-black text-white text-xl">{order.client_name}</p>
                  {order.delivery_address && (
                    <p className="text-amber-100 text-xs flex items-center gap-1 justify-end mt-0.5">
                      <MapPin size={10} /> {order.delivery_address}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {order.client_phone && (
                  <a href={`https://wa.me/${order.client_phone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white/20 text-white font-bold rounded-xl text-sm active:scale-95 transition-all">
                    <MessageCircle size={16} /> واتساب
                  </a>
                )}
                <a href={`/delivery/${order.id}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-white text-amber-600 font-black rounded-xl text-sm active:scale-95 transition-all">
                  ابدأ التوصيل <ChevronLeft size={16} />
                </a>
              </div>
            </div>
          </div>
        ))}

        {/* طلبات قيد التجهيز */}
        {preparingOrders.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-slate-400 text-xs font-bold px-1">⏳ قيد التجهيز في المطعم</p>
            {preparingOrders.map(order => (
              <a key={order.id} href={`/delivery/${order.id}`}
                className="block bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden active:scale-[0.98] transition-all">
                <div className="h-1 bg-blue-500" />
                <div className="px-4 py-3.5">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <Clock size={12} />
                      <span>{timeAgo(order.created_at)}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-white text-lg">{order.client_name}</p>
                      {order.delivery_address && (
                        <p className="text-slate-400 text-xs flex items-center gap-1 justify-end mt-0.5">
                          <MapPin size={10} /> {order.delivery_address}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {order.client_phone && (
                      <a href={`https://wa.me/${order.client_phone.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/20 text-[#25D366] rounded-xl text-sm font-bold active:scale-95 transition-all">
                        <MessageCircle size={14} /> واتساب
                      </a>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 font-black text-lg">{order.total_amount.toLocaleString()} <span className="text-xs font-normal text-slate-500">د.ع</span></span>
                      <ChevronLeft size={16} className="text-slate-500" />
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* لا يوجد طلبات نشطة */}
        {active.length === 0 && (
          <div className="text-center py-14 space-y-3">
            <p className="text-6xl">😴</p>
            <p className="text-slate-300 text-xl font-black">لا يوجد طلبات الآن</p>
            <p className="text-slate-500 text-sm">ستظهر هنا فور تعيينك على طلب</p>
          </div>
        )}

        {/* توصيلات اليوم المكتملة */}
        {completed.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center gap-2 px-1">
              <CheckCircle2 size={14} className="text-green-400" />
              <p className="text-slate-400 text-xs font-bold">مكتملة اليوم ({completed.length})</p>
            </div>
            {completed.map(order => (
              <div key={order.id} className="bg-slate-800/50 rounded-2xl border border-slate-700/40 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                  <Clock size={11} />
                  <span>{timeAgo(order.created_at)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-500 font-bold text-sm">{order.total_amount.toLocaleString()} <span className="text-xs font-normal text-slate-600">د.ع</span></span>
                  <p className="text-slate-400 font-bold text-sm">{order.client_name}</p>
                  <CheckCircle2 size={15} className="text-green-600" />
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
