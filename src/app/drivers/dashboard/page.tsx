'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { Bell, BellOff, LogOut, MessageCircle, MapPin, ChevronLeft, Loader2, CheckCircle2, Clock, TrendingUp, X, Check, Package } from 'lucide-react';
import DriverHeader from '../_components/DriverHeader';
import MapSheet from '../_components/MapSheet';



type Order = {
  id: string;
  client_name: string;
  client_phone: string;
  delivery_address: string | null;
  total_amount: number;
  status: 'pending' | 'preparing' | 'pickup' | 'ready' | 'completed';
  created_at: string;
  last_edit_id: string | null;
  kitchen_ready_at: string | null;
};

type DriverOrdersRealtimeRow = { id: string; status: string; last_edit_id: string | null; driver_id: string | null };

type Session = { id: string; name: string; phone: string; restaurantId: string };

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

// تصنيف حدث realtime واحد بمقارنته بآخر حالة معروفة محلياً (knownActiveStateRef)
// — يعنينا فقط طلبات هذا السائق (driver_id) التي كانت preparing سابقاً.
function classifyDriverOrderEvent(
  cache: Map<string, { status: string; last_edit_id: string | null }>,
  driverId: string,
  row: DriverOrdersRealtimeRow
): 'edited' | 'cancelled' | 'ignore' {
  if (row.driver_id !== driverId) return 'ignore';
  const prev = cache.get(row.id);
  if (!prev) return 'ignore';
  if (prev.status === 'preparing' && row.status === 'rejected') return 'cancelled';
  if (prev.status === 'preparing' && row.status === 'preparing' && row.last_edit_id && row.last_edit_id !== prev.last_edit_id) return 'edited';
  return 'ignore';
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const INCOMING_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 ساعات — طلبات preparing أقدم من هذا لا تُعرض كـ"طلبات جديدة" (تبقى بلوحة الإدارة)
function incomingCutoff() {
  return new Date(Date.now() - INCOMING_MAX_AGE_MS).toISOString();
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
  const [mapAddress,    setMapAddress]    = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const knownActiveStateRef = useRef<Map<string, { status: string; last_edit_id: string | null }>>(new Map());
  const activeRef = useRef<Order[]>([]);

  // شارة "تم تعديل الطلب" — تُخفى بعد ضغط السائق عليها لهذا last_edit_id تحديداً
  const [dismissedEdits, setDismissedEdits] = useState<Map<string, string>>(new Map());

  // طلبات أُلغيت من الإدارة وسائق لم يطّلع عليها بعد — تبقى ظاهرة حتى يضغط "تم الاطلاع"
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = (navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('ios_pwa_dismissed');
    if (isIOS && !isStandalone && !dismissed) setShowIOSBanner(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) { router.replace('/drivers'); return; }

      // بحث السائق المرتبط بهذه الجلسة عبر user_id — RLS (is_own_driver_row)
      // يسمح للسائق برؤية صفّه هو فقط، وليس أي سائق آخر.
      const { data: driver } = await supabase
        .from('drivers')
        .select('id, name, phone, restaurant_id')
        .eq('user_id', authSession.user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!driver) { await supabase.auth.signOut(); router.replace('/drivers'); return; }

      const s: Session = { id: driver.id, name: driver.name, phone: driver.phone, restaurantId: driver.restaurant_id };
      setSession(s);
      sessionRef.current = s;
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!session) return;
    supabase.from('drivers').select('status').eq('id', session.id).single()
      .then(({ data }) => { if (data) setIsAvailable(data.status === 'available'); });
  }, [session]);

  useEffect(() => { activeRef.current = active; }, [active]);

  const fetchIncoming = useCallback((driverId: string) => {
    const rejected = getRejected(driverId);
    supabase
      .from('orders')
      .select('id, client_name, client_phone, delivery_address, total_amount, status, created_at, kitchen_ready_at')
      .eq('status', 'preparing')
      .is('driver_id', null)
      // طلبات داخلي/سفري/كاشير محلي ليس لها سائق إطلاقاً — تُستبعد من قائمة السائقين
      .or('order_type.is.null,order_type.eq.delivery')
      .gte('created_at', incomingCutoff())
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const filtered = ((data as Order[]) || []).filter(o => !rejected.includes(o.id));
        setIncoming(filtered);
      });
  }, []);

  const fetchActive = useCallback((driverId: string) => {
    supabase
      .from('orders')
      .select('id, client_name, client_phone, delivery_address, total_amount, status, created_at, last_edit_id')
      .eq('driver_id', driverId)
      .in('status', ['preparing', 'pickup', 'ready'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data as Order[]) || [];
        setActive(rows);
        rows.forEach(r => knownActiveStateRef.current.set(r.id, { status: r.status, last_edit_id: r.last_edit_id }));
      });
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

  // معالجة حدث realtime واحد على جدول orders — يصنّف الحدث (ألغي/عُدّل) بمقارنته
  // بالحالة المعروفة محلياً قبل استدعاء fetchActive (الذي سيستبدل تلك الحالة المعروفة).
  const handleDriverOrderEvent = useCallback((row: DriverOrdersRealtimeRow) => {
    const s = sessionRef.current;
    if (!s) return;

    const kind = classifyDriverOrderEvent(knownActiveStateRef.current, s.id, row);

    if (kind === 'cancelled') {
      const snapshot = activeRef.current.find(o => o.id === row.id);
      if (snapshot) setCancelledOrders(prev => [...prev.filter(o => o.id !== row.id), snapshot]);
    }
    // 'edited' needs no immediate action here — the badge is derived directly
    // from order.last_edit_id vs dismissedEdits at render time (see 3f), and
    // active state will carry the new last_edit_id once fetchActive resolves below.

    if (row.driver_id === s.id && (row.status === 'preparing' || row.status === 'pickup' || row.status === 'ready')) {
      knownActiveStateRef.current.set(row.id, { status: row.status, last_edit_id: row.last_edit_id });
    } else if (row.driver_id === s.id) {
      knownActiveStateRef.current.delete(row.id);
    }

    fetchIncoming(s.id);
    fetchActive(s.id);
    fetchCompleted(s.id);
  }, [fetchIncoming, fetchActive, fetchCompleted]);

  useEffect(() => {
    if (!session) return;
    if ('Notification' in window) setNotifStatus(Notification.permission);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        if (Notification.permission === 'granted') {
          reg.pushManager.getSubscription().then(async sub => {
            if (sub) {
              const currentKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
              const appServerKey = sub.options.applicationServerKey;
              const subKey = appServerKey ? new Uint8Array(appServerKey) : null;
              const matches = !!subKey && subKey.length === currentKey.length && subKey.every((b, i) => b === currentKey[i]);
              if (matches) {
                saveSubscription(session.id, sub);
              } else {
                await sub.unsubscribe();
                subscribeToPush(session.id, reg);
              }
            } else {
              subscribeToPush(session.id, reg);
            }
          });
        }
      }).catch(() => {});
    }

    fetchIncoming(session.id);
    fetchActive(session.id);
    fetchCompleted(session.id);

    // real-time: طلبات جديدة (pending بلا سائق) — فلترة بمعرّف المطعم إلزامية،
    // بدونها يعيد كل سائق بكل مطاعم المنصة جلب طلباته عند أي تحديث بأي مطعم آخر
    // (خطأ #25 بتقرير الفحص)
    const chIncoming = supabase.channel('driver-incoming')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${session.restaurantId}` }, (payload) => {
        handleDriverOrderEvent(payload.new as DriverOrdersRealtimeRow);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${session.restaurantId}` }, (payload) => {
        handleDriverOrderEvent(payload.new as DriverOrdersRealtimeRow);
      })
      .subscribe();

    return () => { supabase.removeChannel(chIncoming); };
  }, [session, fetchIncoming, fetchActive, fetchCompleted, handleDriverOrderEvent]);

  async function saveSubscription(driverId: string, sub: PushSubscription) {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token ?? ''}` },
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

    const update: {
      driver_id: string;
      driver_name: string;
      driver_phone: string;
      status?: 'pickup';
    } = {
      driver_id:    session.id,
      driver_name:  session.name,
      driver_phone: session.phone,
    };
    // المطبخ خلّص التجهيز قبل ما يقبل أي سائق (kitchen_ready_at موجود مسبقاً) —
    // ننتقل مباشرة لحالة "جاهز، اذهب للمطعم" بنفس الاستدعاء بدل الانتظار
    // لحدث لاحق لن يأتي أبداً (markReady لا يُعاد تشغيله لكل طلب إلا مرة واحدة).
    if (order.kitchen_ready_at) {
      update.status = 'pickup';
    }

    // نحاول نعين الطلب — فقط إذا لا يزال بلا سائق (race condition protection)
    const { data, error } = await supabase
      .from('orders')
      .update(update)
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

  const clearAllIncoming = () => {
    if (!session || incoming.length === 0) return;
    incoming.forEach(o => addRejected(session.id, o.id));
    setIncoming([]);
  };

  const logout = () => {
    supabase.auth.signOut().finally(() => router.replace('/drivers'));
  };

  if (!session) return null;

  const readyOrders    = active.filter(o => o.status === 'ready');
  const pickupOrders   = active.filter(o => o.status === 'pickup');
  const preparingOrders = active.filter(o => o.status === 'preparing');
  const todayEarnings  = completed.reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">

      {/* هيدر */}
      <DriverHeader
        right={
          <button onClick={logout} className="p-2.5 rounded-xl bg-slate-800 active:scale-90 transition-all">
            <LogOut size={17} className="text-slate-300" />
          </button>
        }
        center={
          <>
            <span className="text-xl">🏍️</span>
            <p className="font-extrabold text-white text-base">{session.name}</p>
          </>
        }
        left={
          notifStatus === 'granted' ? (
            <div className="flex items-center gap-2">
              <p className={`text-xs font-medium ${isAvailable ? 'text-green-400' : 'text-red-400'}`}>
                {isAvailable ? 'متاح للطلبات' : 'غير متاح'}
              </p>
              <button
                onClick={toggleAvailability}
                disabled={togglingAvail}
                className={`relative w-16 h-8 rounded-full transition-colors duration-300 flex-shrink-0 disabled:opacity-60 ${
                  isAvailable ? 'bg-gradient-to-r from-green-500 to-green-400 shadow-md shadow-green-900/40' : 'bg-slate-700'
                }`}
              >
                {togglingAvail ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={15} className="animate-spin text-white" />
                  </span>
                ) : (
                  <motion.span
                    className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md"
                    animate={{ x: isAvailable ? 32 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={enableNotifications}
              disabled={subscribing || notifStatus === 'denied'}
              className={`p-2.5 rounded-xl transition-all active:scale-90 ${
                notifStatus === 'denied' ? 'bg-red-900/30 text-red-400' : 'bg-amber-500 text-white'
              }`}
            >
              {subscribing ? <Loader2 size={17} className="animate-spin" /> :
               notifStatus === 'denied' ? <BellOff size={17} /> : <Bell size={17} />}
            </button>
          )
        }
      />

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
                <p className="text-white font-extrabold text-sm mb-2">فعّل الإشعارات على iPhone</p>
                <p className="text-blue-300 text-xs leading-6">
                  ١. اضغط على أيقونة <span className="font-extrabold text-white">المشاركة</span> <span className="text-base">⎙</span> في شريط Safari<br />
                  ٢. اختر <span className="font-extrabold text-white">"إضافة إلى الشاشة الرئيسية"</span><br />
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
            className="w-full py-3.5 bg-amber-500 text-white font-medium rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
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
              <p className="text-blue-300 text-sm font-extrabold flex-1">طلبات جديدة ({incoming.length})</p>
              <button
                onClick={clearAllIncoming}
                className="text-slate-400 text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800 active:scale-95 transition-all"
              >
                تجاهل الكل
              </button>
            </div>

            <AnimatePresence>
              {incoming.map(order => (
                <motion.div key={order.id}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, x: -40 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  className={`rounded-3xl border-2 overflow-hidden ${
                    flashId === order.id
                      ? 'border-red-500 bg-red-900/30'
                      : 'border-blue-500/60 bg-slate-900'
                  }`}>
                  {flashId === order.id ? (
                    <div className="px-4 py-5 text-center">
                      <p className="text-red-300 font-extrabold text-lg">⚡ استلمها سائق آخر!</p>
                      <p className="text-red-400 text-sm mt-1">الطلب لم يعد متاحاً</p>
                    </div>
                  ) : (
                    <>
                      <div className={`px-4 py-2 flex items-center justify-between border-b ${
                        order.kitchen_ready_at
                          ? 'bg-green-600/20 border-green-500/20'
                          : 'bg-blue-600/20 border-blue-500/20'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className={order.kitchen_ready_at ? 'text-green-400' : 'text-blue-400'} />
                          <span className={`text-xs ${order.kitchen_ready_at ? 'text-green-300' : 'text-blue-300'}`}>{timeAgo(order.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Package size={13} className={order.kitchen_ready_at ? 'text-green-400' : 'text-blue-400'} />
                          <span className={`text-xs font-medium ${order.kitchen_ready_at ? 'text-green-200' : 'text-blue-200'}`}>
                            {order.kitchen_ready_at ? 'تم التجهيز ✓' : 'طلب جديد'}
                          </span>
                        </div>
                      </div>

                      <div className="px-4 py-3.5">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-green-400 font-extrabold text-xl">
                            {order.total_amount.toLocaleString()}
                            <span className="text-xs font-normal text-slate-400"> د.ع</span>
                          </span>
                          <div className="text-right">
                            <p className="font-extrabold text-white text-lg">{order.client_name}</p>
                            {order.delivery_address && (
                              <button
                                onClick={() => setMapAddress(order.delivery_address!)}
                                className="flex items-center gap-1 justify-end mt-0.5 w-full text-slate-400 text-xs active:opacity-70"
                              >
                                <MapPin size={10} /> {order.delivery_address}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => rejectOrder(order.id)}
                            disabled={accepting === order.id}
                            className="flex items-center justify-center gap-1.5 py-3 bg-slate-800 text-slate-300 font-medium rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-40">
                            <X size={17} /> رفض
                          </button>
                          <button
                            onClick={() => acceptOrder(order)}
                            disabled={!!accepting}
                            className="flex items-center justify-center gap-1.5 py-3 bg-blue-600 text-white font-extrabold rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-60 shadow-lg shadow-blue-900/50">
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
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* طلبات "جاهز للاستلام" — الطلب جاهز في المطعم */}
        {pickupOrders.map(order => (
          <div key={order.id} className="bg-green-500 rounded-3xl overflow-hidden shadow-lg shadow-green-900/40">
            <div className="px-4 py-2 bg-green-600/50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-green-200" />
                <span className="text-green-200 text-xs">{timeAgo(order.created_at)}</span>
              </div>
              <span className="text-green-100 text-xs font-extrabold">🍔 الطلب جاهز! اذهب للمطعم</span>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-green-900 font-extrabold text-2xl">
                  {order.total_amount.toLocaleString()}
                  <span className="text-sm font-normal"> د.ع</span>
                </span>
                <div className="text-right">
                  <p className="font-extrabold text-white text-xl">{order.client_name}</p>
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
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white/20 text-white font-medium rounded-2xl text-sm active:scale-95 transition-all">
                    <MessageCircle size={16} /> واتساب
                  </a>
                )}
                <a href={`/delivery/${order.id}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-white text-green-600 font-extrabold rounded-2xl text-sm active:scale-95 transition-all">
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
              <span className="text-amber-100 text-xs font-extrabold">🔔 اذهب للمطعم الآن</span>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-amber-900 font-extrabold text-2xl">
                  {order.total_amount.toLocaleString()}
                  <span className="text-sm font-normal"> د.ع</span>
                </span>
                <div className="text-right">
                  <p className="font-extrabold text-white text-xl">{order.client_name}</p>
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
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white/20 text-white font-medium rounded-2xl text-sm active:scale-95 transition-all">
                    <MessageCircle size={16} /> واتساب
                  </a>
                )}
                <a href={`/delivery/${order.id}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-white text-amber-600 font-extrabold rounded-2xl text-sm active:scale-95 transition-all">
                  ابدأ <ChevronLeft size={16} />
                </a>
              </div>
            </div>
          </div>
        ))}

        {/* إحصائيات اليوم */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 size={14} className="text-green-400" />
              <span className="text-slate-400 text-xs font-medium">توصيلات اليوم</span>
            </div>
            <p className="text-white font-black text-3xl">{completed.length}</p>
          </div>
          <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp size={14} className="text-green-400" />
              <span className="text-slate-400 text-xs font-medium">مجموع اليوم</span>
            </div>
            <p className="text-green-400 font-black text-2xl">{todayEarnings.toLocaleString()}</p>
            <p className="text-slate-500 text-xs">دينار</p>
          </div>
        </div>

        {/* طلبات أُلغيت من الإدارة — تبقى ظاهرة حتى يضغط السائق "تم الاطلاع" */}
        {cancelledOrders.length > 0 && (
          <div className="space-y-2.5">
            {cancelledOrders.map(order => (
              <div key={order.id} className="bg-red-950/40 border border-red-700/60 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-right">
                    <p className="font-extrabold text-white text-base">{order.client_name}</p>
                    <p className="text-red-300 text-xs font-bold mt-0.5">🚫 تم إلغاء هذا الطلب من الإدارة</p>
                  </div>
                  <button
                    onClick={() => setCancelledOrders(prev => prev.filter(o => o.id !== order.id))}
                    className="flex-shrink-0 px-3 py-2 rounded-xl bg-red-900/60 text-red-200 text-xs font-bold active:scale-95 transition-all"
                  >
                    تم الاطلاع
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* طلبات قيد التجهيز */}
        {preparingOrders.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-slate-400 text-xs font-medium px-1">⏳ قيد التجهيز في المطعم</p>
            {preparingOrders.map(order => (
              <div key={order.id}
                className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="h-1 bg-blue-500" />
                <div className="px-4 py-4">
                  {/* وقت + رابط تفاصيل + شارة "تم التعديل" */}
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <a href={`/delivery/${order.id}`}
                      className="flex items-center gap-1 text-blue-400 text-xs active:scale-95 transition-all flex-shrink-0">
                      تفاصيل <ChevronLeft size={12} />
                    </a>
                    <div className="flex items-center gap-2">
                      {order.last_edit_id && dismissedEdits.get(order.id) !== order.last_edit_id && (
                        <button
                          onClick={() => setDismissedEdits(prev => new Map(prev).set(order.id, order.last_edit_id!))}
                          className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-900/40 text-amber-300 active:scale-95 transition-all"
                        >
                          ✏️ تم تعديل الطلب — راجع التفاصيل
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs flex-shrink-0">
                        <Clock size={12} />
                        <span>{timeAgo(order.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* الاسم — كبير */}
                  <p className="font-extrabold text-white text-2xl text-right mb-2">{order.client_name}</p>

                  {/* الرقم — كبير وقابل للضغط لواتساب */}
                  {order.client_phone && (
                    <a href={`https://wa.me/${order.client_phone.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-end gap-2 mb-3 active:scale-95 transition-all">
                      <span className="text-[#25D366] font-extrabold text-2xl tracking-wide" dir="ltr">
                        {order.client_phone}
                      </span>
                      <MessageCircle size={22} className="text-[#25D366]" />
                    </a>
                  )}

                  {/* العنوان — كبير وقابل للضغط لفتح الخريطة */}
                  {order.delivery_address && (
                    <button
                      onClick={() => setMapAddress(order.delivery_address!)}
                      className="w-full flex items-center gap-2 bg-blue-900/30 border border-blue-700/40 rounded-xl px-3 py-2.5 mb-3 active:scale-[0.98] transition-all text-right">
                      <MapPin size={18} className="text-blue-400 flex-shrink-0" />
                      <span className="text-blue-300 font-medium text-base flex-1">{order.delivery_address}</span>
                    </button>
                  )}

                  {/* المبلغ */}
                  <div className="flex items-center justify-end">
                    <span className="text-green-400 font-extrabold text-xl">
                      {order.total_amount.toLocaleString()}
                      <span className="text-xs font-normal text-slate-500"> د.ع</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal الخريطة */}
        <MapSheet address={mapAddress} onClose={() => setMapAddress(null)} />

        {/* لا يوجد طلبات */}
        {active.length === 0 && pickupOrders.length === 0 && (isAvailable ? incoming.length === 0 : true) && (
          <div className="text-center py-14 space-y-3">
            {isAvailable ? (
              <>
                <p className="text-6xl">😴</p>
                <p className="text-slate-300 text-xl font-extrabold">لا يوجد طلبات الآن</p>
                <p className="text-slate-500 text-sm">ستظهر الطلبات الجديدة هنا فوراً</p>
              </>
            ) : (
              <>
                <p className="text-6xl">⏸️</p>
                <p className="text-slate-300 text-xl font-extrabold">أنت غير متاح حالياً</p>
                <p className="text-slate-500 text-sm">فعّل السويتش أعلاه لتستلم الطلبات</p>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
