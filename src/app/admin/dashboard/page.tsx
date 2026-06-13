'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminBottomNav } from '@/components/BottomNav';
import { Moon, Sun, X, ClipboardList, Clock } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useNewOrders } from '@/context/NewOrdersContext';

type OrderItem = { id: string; item_name: string; quantity: number; price: number };
type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; client_note: string | null; total_amount: number; status: 'pending' | 'preparing' | 'ready' | 'completed' | 'rejected'; created_at: string; items?: OrderItem[]; driver_name?: string | null; driver_phone?: string | null; driver_id?: string | null; client_lat?: number | null; client_lng?: number | null; driver_lat?: number | null; driver_lng?: number | null };
type Driver = { id: string; name: string; phone: string; status: string };

const STATUS = {
  pending:   { label: 'واردة',        next: 'preparing' as const, nextLabel: 'ابدأ التجهيز',  color: '#f59e0b', dot: 'bg-yellow-400', btnColor: '#3b82f6' },
  preparing: { label: 'قيد التجهيز', next: 'ready'     as const, nextLabel: 'جاهز للتسليم', color: '#3b82f6', dot: 'bg-blue-400',   btnColor: '#22c55e' },
  ready:     { label: 'جار التوصيل', next: 'completed'  as const, nextLabel: 'تم التسليم',   color: '#22c55e', dot: 'bg-green-400',  btnColor: '#6b7280' },
  completed: { label: 'مكتمل',       next: null,                  nextLabel: '',              color: '#9ca3af', dot: 'bg-gray-400',   btnColor: '#9ca3af' },
  rejected:  { label: 'مرفوضة',      next: null,                  nextLabel: '',              color: '#ef4444', dot: 'bg-red-400',    btnColor: '#ef4444' },
};


const EXPIRE_SECS = 5 * 60; // 5 دقائق

function getCountdown(createdAt: string): { secs: number; pct: number; urgent: boolean } {
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  const secs    = Math.max(0, EXPIRE_SECS - elapsed);
  const pct     = Math.max(0, secs / EXPIRE_SECS);
  return { secs, pct, urgent: secs <= 60 };
}

function fmtCountdown(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function waitInfo(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 10) return { color: '#22c55e', text: `${mins} د` };
  if (mins < 20) return { color: '#f59e0b', text: `${mins} د` };
  return { color: '#ef4444', text: `${mins} د ⚠️` };
}

/* ─── مودال تتبع الطلب ─── */
function OrderTrackModal({ order, imageMap, onClose, onComplete }: {
  order: Order;
  imageMap: Map<string, string>;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(
    order.driver_lat && order.driver_lng ? { lat: order.driver_lat, lng: order.driver_lng } : null
  );
  const mapRef        = useRef<HTMLDivElement>(null);
  const mapInstance   = useRef<any>(null);
  const driverMarker  = useRef<any>(null);
  const leafletCssRef = useRef<HTMLLinkElement | null>(null);

  // polling موقع السائق كل 4 ثواني
  useEffect(() => {
    const id = setInterval(async () => {
      const { data } = await supabase.from('orders').select('driver_lat,driver_lng').eq('id', order.id).single();
      if (data?.driver_lat && data?.driver_lng) setDriverPos({ lat: data.driver_lat, lng: data.driver_lng });
    }, 4000);
    return () => clearInterval(id);
  }, [order.id]);

  // تحديث ماركر السائق عند تغيّر موقعه
  useEffect(() => {
    if (!driverMarker.current || !driverPos) return;
    driverMarker.current.setLatLng([driverPos.lat, driverPos.lng]);
  }, [driverPos]);

  // إنشاء الخريطة عند فتح المودال
  useEffect(() => {
    if (!mapRef.current) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    leafletCssRef.current = link;

    import('leaflet').then((mod) => {
      const L = (mod as any).default ?? mod;
      if (!mapRef.current || mapInstance.current) return;

      const center: [number, number] =
        order.client_lat && order.client_lng ? [order.client_lat, order.client_lng] :
        driverPos ? [driverPos.lat, driverPos.lng] : [33.3152, 44.3661];

      const map = L.map(mapRef.current, { attributionControl: false }).setView(center, 14);
      mapInstance.current = map;
      setTimeout(() => map.invalidateSize(), 100);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      const bounds: [number, number][] = [];

      if (order.client_lat && order.client_lng) {
        bounds.push([order.client_lat, order.client_lng]);
        L.marker([order.client_lat, order.client_lng], {
          icon: L.divIcon({
            html: `<div style="width:34px;height:34px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:18px">🏠</div>`,
            className: '', iconSize: [34, 34], iconAnchor: [17, 17],
          })
        }).addTo(map).bindPopup(`<div dir="rtl"><b>${order.client_name}</b></div>`);
      }

      if (driverPos) {
        bounds.push([driverPos.lat, driverPos.lng]);
        driverMarker.current = L.marker([driverPos.lat, driverPos.lng], {
          icon: L.divIcon({
            html: `<div style="width:38px;height:38px;background:#2563eb;border-radius:50%;border:3px solid white;box-shadow:0 3px 10px rgba(37,99,235,0.4);display:flex;align-items:center;justify-content:center;font-size:20px">🏍️</div>`,
            className: '', iconSize: [38, 38], iconAnchor: [19, 19],
          })
        }).addTo(map).bindPopup(`<div dir="rtl"><b>${order.driver_name ?? 'السائق'}</b></div>`);
      }

      if (bounds.length > 1) {
        try { map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] }); } catch (_) {}
      }
    });

    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; driverMarker.current = null; }
      if (leafletCssRef.current?.parentNode) { leafletCssRef.current.parentNode.removeChild(leafletCssRef.current); leafletCssRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 dark:bg-slate-600 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-slate-700">
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 active:scale-90 transition-all">
            <X size={18} className="text-gray-500" />
          </button>
          <p className="font-bold text-gray-900 dark:text-slate-100">{order.client_name}</p>
          <div className="w-9" />
        </div>

        {/* الخريطة */}
        <div className="relative">
          <div ref={mapRef} style={{ height: 260 }} className="w-full" />
          {!order.client_lat && !driverPos && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-100 dark:bg-slate-700">
              <p className="text-4xl">🏍️</p>
              <p className="text-sm text-gray-400 dark:text-slate-500">لا يوجد موقع متاح بعد</p>
            </div>
          )}
          {driverPos && (
            <div className="absolute top-2 right-2 bg-white/90 dark:bg-slate-800/90 text-xs font-bold text-green-600 px-2.5 py-1.5 rounded-full shadow flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              مباشر
            </div>
          )}
        </div>

        <div className="p-5 space-y-4 pb-8">
          <div className="flex justify-between items-start">
            <p className="text-green-500 font-bold text-xl">{order.total_amount.toLocaleString()} <span className="text-xs font-normal text-gray-400">د.ع</span></p>
            <div className="text-right">
              <p className="font-bold text-gray-900 dark:text-slate-100">{order.client_name}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5" dir="ltr">{order.client_phone}</p>
            </div>
          </div>

          {order.delivery_address && <p className="text-xs text-gray-400 dark:text-slate-500 text-right">📍 {order.delivery_address}</p>}
          {order.client_note && <p className="text-sm text-amber-600 dark:text-amber-400 text-right">📝 {order.client_note}</p>}

          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 space-y-2">
            {order.items?.map(item => {
              const img = imageMap.get(item.item_name);
              return (
                <div key={item.id} className="flex justify-between items-center">
                  <span className="text-[#f97316] font-bold text-sm">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                  <div className="flex items-center gap-2">
                    {img && <img src={img} alt={item.item_name} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
                    <span className="text-gray-800 dark:text-slate-200 text-sm">{item.item_name}</span>
                    <span className="bg-white dark:bg-slate-600 text-gray-600 dark:text-slate-300 text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">{item.quantity}×</span>
                  </div>
                </div>
              );
            })}
          </div>

          {order.driver_name && (
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${driverPos ? 'bg-green-400 animate-pulse' : 'bg-gray-300 dark:bg-slate-500'}`} />
                <span className="text-xs text-blue-400">{driverPos ? 'موقع مباشر' : 'في انتظار الموقع'}</span>
              </div>
              <div className="text-right">
                <p className="text-blue-700 dark:text-blue-300 font-bold text-sm">{order.driver_name}</p>
                <p className="text-xs text-blue-400 dark:text-blue-500" dir="ltr">{order.driver_phone}</p>
              </div>
              <span className="text-xl">🏍️</span>
            </div>
          )}

          <button onClick={onComplete} className="w-full py-4 bg-gray-500 text-white font-bold text-base rounded-2xl active:opacity-80 transition-all">
            تم التسليم ✓
          </button>
        </div>
      </div>
    </div>
  );
}

function DriverPickerModal({ drivers, onPick, onClose }: {
  drivers: Driver[];
  onPick: (driver: Driver) => void;
  onClose: () => void;
}) {
  const available = drivers.filter(d => d.status === 'available');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg p-5 pb-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all">
            <X size={18} />
          </button>
          <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">اختر السائق</p>
          <div className="w-9" />
        </div>

        {available.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🏍️</p>
            <p className="text-gray-500 dark:text-slate-400 font-medium">لا يوجد سواقون متاحون</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">جميع السواقين مشغولون حالياً</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {available.map(d => (
              <button key={d.id} onClick={() => onPick(d)}
                className="w-full flex items-center justify-between rounded-2xl px-4 py-3.5 transition-all bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 active:scale-95">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="font-bold text-sm text-blue-600 dark:text-blue-400">تعيين وإرسال</span>
                </span>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-slate-100">{d.name}</p>
                  <p className="text-sm text-gray-400 dark:text-slate-500 mt-0.5" dir="ltr">{d.phone}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardPage() {
  const { dark, toggleDark } = useDarkMode();
  const { markSeen } = useNewOrders();
  useEffect(() => { markSeen(); }, [markSeen]);

  const { is_closed, opens_at, schedule } = useSettings();

  const todayHours = useMemo(() => {
    if (!schedule?.days) return null;
    const dayKey = String(new Date().getDay());
    const day = schedule.days[dayKey];
    if (!day?.enabled) return null;
    return { open: day.open, close: day.close };
  }, [schedule]);

  const [orders,        setOrders]        = useState<Order[]>([]);
  const [imageMap,      setImageMap]      = useState<Map<string, string>>(new Map());
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState<'pending'|'preparing'|'ready'|'completed'|'rejected'>('pending');
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [drivers,          setDrivers]          = useState<Driver[]>([]);
  const [pickerOrderId,    setPickerOrderId]    = useState<string | null>(null);
  const [trackOrder,       setTrackOrder]       = useState<Order | null>(null);
  const [tick,             setTick]             = useState(0);

  const initialLoadDone = useRef(false);

  // تحديث كل ثانية لعرض العداد التنازلي
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const today = localDate();

  const fetchDrivers = useCallback(async () => {
    const { data } = await supabase.from('drivers').select('*').order('name');
    setDrivers(data || []);
  }, []);

  useEffect(() => {
    fetchDrivers();
    const ch = supabase.channel('drivers-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, fetchDrivers)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchDrivers]);

  const fetchOrders = useCallback(async () => {
    const start = new Date(today + 'T00:00:00').toISOString();
    const end   = new Date(today + 'T23:59:59').toISOString();

    const [ordersRes, itemsRes] = await Promise.all([
      supabase.from('orders').select('*').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }).limit(200),
      supabase.from('items').select('name, image_url'),
    ]);

    const imgMap = new Map<string, string>();
    (itemsRes.data || []).forEach(i => imgMap.set(i.name, i.image_url));
    setImageMap(imgMap);

    const withItems = await Promise.all((ordersRes.data || []).map(async o => {
      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', o.id);
      return { ...o, items: items || [] };
    }));
    setOrders(withItems);
    setLoading(false);
    initialLoadDone.current = true;
  }, [today]);

  useEffect(() => { setLoading(true); fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const ch = supabase.channel('dash-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        if (initialLoadDone.current) {
          setNewOrderFlash(true);
          setTimeout(() => setNewOrderFlash(false), 4000);
        }
        fetchOrders();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as Order['status'] } : o));
  };

  const sendPushToDriver = (driverId: string, title: string, body: string, url: string, tag: string) => {
    fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_id: driverId, title, body, url, tag }),
    }).catch(() => {});
  };

  const assignDriverAndStart = async (orderId: string, driver: Driver) => {
    const order = orders.find(o => o.id === orderId);

    await Promise.all([
      supabase.from('orders').update({
        status: 'preparing',
        driver_name: driver.name,
        driver_phone: driver.phone,
        driver_id: driver.id,
      }).eq('id', orderId),
      supabase.from('drivers').update({ status: 'unavailable' }).eq('id', driver.id),
    ]);
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: 'preparing', driver_name: driver.name, driver_phone: driver.phone, driver_id: driver.id } : o
    ));
    setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, status: 'unavailable' } : d));
    setPickerOrderId(null);

    // إشعار فوري للسائق
    const deliveryLink = `${window.location.origin}/delivery/${orderId}`;
    sendPushToDriver(driver.id, '🛵 طلب جديد!', `طلب جديد من ${order?.client_name ?? ''}`, deliveryLink, 'new-order');
  };

  const rejectOrder = async (id: string) => {
    await supabase.from('orders').update({ status: 'rejected' }).eq('id', id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'rejected' } : o));
  };

  const handleAction = (order: Order) => {
    const next = STATUS[order.status].next;
    if (!next) return;
    if (order.status === 'pending') {
      fetchDrivers().then(() => setPickerOrderId(order.id));
    } else {
      if (order.status === 'preparing' && order.driver_id) {
        const deliveryLink = `${window.location.origin}/delivery/${order.id}`;
        sendPushToDriver(order.driver_id, '✅ الطلب جاهز!', 'تفضل للمطعم لاستلام الطلب 🏍️', deliveryLink, 'order-ready');
      }
      updateStatus(order.id, next);
    }
  };

  const counts       = { pending:0, preparing:0, ready:0, completed:0, rejected:0 } as Record<string,number>;
  orders.forEach(o => counts[o.status] = (counts[o.status] || 0) + 1);
  const todayRevenue = orders.filter(o=>o.status==='completed').reduce((s,o)=>s+o.total_amount,0);
  const filtered     = orders.filter(o => o.status === filter);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 pb-24">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
        <button onClick={toggleDark} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 active:scale-90 transition-all">
          {dark ? <Sun size={16} className="text-yellow-400" /> : <Moon size={16} className="text-gray-600" />}
        </button>
        <div className="flex items-center gap-1.5">
          <ClipboardList size={18} className="text-[#f97316]" />
          <p className="font-bold text-gray-900 dark:text-slate-100">الطلبات</p>
        </div>
        <div className="w-10" />
      </header>

      {/* شريط الحالة والوقت */}
      <div className={`flex items-center justify-between px-4 py-2 text-xs font-bold ${is_closed ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'}`}>
        <div className="flex items-center gap-1.5">
          <Clock size={12} />
          {todayHours
            ? <span>{todayHours.open} – {todayHours.close}</span>
            : opens_at ? <span>يفتح {opens_at}</span> : <span>—</span>
          }
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${is_closed ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
          <span>{is_closed ? 'المطعم مغلق' : 'المطعم مفتوح'}</span>
        </div>
      </div>

      {/* إشعار طلب جديد */}
      {newOrderFlash && (
        <div className="bg-green-500 py-3 text-center animate-pulse">
          <p className="text-white font-bold">🔔 طلب جديد وصل!</p>
        </div>
      )}

      {/* إحصاء */}
      <div className="grid grid-cols-2 gap-2 px-3 pt-3 pb-2">
        <div className="rounded-2xl p-2.5 text-center border" style={{ backgroundColor: 'rgba(156,163,175,0.08)', borderColor: 'rgba(156,163,175,0.25)' }}>
          <p className="font-bold text-2xl" style={{ color: '#9ca3af' }}>{counts.completed}</p>
          <p className="text-xs mt-0.5 opacity-75" style={{ color: '#9ca3af' }}>مكتمل</p>
        </div>
        <div className="rounded-2xl px-4 py-2.5 text-center border bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800">
          <p className="text-orange-500 font-bold text-xl">{todayRevenue.toLocaleString()} <span className="text-xs font-normal text-orange-400">د.ع</span></p>
          <p className="text-orange-400 text-xs mt-0.5 font-bold">إجمالي اليوم</p>
        </div>
      </div>

      {/* تابس الفلتر */}
      <div className="flex gap-2 px-3 pb-3 overflow-x-auto">
        {(['pending','preparing','ready','completed','rejected'] as const).map(tab => {
          const active = filter === tab;
          const count  = counts[tab] || 0;
          return (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-all active:scale-95 ${active ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
              {STATUS[tab].label}{count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* الطلبات */}
      <div className="px-3">
        {loading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center mt-20"><p className="text-4xl mb-3">📋</p><p className="text-gray-400 dark:text-slate-500">لا توجد طلبات</p></div>
        ) : (
          /* ═══ عرض الطلبات العادي ═══ */
          <div className="space-y-3">
            {filtered.map(order => {
              const cfg      = STATUS[order.status];
              const wait     = order.status !== 'completed' ? waitInfo(order.created_at) : null;
              const countdown = order.status === 'pending' ? getCountdown(order.created_at) : null;
              void tick; // force re-render on tick
              return (
                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                  {/* شريط/هيدر العداد للطلبات الواردة */}
                  {countdown ? (
                    <>
                      {/* شريط التقدم */}
                      <div className="relative h-2 bg-gray-100 dark:bg-slate-700">
                        <div className="absolute inset-y-0 right-0 transition-all duration-1000"
                          style={{
                            width: `${countdown.pct * 100}%`,
                            backgroundColor: countdown.urgent ? '#ef4444' : countdown.pct > 0.5 ? '#22c55e' : '#f59e0b',
                          }} />
                      </div>
                      {/* هيدر العداد */}
                      <div className={`flex items-center justify-between px-4 py-2 ${countdown.urgent ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                        <span className={`text-xs font-medium ${countdown.urgent ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>
                          {countdown.urgent ? '⚠️ على وشك الإلغاء' : 'في انتظار القبول'}
                        </span>
                        <span className={`text-base font-black tabular-nums ${countdown.urgent ? 'text-red-500 animate-pulse' : 'text-amber-600 dark:text-amber-400'}`}>
                          ⏱ {fmtCountdown(countdown.secs)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="h-1.5" style={{ backgroundColor: cfg.color }} />
                  )}
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-50 dark:border-slate-700">
                      <div className="flex flex-col gap-1">
                        {!countdown && wait && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: wait.color }} />
                            <span className="text-xs font-bold" style={{ color: wait.color }}>{wait.text}</span>
                          </div>
                        )}
                        <p className="text-green-500 font-bold text-lg">{order.total_amount.toLocaleString()} <span className="text-xs text-gray-400 font-normal">د.ع</span></p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-slate-100 text-base">{order.client_name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{order.client_phone}</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 mb-3 space-y-2">
                      {order.items?.map(item => {
                        const img = imageMap.get(item.item_name);
                        return (
                          <div key={item.id} className="flex justify-between items-center">
                            <span className="text-[#f97316] font-bold text-sm">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                            <div className="flex items-center gap-2">
                              {img && (
                                <img src={img} alt={item.item_name} className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                                  onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                              )}
                              <span className="text-gray-800 dark:text-slate-200 text-sm">{item.item_name}</span>
                              <span className="bg-white dark:bg-slate-600 text-gray-600 dark:text-slate-300 text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">{item.quantity}×</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {order.delivery_address && <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">📍 {order.delivery_address}</p>}
                    {order.client_note && <p className="text-sm text-amber-600 dark:text-amber-400 text-right">📝 {order.client_note}</p>}

                    {order.driver_name && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (!order.driver_id) return;
                          const deliveryLink = `${window.location.origin}/delivery/${order.id}`;
                          sendPushToDriver(order.driver_id, '🔔 تذكير', 'تعال اخذ الطلب من المطعم، جاهز ينتظرك! 🏍️', deliveryLink, 'reminder');
                        }}
                        className="mt-2 w-full flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2 active:scale-[0.98] transition-all">
                        <span className="text-xs text-blue-400 dark:text-blue-500 font-medium">اضغط لإرسال تذكير</span>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-blue-700 dark:text-blue-300 font-bold text-sm">{order.driver_name}</p>
                            <p className="text-blue-500 text-xs" dir="ltr">{order.driver_phone}</p>
                          </div>
                          <span className="text-xl">🏍️</span>
                        </div>
                      </button>
                    )}

                    {/* زر تتبع الموقع — فقط لطلبات جار التوصيل */}
                    {order.status === 'ready' && (
                      <button
                        onClick={() => setTrackOrder(order)}
                        className="mt-2 w-full flex items-center justify-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2.5 active:scale-[0.98] transition-all">
                        <span className="text-base">🗺️</span>
                        <span className="text-sm font-bold text-green-700 dark:text-green-400">تتبع السائق على الخريطة</span>
                      </button>
                    )}
                  </div>

                  {order.status === 'pending' ? (
                    <div className="grid grid-cols-2">
                      <button onClick={() => rejectOrder(order.id)}
                        className="py-4 text-white font-bold text-base transition-all active:opacity-80 bg-red-500">
                        ✕ رفض
                      </button>
                      <button onClick={() => handleAction(order)}
                        className="py-4 text-white font-bold text-base transition-all active:opacity-80 bg-blue-600">
                        ✓ قبول
                      </button>
                    </div>
                  ) : cfg.next ? (
                    <button onClick={() => handleAction(order)}
                      className="w-full py-4 text-white font-bold text-base transition-all active:opacity-80"
                      style={{ backgroundColor: cfg.btnColor }}>
                      {cfg.nextLabel}
                    </button>
                  ) : (
                    <div className="w-full py-4 bg-gray-100 dark:bg-slate-700 text-center text-gray-400 dark:text-slate-500 font-bold text-sm">
                      {order.status === 'rejected' ? '✕ مرفوض' : '✓ مكتمل'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Driver picker modal */}
      {pickerOrderId && (
        <DriverPickerModal
          drivers={drivers}
          onPick={driver => assignDriverAndStart(pickerOrderId, driver)}
          onClose={() => setPickerOrderId(null)}
        />
      )}

      {/* Order track modal */}
      {trackOrder && (
        <OrderTrackModal
          key={trackOrder.id}
          order={trackOrder}
          imageMap={imageMap}
          onClose={() => setTrackOrder(null)}
          onComplete={() => { handleAction(trackOrder); setTrackOrder(null); }}
        />
      )}

      <AdminBottomNav />
    </div>
  );
}

export default function DashboardPageGuarded() {
  return <AdminGuard><DashboardPage /></AdminGuard>;
}
