'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { useSettings } from '@/context/SettingsContext';
import { useDarkMode } from '@/context/ThemeContext';
import {
  ShoppingBag, RefreshCw, X, CheckCircle2, Loader2,
  LocateFixed, MapPin,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const BASRA_CENTER: [number, number] = [30.5085, 47.7804];

const MAP_CSS = `
  @keyframes pin-pulse  { 0%{transform:translate(-50%,0) scale(1);opacity:.55} 100%{transform:translate(-50%,0) scale(3.5);opacity:0} }
  @keyframes pin-bounce { 0%,100%{transform:translate(-50%,-100%) translateY(0)} 45%{transform:translate(-50%,-100%) translateY(-8px)} }
`;

type OrderItem = { id: string; order_id: string; item_name: string; quantity: number; price: number };
type Order = {
  id: string; client_name: string; client_phone: string;
  delivery_address: string | null; total_amount: number;
  status: string; created_at: string;
  client_lat?: number | null; client_lng?: number | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'قيد الانتظار', color: '#f59e0b' },
  preparing: { label: 'جاري التجهيز', color: '#3b82f6' },
  ready:     { label: 'في الطريق',    color: '#8b5cf6' },
  completed: { label: 'تم التوصيل',   color: '#10b981' },
  rejected:  { label: 'مرفوض',        color: '#ef4444' },
};

function fmtDate(iso: string) {
  const d     = new Date(iso);
  const day   = d.getDate();
  const month = d.getMonth() + 1;
  const h     = d.getHours();
  const m     = d.getMinutes().toString().padStart(2, '0');
  const ampm  = h >= 12 ? 'م' : 'ص';
  const h12   = h % 12 || 12;
  return `${day}/${month} - ${h12}:${m} ${ampm}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const { primary_color } = useSettings();
  const { dark } = useDarkMode();

  const rawColor   = primary_color || '#e67e22';
  const isTooDark  = rawColor === '#000000' || rawColor.toLowerCase() === '#121212';
  const brandColor = dark && isTooDark ? '#ffffff' : rawColor;

  // ── Data state ──────────────────────────────────────────────────────────
  const [phone,    setPhone]    = useState('');
  const [orders,   setOrders]   = useState<Order[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, OrderItem[]>>({});
  const [loading,  setLoading]  = useState(true);

  // ── Reorder modal state ──────────────────────────────────────────────────
  const [reorderTarget, setReorderTarget] = useState<Order | null>(null);
  const [reorderItems,  setReorderItems]  = useState<OrderItem[]>([]);
  const [submitting,    setSubmitting]    = useState(false);

  // ── Map state ────────────────────────────────────────────────────────────
  const [showMap,    setShowMap]    = useState(false);
  const [clientLat,  setClientLat]  = useState<number | null>(null);
  const [clientLng,  setClientLng]  = useState<number | null>(null);
  const [gpsLocating, setGpsLocating] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const locationMapRef         = useRef<HTMLDivElement>(null);
  const locationMapInstanceRef = useRef<any>(null);
  const pendingFlyRef          = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const gpsWatchRef            = useRef<number | null>(null);
  const gpsStopTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preciseTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  // store lat/lng in refs so confirmLocationAndSubmit closure sees the latest
  const latRef = useRef<number | null>(null);
  const lngRef = useRef<number | null>(null);

  // keep refs in sync
  useEffect(() => { latRef.current = clientLat; }, [clientLat]);
  useEffect(() => { lngRef.current = clientLng; }, [clientLng]);

  // ── Fetch orders ─────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('deliveryPhone') || '';
    setPhone(saved);
    if (saved) fetchOrders(saved);
    else setLoading(false);
  }, []);

  const fetchOrders = async (ph: string) => {
    setLoading(true);
    const { data: rows } = await supabase
      .from('orders').select('*')
      .eq('client_phone', ph)
      .order('created_at', { ascending: false })
      .limit(30);

    if (rows && rows.length > 0) {
      setOrders(rows);
      const ids = rows.map((o: Order) => o.id);
      const { data: items } = await supabase
        .from('order_items').select('*').in('order_id', ids);
      if (items) {
        const grouped: Record<string, OrderItem[]> = {};
        for (const item of items as OrderItem[]) {
          if (!grouped[item.order_id]) grouped[item.order_id] = [];
          grouped[item.order_id].push(item);
        }
        setItemsMap(grouped);
      }
    } else {
      setOrders([]);
    }
    setLoading(false);
  };

  // ── GPS helpers ──────────────────────────────────────────────────────────
  const stopGpsWatch = () => {
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    if (gpsStopTimerRef.current)  { clearTimeout(gpsStopTimerRef.current);  gpsStopTimerRef.current  = null; }
    if (preciseTimerRef.current)  { clearTimeout(preciseTimerRef.current);   preciseTimerRef.current  = null; }
  };

  const startGpsWatch = (onPosition: (lat: number, lng: number, accuracy: number) => void) => {
    stopGpsWatch();
    setGpsLocating(true);
    setGpsAccuracy(null);
    if (!('geolocation' in navigator)) { setGpsLocating(false); return; }
    let bestAccuracy = Infinity;
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(Math.round(accuracy));
        if (accuracy < bestAccuracy) { bestAccuracy = accuracy; onPosition(latitude, longitude, accuracy); }
        if (accuracy <= 30) { stopGpsWatch(); setGpsLocating(false); }
      },
      () => { setGpsLocating(false); },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  };

  // ── Leaflet CSS ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (document.querySelector('link[data-leaflet-css]')) return;
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.setAttribute('data-leaflet-css', '1');
    document.head.appendChild(link);
  }, []);

  // ── Map lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showMap) return;
    const t = setTimeout(() => {
      if (!locationMapRef.current || locationMapInstanceRef.current) return;
      import('leaflet').then((mod) => {
        const L = (mod as any).default ?? mod;
        if (!locationMapRef.current || locationMapInstanceRef.current) return;
        const initCenter: [number, number] =
          (latRef.current && lngRef.current)
            ? [latRef.current, lngRef.current]
            : BASRA_CENTER;
        const map = L.map(locationMapRef.current, { zoomControl: false, attributionControl: false })
          .setView(initCenter, 14);
        locationMapInstanceRef.current = map;
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19,
        }).addTo(map);
        setTimeout(() => map.invalidateSize({ pan: false }), 100);
        setTimeout(() => map.invalidateSize({ pan: false }), 500);
        map.on('moveend', () => {
          const c = map.getCenter();
          setClientLat(c.lat);
          setClientLng(c.lng);
        });
        if (pendingFlyRef.current) {
          const { lat, lng, accuracy } = pendingFlyRef.current;
          map.setView([lat, lng], accuracy < 100 ? 17 : accuracy < 500 ? 16 : accuracy < 2000 ? 14 : 13);
          pendingFlyRef.current = null;
        }
      });
    }, 80);
    return () => {
      clearTimeout(t);
      if (locationMapInstanceRef.current) {
        locationMapInstanceRef.current.remove();
        locationMapInstanceRef.current = null;
      }
    };
  }, [showMap]);

  // ── Open map when "تأكيد وإرسال" pressed ────────────────────────────────
  const handleConfirmPress = () => {
    const prevLat = reorderTarget?.client_lat ?? null;
    const prevLng = reorderTarget?.client_lng ?? null;
    if (prevLat && prevLng) {
      setClientLat(prevLat);
      setClientLng(prevLng);
      pendingFlyRef.current = { lat: prevLat, lng: prevLng, accuracy: 50 };
    } else {
      setClientLat(BASRA_CENTER[0]);
      setClientLng(BASRA_CENTER[1]);
    }
    setShowMap(true);
    startGpsWatch((lat, lng, accuracy) => {
      const zoom = accuracy < 30 ? 18 : accuracy < 100 ? 17 : accuracy < 500 ? 16 : accuracy < 2000 ? 14 : 13;
      if (locationMapInstanceRef.current) {
        locationMapInstanceRef.current.flyTo([lat, lng], zoom, { animate: true, duration: 0.8 });
      } else {
        pendingFlyRef.current = { lat, lng, accuracy };
      }
    });
  };

  const locateMe = () => {
    if (!locationMapInstanceRef.current) return;
    startGpsWatch((lat, lng, accuracy) => {
      if (!locationMapInstanceRef.current) return;
      const zoom = accuracy < 30 ? 18 : accuracy < 100 ? 17 : accuracy < 500 ? 16 : accuracy < 2000 ? 14 : 13;
      locationMapInstanceRef.current.flyTo([lat, lng], zoom, { animate: true, duration: 0.8 });
    });
  };

  const closeMap = () => {
    stopGpsWatch();
    if (locationMapInstanceRef.current) { locationMapInstanceRef.current.remove(); locationMapInstanceRef.current = null; }
    pendingFlyRef.current = null;
    setShowMap(false);
    setGpsLocating(false);
    setGpsAccuracy(null);
  };

  // ── Confirm location → submit order ──────────────────────────────────────
  const confirmLocationAndSubmit = async () => {
    stopGpsWatch();
    if (locationMapInstanceRef.current) { locationMapInstanceRef.current.remove(); locationMapInstanceRef.current = null; }
    pendingFlyRef.current = null;
    setShowMap(false);
    setGpsLocating(false);
    setGpsAccuracy(null);

    if (!reorderTarget) return;
    setSubmitting(true);

    const name = localStorage.getItem('deliveryName') || reorderTarget.client_name;
    const nick = localStorage.getItem('deliveryNickname') || '';
    const ph   = localStorage.getItem('deliveryPhone')   || reorderTarget.client_phone;
    const addr = localStorage.getItem('deliveryAddressDetails') || reorderTarget.delivery_address || '';
    const clientName = nick ? `${name} (${nick})` : name;
    const total = reorderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const lat   = latRef.current;
    const lng   = lngRef.current;

    const { data: order, error } = await supabase.from('orders').insert([{
      client_name:      clientName,
      client_phone:     ph,
      delivery_address: addr || null,
      total_amount:     total,
      status:           'pending',
      ...(lat && lng ? { client_lat: lat, client_lng: lng } : {}),
    }]).select().single();

    if (error || !order) { alert('حدث خطأ، حاول مجدداً'); setSubmitting(false); return; }

    const { error: itemsError } = await supabase.from('order_items').insert(
      reorderItems.map(i => ({
        order_id:  order.id,
        item_name: i.item_name,
        quantity:  i.quantity,
        price:     i.price,
      }))
    );

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      alert('حدث خطأ في حفظ الطلب، حاول مجدداً');
      setSubmitting(false);
      return;
    }

    localStorage.setItem('lastOrderId', order.id);
    setSubmitting(false);
    setReorderTarget(null);
    router.push('/track');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-center text-gray-900 dark:text-white">طلباتي</h1>
      </header>

      <div className="px-4 pt-5">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: brandColor, borderTopColor: 'transparent' }}/>
          </div>
        ) : !phone || orders.length === 0 ? (
          <div className="text-center mt-20">
            <div className="text-5xl mb-4">🛍️</div>
            <p className="text-gray-500 dark:text-slate-400 font-semibold">لا توجد طلبات سابقة</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">طلباتك ستظهر هنا بعد أول طلب</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const items = itemsMap[order.id] || [];
              const st    = STATUS_LABELS[order.status] || { label: order.status, color: '#9ca3af' };
              return (
                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50 dark:border-slate-700">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: `${st.color}18`, color: st.color }}>
                      {st.label}
                    </span>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white text-sm">
                        {order.total_amount.toLocaleString()} د.ع
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{fmtDate(order.created_at)}</p>
                    </div>
                  </div>

                  <div className="px-4 py-3 space-y-1.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm" dir="rtl">
                        <span className="text-gray-400 dark:text-slate-500">
                          {(item.price * item.quantity).toLocaleString()} د.ع
                        </span>
                        <span className="text-gray-900 dark:text-slate-100 font-medium">
                          {item.item_name}{' '}
                          <span className="text-gray-400 font-normal">×{item.quantity}</span>
                        </span>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 text-right">—</p>
                    )}
                  </div>

                  <div className="px-4 pb-4">
                    <button
                      onClick={() => { setReorderTarget(order); setReorderItems(itemsMap[order.id] || []); }}
                      className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                      style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 12px #ef444435' }}>
                      <RefreshCw size={15}/>
                      اطلب مجددا
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ Reorder confirmation sheet ══════════════════════════════════════ */}
      <AnimatePresence>
      {reorderTarget && !showMap && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="w-full bg-white dark:bg-slate-900 rounded-t-3xl overflow-hidden">

            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700"/>
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-slate-700">
              <button
                onClick={() => setReorderTarget(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 active:scale-90 transition-all">
                <X size={17}/>
              </button>
              <p className="font-bold text-gray-900 dark:text-white">تأكيد الطلب</p>
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ef444418' }}>
                <ShoppingBag size={17} style={{ color: '#ef4444' }}/>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Items */}
              <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-end gap-1.5 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                  <p className="text-xs font-bold text-gray-500 dark:text-slate-400">الأصناف</p>
                  <ShoppingBag size={13} className="text-gray-400"/>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                  {reorderItems.map((item, idx) => (
                    <div key={idx} className="px-4 py-2.5 flex items-center justify-between" dir="rtl">
                      <span className="font-bold text-sm" style={{ color: '#ef4444' }}>
                        {(item.price * item.quantity).toLocaleString()} د.ع
                      </span>
                      <span className="text-gray-900 dark:text-slate-100 text-sm">
                        {item.item_name} <span className="text-gray-400">×{item.quantity}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800" dir="rtl">
                  <span className="font-black text-lg" style={{ color: '#ef4444' }}>
                    {reorderItems.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()} د.ع
                  </span>
                  <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">المجموع</span>
                </div>
              </div>

              {/* Customer info */}
              <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 space-y-2 text-right">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{reorderTarget.client_name}</span>
                  <span className="text-gray-400 dark:text-slate-500 text-xs">الاسم</span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-100 dark:border-slate-700 pt-2">
                  <span className="font-bold text-sm" style={{ color: '#ef4444' }}>{reorderTarget.client_phone}</span>
                  <span className="text-gray-400 dark:text-slate-500 text-xs">الهاتف</span>
                </div>
                {reorderTarget.delivery_address && (
                  <div className="flex justify-between items-center border-t border-gray-100 dark:border-slate-700 pt-2">
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{reorderTarget.delivery_address}</span>
                    <span className="text-gray-400 dark:text-slate-500 text-xs">العنوان</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pt-2 pb-8 space-y-3">
              <button
                onClick={handleConfirmPress}
                disabled={submitting}
                className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', boxShadow: '0 8px 24px #ef444450' }}>
                {submitting
                  ? <><Loader2 size={20} className="animate-spin"/> جاري الإرسال...</>
                  : <><MapPin size={20}/> تأكيد وإرسال الطلب</>
                }
              </button>
              <button
                onClick={() => setReorderTarget(null)}
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 active:scale-95 transition-all">
                إلغاء
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ══ Full-screen map ══════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showMap && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>

          <style>{MAP_CSS}</style>

          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="flex flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-slate-900"
            style={{ height: '92vh' }}>

            <div className="flex justify-center pt-3 pb-0.5 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700"/>
            </div>

            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
              <button
                type="button"
                onClick={closeMap}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 active:scale-90 transition-all">
                <X size={17}/>
              </button>
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-slate-100" style={{ fontSize: 15 }}>تحديد موقع التوصيل</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {gpsLocating ? 'جاري تحديد موقعك...' : 'حرّك الخريطة لضبط الدبوس'}
                </p>
              </div>
              <div className="w-9"/>
            </div>

            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <div ref={locationMapRef} style={{ position: 'absolute', inset: 0 }}/>

              {/* Pin pulse ring */}
              <div style={{ position:'absolute', top:'50%', left:'50%', width:18, height:18, borderRadius:'50%', background:'#ef4444', animation:'pin-pulse 2s ease-out infinite', zIndex:999, pointerEvents:'none' }}/>

              {/* Bouncing pin */}
              <div style={{ position:'absolute', top:'50%', left:'50%', animation:'pin-bounce 2.4s ease-in-out infinite', pointerEvents:'none', zIndex:1000, transform:'translate(-50%, -100%)' }}>
                <div style={{ width:42, height:42, background:'#ef4444', borderRadius:'50% 50% 50% 0', transform:'rotate(-45deg)', border:'3.5px solid white', boxShadow:'0 6px 20px #ef444470, 0 2px 8px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:11, height:11, background:'white', borderRadius:'50%', transform:'rotate(45deg)', opacity:0.9 }}/>
                </div>
              </div>

              {/* Pin shadow */}
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, 4px)', width:14, height:6, background:'rgba(0,0,0,0.18)', borderRadius:'50%', pointerEvents:'none', zIndex:999, filter:'blur(2px)' }}/>

              {/* GPS accuracy badge */}
              {(gpsLocating || gpsAccuracy !== null) && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 rounded-full px-4 py-2 shadow-xl text-xs font-bold"
                  style={{
                    background: 'white',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    color: gpsAccuracy !== null && gpsAccuracy <= 50 ? '#16a34a'
                         : gpsAccuracy !== null && gpsAccuracy <= 300 ? '#d97706'
                         : '#ef4444',
                  }}>
                  {gpsLocating && gpsAccuracy === null
                    ? <><Loader2 size={13} className="animate-spin"/> جاري تحديد موقعك...</>
                    : gpsLocating && gpsAccuracy !== null
                      ? <><Loader2 size={13} className="animate-spin"/> جاري تحسين الدقة... {gpsAccuracy >= 1000 ? `${(gpsAccuracy/1000).toFixed(1)}كم` : `${gpsAccuracy}م`}</>
                    : gpsAccuracy !== null && gpsAccuracy <= 100
                      ? <><CheckCircle2 size={13}/> دقة ممتازة — {gpsAccuracy}م</>
                      : <><MapPin size={13}/> دقة: {gpsAccuracy !== null && gpsAccuracy >= 1000 ? `${(gpsAccuracy/1000).toFixed(1)}كم` : `${gpsAccuracy}م`}</>
                  }
                </div>
              )}

              {/* Locate me button */}
              <button
                type="button"
                onClick={locateMe}
                className="absolute bottom-4 right-4 z-[1000] rounded-full flex items-center justify-center active:scale-90 transition-all"
                style={{ width:50, height:50, background:'white', boxShadow:'0 4px 16px rgba(0,0,0,0.18)', border:'2px solid #ef444430' }}>
                {gpsLocating
                  ? <Loader2 size={22} className="animate-spin" style={{ color: '#ef4444' }}/>
                  : <LocateFixed size={22} style={{ color: '#ef4444' }}/>
                }
              </button>
            </div>

            <div className="px-4 pt-3 pb-7 flex-shrink-0 bg-white dark:bg-slate-900" style={{ boxShadow:'0 -1px 0 rgba(0,0,0,0.06)' }}>
              {gpsAccuracy !== null && gpsAccuracy > 500 && (
                <div className="flex items-start gap-2 mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2.5 text-right">
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed flex-1">الدقة ضعيفة — فعّل GPS الجهاز أو تحرك للخارج، أو حرّك الخريطة يدوياً لموقعك الصحيح</p>
                  <span className="text-lg">⚠️</span>
                </div>
              )}
              <button
                type="button"
                onClick={confirmLocationAndSubmit}
                disabled={submitting}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background:'linear-gradient(135deg, #ef4444, #dc2626)', color:'#ffffff', boxShadow:'0 8px 24px #ef444450' }}>
                {submitting
                  ? <><Loader2 size={20} className="animate-spin"/> جاري الإرسال...</>
                  : <><CheckCircle2 size={20}/> تأكيد وإرسال الطلب</>
                }
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* البار السفلي يختفي عند فتح الـ modal أو الخريطة */}
      {!reorderTarget && !showMap && <ClientBottomNav />}
    </div>
  );
}
