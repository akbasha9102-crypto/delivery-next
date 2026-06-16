'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Bell, BellOff, LogOut, MessageCircle, MapPin, ChevronLeft, Loader2, CheckCircle2, Clock, TrendingUp, X, Check, Package } from 'lucide-react';

type Order = {
  id: string;
  client_name: string;
  client_phone: string;
  delivery_address: string | null;
  total_amount: number;
  status: 'pending' | 'preparing' | 'pickup' | 'ready' | 'completed';
  created_at: string;
};

type Session = { id: string; name: string; phone: string };

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(b64: string) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64  = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from([...atob(base64)].map(c => c.charCodeAt(0)));
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return `${diff} ث`;
  if (diff < 3600) return `${Math.floor(diff / 60)} د`;
  return `${Math.floor(diff / 3600)} س`;
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getRejected(driverId: string): string[] {
  try { return JSON.parse(localStorage.getItem(`rejected_${driverId}`) || '[]'); }
  catch { return []; }
}
function addRejected(driverId: string, orderId: string) {
  const list = getRejected(driverId);
  if (!list.includes(orderId)) {
    localStorage.setItem(`rejected_${driverId}`, JSON.stringify([...list, orderId]));
  }
}

export default function DriverDashboard() {
  const router = useRouter();
  const [session,     setSession]     = useState<Session | null>(null);
  const [incoming,    setIncoming]    = useState<Order[]>([]);
  const [active,      setActive]      = useState<Order[]>([]);
  const [completed,   setCompleted]   = useState<Order[]>([]);
  const [notifStatus,   setNotifStatus]   = useState<NotificationPermission>('default');
  const [subscribing,   setSubscribing]   = useState(false);
  const [accepting,     setAccepting]     = useState<string | null>(null);
  const [flashId,       setFlashId]       = useState<string | null>(null);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [isAvailable,   setIsAvailable]   = useState(true);
  const [togglingAvail, setTogglingAvail] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = (navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('ios_pwa_dismissed');
    if (isIOS && !isStandalone && !dismissed) setShowIOSBanner(true);
  }, []);

  useEffect(() => { setInterval(() => {}, 60_000); }, []);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('driver_session') : null;
    if (!raw) { router.replace('/driver'); return; }
    const s = JSON.parse(raw) as Session;
    setSession(s);
    sessionRef.current = s;
  }, [router]);

  useEffect(() => {
    if (!session) return;
    supabase.from('drivers').select('status').eq('id', session.id).single()
      .then(({ data }) => { if (data) setIsAvailable(data.status === 'available'); });
  }, [session]);

  const fetchIncoming = useCallback((driverId: string) => {
    const rejected = getRejected(driverId);
    supabase
      .from('orders')
      .select('id, client_name, client_phone, delivery_address, total_amount, status, created_at')
      .eq('status', 'preparing')
      .is('driver_id', null)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const filtered = ((data as Order[]) || []).filter(o => !rejected.includes(o.id));
        setIncoming(filtered);
      });
  }, []);

  const fetchActive = useCallback((driverId: string) => {
    supabase
      .from('orders')
      .select('id, client_name, client_phone, delivery_address, total_amount, status, created_at')
      .eq('driver_id', driverId)
      .in('status', ['preparing', 'pickup', 'ready'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setActive((data as Order[]) || []));
  }, []);

  const fetchCompleted = useCallback((driverId: string) => {
    supabase
      .from('orders')
      .select('id, client_name, client_phone, delivery_address, total_amount, status, created_at')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .gte('created_at', todayStart())
      .order('created_at', { ascending: false })
      .then(({ data }) => setCompleted((data as Order[]) || []));
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

    fetchIncoming(session.id);
    fetchActive(session.id);
    fetchCompleted(session.id);

    // real-time: طلبات جديدة (pending بلا سائق)
    const chIncoming = supabase.channel('driver-incoming')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        const s = sessionRef.current;
        if (s) { fetchIncoming(s.id); fetchActive(s.id); fetchCompleted(s.id); }
      })
      .subscribe();

    return () => { supabase.removeChannel(chIncoming); };
  }, [session, fetchIncoming, fetchActive, fetchCompleted]);

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
    // On iOS non-PWA, Notification API is unavailable — show install prompt instead
    if (typeof Notification === 'undefined' || !('PushManager' in window)) {
      setShowIOSBanner(true);
      return;
    }
    setSubscribing(true);
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
    if (perm === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      await subscribeToPush(session.id, reg);
    }
    setSubscribing(false);
  };

  const toggleAvailability = async () => {
    if (!session || togglingAvail) return;
    setTogglingAvail(true);
    const newStatus = isAvailable ? 'unavailable' : 'available';
    const { error } = await supabase.from('drivers').update({ status: newStatus }).eq('id', session.id);
    if (!error) setIsAvailable(!isAvailable);
    setTogglingAvail(false);
  };

  const acceptOrder = async (order: Order) => {
    if (!session || accepting) return;
    setAccepting(order.id);
    // نحاول نعين الطلب — فقط إذا لا يزال بلا سائق (race condition protection)
    const { data, error } = await supabase
      .from('orders')
      .update({
        driver_id:    session.id,
        driver_name:  session.name,
        driver_phone: session.phone,
      })
      .eq('id', order.id)
      .is('driver_id', null)
      .eq('status', 'preparing')
      .select('id')
      .single();

    if (error || !data) {
      // سبقه سائق آخر
      setFlashId(order.id);
      setTimeout(() => setFlashId(null), 2500);
      setIncoming(prev => prev.filter(o => o.id !== order.id));
    } else {
      await supabase.from('drivers').update({ status: 'unavailable' }).eq('id', session.id);
      setIsAvailable(false);
      setIncoming(prev => prev.filter(o => o.id !== order.id));
      fetchActive(session.id);
    }
    setAccepting(null);
  };

  const rejectOrder = (orderId: string) => {
    if (!session) return;
    addRejected(session.id, orderId);
    setIncoming(prev => prev.filter(o => o.id !== orderId));
  };

  const logout = () => {
    localStorage.removeItem('driver_session');
    router.replace('/driver');
  };

  if (!session) return null;

  const readyOrders    = active.filter(o => o.status === 'ready');
  const pickupOrders   = active.filter(o => o.status === 'pickup');
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
        {notifStatus === 'granted' ? (
          <div className="flex items-center gap-2">
            <p className={`text-xs font-bold ${isAvailable ? 'text-green-400' : 'text-red-400'}`}>
              {isAvailable ? 'متاح للطلبات' : 'غير متاح'}
            </p>
            <button
              onClick={toggleAvailability}
              disabled={togglingAvail}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 flex-shrink-0 disabled:opacity-60 ${
                isAvailable ? 'bg-green-500 shadow-md shadow-green-900/40' : 'bg-slate-600'
              }`}
            >
              {togglingAvail ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={14} className="animate-spin text-white" />
                </span>
              ) : (
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                  isAvailable ? 'translate-x-7' : 'translate-x-0.5'
                }`} />
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={enableNotifications}
            disabled={subscribing || notifStatus === 'denied'}
            className={`p-2 rounded-xl transition-all active:scale-90 ${
              notifStatus === 'denied' ? 'bg-red-900/30 text-red-400' : 'bg-amber-500 text-white'
            }`}
          >
            {subscribing ? <Loader2 size={17} className="animate-spin" /> :
             notifStatus === 'denied' ? <BellOff size={17} /> : <Bell size={17} />}
          </button>
        )}
      </header>

      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">

        {/* بانر تثبيت PWA على iOS */}
        {showIOSBanner && (
          <div className="bg-blue-950 border border-blue-700/60 rounded-2xl p-4 relative" dir="rtl">
            <button
              onClick={() => { setShowIOSBanner(false); localStorage.setItem('ios_pwa_dismissed', '1'); }}
              className="absolute top-3 left-3 text-blue-400 p-1 active:scale-90 transition-all"
            >
              <X size={16} />
            </button>
            <div className="flex gap-3 items-start">
              <span className="text-3xl leading-none mt-0.5">📲</span>
              <div className="flex-1">
                <p className="text-white font-black text-sm mb-2">فعّل الإشعارات على iPhone</p>
                <p className="text-blue-300 text-xs leading-6">
                  ١. اضغط على أيقونة <span className="font-bold text-white">المشاركة</span> <span className="text-base">⎙</span> في شريط Safari<br />
                  ٢. اختر <span className="font-bold text-white">"إضافة إلى الشاشة الرئيسية"</span><br />
                  ٣. افتح التطبيق من الشاشة الرئيسية<br />
                  ٤. اضغط على زر الجرس 🔔 لتفعيل الإشعارات
                </p>
                <p className="text-blue-400 text-xs mt-2">* يتطلب iOS 16.4 أو أحدث</p>
              </div>
            </div>
          </div>
        )}

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

        {/* ═══ طلبات جديدة ═══ */}
        {isAvailable && incoming.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <p className="text-blue-300 text-sm font-black">طلبات جديدة ({incoming.length})</p>
            </div>

            {incoming.map(order => (
              <div key={order.id}
                className={`rounded-3xl border-2 overflow-hidden transition-all ${
                  flashId === order.id
                    ? 'border-red-500 bg-red-900/30'
                    : 'border-blue-500/60 bg-slate-800'
                }`}>
                {flashId === order.id ? (
                  <div className="px-4 py-5 text-center">
                    <p className="text-red-300 font-black text-lg">⚡ استلمها سائق آخر!</p>
                    <p className="text-red-400 text-sm mt-1">الطلب لم يعد متاحاً</p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2 bg-blue-600/20 flex items-center justify-between border-b border-blue-500/20">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-blue-400" />
                        <span className="text-blue-300 text-xs">{timeAgo(order.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Package size={13} className="text-blue-400" />
                        <span className="text-blue-200 text-xs font-bold">طلب جديد</span>
                      </div>
                    </div>

                    <div className="px-4 py-3.5">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-green-400 font-black text-xl">
                          {order.total_amount.toLocaleString()}
                          <span className="text-xs font-normal text-slate-400"> د.ع</span>
                        </span>
                        <div className="text-right">
                          <p className="font-black text-white text-lg">{order.client_name}</p>
                          {order.delivery_address && (
                            <p className="text-slate-400 text-xs flex items-center gap-1 justify-end mt-0.5">
                              <MapPin size={10} /> {order.delivery_address}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => rejectOrder(order.id)}
                          disabled={accepting === order.id}
                          className="flex items-center justify-center gap-1.5 py-3 bg-slate-700 text-slate-300 font-bold rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-40">
                          <X size={17} /> رفض
                        </button>
                        <button
                          onClick={() => acceptOrder(order)}
                          disabled={!!accepting}
                          className="flex items-center justify-center gap-1.5 py-3 bg-blue-600 text-white font-black rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-60 shadow-lg shadow-blue-900/50">
                          {accepting === order.id
                            ? <Loader2 size={17} className="animate-spin" />
                            : <Check size={17} />
                          }
                          قبول
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* إحصائيات اليوم */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700/60 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 size={14} className="text-green-400" />
              <span className="text-slate-400 text-xs font-medium">توصيلات اليوم</span>
            </div>
            <p className="text-white font-black text-3xl">{completed.length}</p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700/60 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp size={14} className="text-green-400" />
              <span className="text-slate-400 text-xs font-medium">مجموع اليوم</span>
            </div>
            <p className="text-green-400 font-black text-2xl">{todayEarnings.toLocaleString()}</p>
            <p className="text-slate-500 text-xs">دينار</p>
          </div>
        </div>

        {/* طلبات "جاهز للاستلام" — الطلب جاهز في المطعم */}
        {pickupOrders.map(order => (
          <div key={order.id} className="bg-green-500 rounded-3xl overflow-hidden shadow-lg shadow-green-900/40">
            <div className="px-4 py-2 bg-green-600/50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-green-200" />
                <span className="text-green-200 text-xs">{timeAgo(order.created_at)}</span>
              </div>
              <span className="text-green-100 text-xs font-black">🍔 الطلب جاهز! اذهب للمطعم</span>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-green-900 font-black text-2xl">
                  {order.total_amount.toLocaleString()}
                  <span className="text-sm font-normal"> د.ع</span>
                </span>
                <div className="text-right">
                  <p className="font-black text-white text-xl">{order.client_name}</p>
                  {order.delivery_address && (
                    <p className="text-green-100 text-xs flex items-center gap-1 justify-end mt-0.5">
                      <MapPin size={10} /> {order.delivery_address}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {order.client_phone && (
                  <a href={`https://wa.me/${order.client_phone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white/20 text-white font-bold rounded-2xl text-sm active:scale-95 transition-all">
                    <MessageCircle size={16} /> واتساب
                  </a>
                )}
                <a href={`/delivery/${order.id}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-white text-green-600 font-black rounded-2xl text-sm active:scale-95 transition-all">
                  ابدأ <ChevronLeft size={16} />
                </a>
              </div>
            </div>
          </div>
        ))}

        {/* طلبات "جاهزة" — اذهب للمطعم الآن */}
        {readyOrders.map(order => (
          <div key={order.id} className="bg-amber-500 rounded-3xl overflow-hidden shadow-lg shadow-amber-900/40">
            <div className="px-4 py-2 bg-amber-600/50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-amber-200" />
                <span className="text-amber-200 text-xs">{timeAgo(order.created_at)}</span>
              </div>
              <span className="text-amber-100 text-xs font-black">🔔 اذهب للمطعم الآن</span>
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
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white/20 text-white font-bold rounded-2xl text-sm active:scale-95 transition-all">
                    <MessageCircle size={16} /> واتساب
                  </a>
                )}
                <a href={`/delivery/${order.id}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-white text-amber-600 font-black rounded-2xl text-sm active:scale-95 transition-all">
                  ابدأ <ChevronLeft size={16} />
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
                      <span className="text-green-400 font-black text-lg">
                        {order.total_amount.toLocaleString()}
                        <span className="text-xs font-normal text-slate-500"> د.ع</span>
                      </span>
                      <ChevronLeft size={16} className="text-slate-500" />
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* لا يوجد طلبات */}
        {active.length === 0 && pickupOrders.length === 0 && (isAvailable ? incoming.length === 0 : true) && (
          <div className="text-center py-14 space-y-3">
            {isAvailable ? (
              <>
                <p className="text-6xl">😴</p>
                <p className="text-slate-300 text-xl font-black">لا يوجد طلبات الآن</p>
                <p className="text-slate-500 text-sm">ستظهر الطلبات الجديدة هنا فوراً</p>
              </>
            ) : (
              <>
                <p className="text-6xl">⏸️</p>
                <p className="text-slate-300 text-xl font-black">أنت غير متاح حالياً</p>
                <p className="text-slate-500 text-sm">فعّل السويتش أعلاه لتستلم الطلبات</p>
              </>
            )}
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
                  <span className="text-green-500 font-bold text-sm">
                    {order.total_amount.toLocaleString()}
                    <span className="text-xs font-normal text-slate-600"> د.ع</span>
                  </span>
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
