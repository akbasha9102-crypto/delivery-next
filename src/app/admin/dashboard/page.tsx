'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminBottomNav } from '@/components/BottomNav';
import { Moon, Sun, ClipboardList, Clock } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useNewOrders } from '@/context/NewOrdersContext';
import { useRestaurant } from '@/context/RestaurantContext';

type OrderItem = { id: string; item_name: string; quantity: number; price: number };
type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; client_note: string | null; total_amount: number; status: 'pending' | 'preparing' | 'pickup' | 'ready' | 'completed' | 'rejected'; created_at: string; items?: OrderItem[]; driver_name?: string | null; driver_phone?: string | null; driver_id?: string | null; client_lat?: number | null; client_lng?: number | null; driver_lat?: number | null; driver_lng?: number | null };

const STATUS = {
  pending:   { label: 'واردة',        next: 'preparing' as const, nextLabel: 'ابدأ التجهيز', color: '#f59e0b', dot: 'bg-yellow-400',  btnColor: '#3b82f6' },
  preparing: { label: 'قيد التجهيز', next: 'pickup'    as const, nextLabel: 'جاهز للتسليم', color: '#3b82f6', dot: 'bg-blue-400',    btnColor: '#f97316' },
  pickup:    { label: 'قيد التوصيل', next: null,                 nextLabel: '',              color: '#f97316', dot: 'bg-orange-400',  btnColor: '#9ca3af' },
  ready:     { label: 'في الطريق',   next: null,                 nextLabel: '',              color: '#8b5cf6', dot: 'bg-purple-400',  btnColor: '#9ca3af' },
  completed: { label: 'مكتمل',       next: null,                 nextLabel: '',              color: '#9ca3af', dot: 'bg-gray-400',    btnColor: '#9ca3af' },
  rejected:  { label: 'مرفوضة',      next: null,                 nextLabel: '',              color: '#ef4444', dot: 'bg-red-400',     btnColor: '#ef4444' },
} as const;


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



function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function DeliveryModal({ order: init, onClose }: { order: Order; onClose: () => void }) {
  const mapRef              = useRef<HTMLDivElement>(null);
  const mapInstanceRef      = useRef<any>(null);
  const driverMarkerRef     = useRef<any>(null);
  const routeLineRef        = useRef<any>(null);
  const routeLastFetchRef   = useRef<number>(0);
  const customerMarkersRef  = useRef<any[]>([]);
  const [order, setOrder]   = useState(init);
  const [mapReady, setMapReady]     = useState(false);
  const [driverOrders, setDriverOrders] = useState<Array<{id:string; client_name:string; client_lat:number|null; client_lng:number|null; delivery_address:string|null}>>([]);

  useEffect(() => {
    const ch = supabase.channel(`admin-modal-${init.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        ({ new: row }: any) => {
          if (row.id !== init.id) return;
          setOrder(o => ({ ...o, ...row }));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [init.id]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !order.client_lat || !order.client_lng) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    import('leaflet').then((mod) => {
      const L = (mod as any).default ?? mod;
      if (!mapRef.current || mapInstanceRef.current) return;
      const map = L.map(mapRef.current, { attributionControl: false })
        .setView([order.client_lat!, order.client_lng!], 15);
      mapInstanceRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      setMapReady(true);
    });
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        driverMarkerRef.current = null;
        routeLineRef.current = null;
        customerMarkersRef.current = [];
      }
      setMapReady(false);
    };
  }, [order.client_lat, order.client_lng]);

  // Fetch all active orders for this driver
  useEffect(() => {
    if (!order.driver_id) return;
    supabase
      .from('orders')
      .select('id, client_name, client_lat, client_lng, delivery_address')
      .eq('driver_id', order.driver_id)
      .in('status', ['pickup', 'ready', 'preparing'])
      .order('created_at', { ascending: true })
      .then(({ data }) => setDriverOrders(data || []));
  }, [order.driver_id]);

  // Draw numbered customer markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    customerMarkersRef.current.forEach(m => m.remove());
    customerMarkersRef.current = [];

    if (!driverOrders.length) return;

    import('leaflet').then(mod => {
      const L = (mod as any).default ?? mod;
      if (!mapInstanceRef.current) return;
      driverOrders.forEach((o, idx) => {
        if (!o.client_lat || !o.client_lng) return;
        const num = idx + 1;
        const isCurrent = o.id === init.id;
        const color = isCurrent ? '#ef4444' : '#f97316';
        const iconHtml = `<div style="position:relative;width:38px;height:44px">
          <div style="width:38px;height:38px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3)"></div>
          <span style="position:absolute;top:3px;left:0;width:38px;text-align:center;font-weight:900;font-size:15px;color:white;line-height:1.2">${num}</span>
        </div>`;
        const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [38, 44], iconAnchor: [19, 44] });
        const marker = L.marker([o.client_lat, o.client_lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<b dir="rtl">${o.client_name}</b>${o.delivery_address ? `<br><small style="color:#6b7280">${o.delivery_address}</small>` : ''}`, { offset: [0, -20] });
        if (isCurrent) marker.openPopup();
        customerMarkersRef.current.push(marker);
      });
    });
  }, [mapReady, driverOrders, init.id]);

  useEffect(() => {
    if (!mapInstanceRef.current || !order.driver_lat || !order.driver_lng) return;
    import('leaflet').then((mod) => {
      const L = (mod as any).default ?? mod;
      if (!mapInstanceRef.current) return;
      const rotation = (order.client_lat && order.client_lng)
        ? calcBearing(order.driver_lat!, order.driver_lng!, order.client_lat, order.client_lng)
        : 0;
      const arrowHtml = `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;transform:rotate(${Math.round(rotation)}deg);filter:drop-shadow(0 3px 10px rgba(37,99,235,0.65));transition:transform 0.4s ease">
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="19,3 32,33 19,26 6,33" fill="#2563eb" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
        </svg>
      </div>`;
      const icon = L.divIcon({ html: arrowHtml, className: '', iconSize: [44, 44], iconAnchor: [22, 22] });
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([order.driver_lat!, order.driver_lng!]);
        driverMarkerRef.current.setIcon(icon);
      } else {
        driverMarkerRef.current = L.marker([order.driver_lat!, order.driver_lng!], { icon }).addTo(mapInstanceRef.current);
        if (order.client_lat && order.client_lng) {
          mapInstanceRef.current.fitBounds(
            L.latLngBounds([order.client_lat, order.client_lng], [order.driver_lat!, order.driver_lng!]),
            { padding: [40, 40] }
          );
        }
      }

      // Fetch route line (throttled to once per 30s)
      if (order.client_lat && order.client_lng) {
        const shouldFetch = !routeLineRef.current || (Date.now() - routeLastFetchRef.current > 30_000);
        if (shouldFetch) {
          routeLastFetchRef.current = Date.now();
          const dLat = order.driver_lat!, dLng = order.driver_lng!;
          const cLat = order.client_lat,  cLng = order.client_lng;
          fetch(`https://router.project-osrm.org/route/v1/driving/${dLng},${dLat};${cLng},${cLat}?overview=full&geometries=geojson`)
            .then(r => r.json())
            .then(json => {
              const coords = json.routes?.[0]?.geometry?.coordinates?.map(
                ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
              );
              if (!coords?.length || !mapInstanceRef.current) return;
              if (routeLineRef.current) {
                routeLineRef.current.setLatLngs(coords);
              } else {
                routeLineRef.current = L.polyline(coords, {
                  color: '#2563eb', weight: 4, opacity: 0.85,
                }).addTo(mapInstanceRef.current);
                routeLineRef.current.bringToBack();
              }
            })
            .catch(() => {});
        }
      }
    });
  }, [order.driver_lat, order.driver_lng, order.client_lat, order.client_lng]);

  const isMoving = order.status === 'ready' && order.driver_lat && order.driver_lng;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mt-3 mb-3" />
        <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100 dark:border-slate-700">
          <button onClick={onClose} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">✕</button>
          <div className="text-right">
            <p className="font-bold text-gray-900 dark:text-white text-lg">{order.client_name}</p>
            {order.client_phone && <p className="text-xs text-gray-400 dark:text-slate-500" dir="ltr">{order.client_phone}</p>}
          </div>
        </div>

        {/* Map */}
        <div className="mx-4 mt-4 rounded-2xl overflow-hidden relative" style={{ height: 220 }}>
          {order.client_lat && order.client_lng ? (
            <>
              <div ref={mapRef} style={{ height: 220 }} className="w-full" />
              {!isMoving && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center rounded-2xl pointer-events-none">
                  <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl px-4 py-2.5 text-center">
                    <p className="font-bold text-gray-700 dark:text-white text-sm">🏍️ السائق في طريقه للمطعم</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">الخريطة الحية تبدأ بعد انطلاقه</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-full bg-gray-50 dark:bg-slate-700 flex flex-col items-center justify-center rounded-2xl border border-gray-100 dark:border-slate-600">
              <p className="text-3xl mb-2">📍</p>
              <p className="text-gray-500 dark:text-slate-400 text-sm">لا يوجد موقع GPS</p>
              {order.delivery_address && <p className="text-xs text-gray-400 mt-1 px-4 text-center">{order.delivery_address}</p>}
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className={`text-center py-2 rounded-xl text-sm font-bold ${
            order.status === 'ready'
              ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
              : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
          }`}>
            {order.status === 'ready' ? '🏍️ السائق في الطريق إلى الزبون' : '📦 السائق في طريقه لاستلام الطلب'}
          </div>

          {order.driver_name && (
            <div className="flex items-center gap-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-2.5">
              <span className="text-2xl">🏍️</span>
              <div>
                <p className="font-bold text-blue-700 dark:text-blue-300">{order.driver_name}</p>
                <p className="text-blue-500 text-xs" dir="ltr">{order.driver_phone}</p>
              </div>
            </div>
          )}

          {order.items && order.items.length > 0 && (
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 space-y-2">
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between items-center">
                  <span className="text-[#f97316] font-bold text-sm">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-slate-300 text-sm">{item.item_name}</span>
                    <span className="bg-white dark:bg-slate-600 text-gray-500 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{item.quantity}×</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-green-500 font-black text-2xl">{order.total_amount.toLocaleString()} <span className="text-sm text-gray-400 font-normal">د.ع</span></span>
            {order.delivery_address && <p className="text-xs text-gray-400 text-right max-w-[55%]">📍 {order.delivery_address}</p>}
          </div>
          {order.client_note && (
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2 text-right">📝 {order.client_note}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { dark, toggleDark } = useDarkMode();
  const { markSeen } = useNewOrders();
  useEffect(() => { markSeen(); }, [markSeen]);

  const { is_closed, opens_at, schedule } = useSettings();
  const { restaurantId } = useRestaurant();

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
  const [filter,        setFilter]        = useState<'pending'|'preparing'|'delivery'|'completed'>('pending');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [tick,          setTick]          = useState(0);

  const initialLoadDone = useRef(false);

  // تحديث كل ثانية لعرض العداد التنازلي
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const today = localDate();


  const fetchOrders = useCallback(async () => {
    const start = new Date(today + 'T00:00:00').toISOString();
    const end   = new Date(today + 'T23:59:59').toISOString();

    if (!restaurantId) { setLoading(false); return; }
    const ordersQ = supabase.from('orders').select('*').eq('restaurant_id', restaurantId).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }).limit(200);
    const itemsQ  = supabase.from('items').select('name, image_url').eq('restaurant_id', restaurantId);

    const [ordersRes, itemsRes] = await Promise.all([ordersQ, itemsQ]);

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
  }, [today, restaurantId]);

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

  const rejectOrder = async (id: string) => {
    await supabase.from('orders').update({ status: 'rejected' }).eq('id', id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'rejected' } : o));
  };

  const handleAction = async (order: Order) => {
    const cfg = STATUS[order.status as keyof typeof STATUS];
    const next = cfg?.next;
    if (!next) return;
    await updateStatus(order.id, next);

    if (order.status === 'pending') {
      fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': process.env.NEXT_PUBLIC_API_SECRET! },
        body: JSON.stringify({
          title: '🔔 طلب جديد',
          body: `طلب من ${order.client_name} — ${order.total_amount.toLocaleString()} د.ع`,
          url: '/driver/dashboard',
          tag: `order-${order.id}`,
        }),
      }).catch(() => {});
    }

    if (order.status === 'preparing' && order.driver_id) {
      fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': process.env.NEXT_PUBLIC_API_SECRET! },
        body: JSON.stringify({
          driver_id: order.driver_id,
          title: '🍔 الطلب جاهز!',
          body: `طلب ${order.client_name} جاهز — تعال استلمه من المطعم`,
          url: `/delivery/${order.id}`,
          tag: `ready-${order.id}`,
        }),
      }).catch(() => {});
    }
  };

  const counts = { pending: 0, preparing: 0, delivery: 0, completed: 0 };
  orders.forEach(o => {
    if (o.status === 'pending')   counts.pending++;
    else if (o.status === 'preparing') counts.preparing++;
    else if (o.status === 'pickup' || o.status === 'ready') counts.delivery++;
    else if (o.status === 'completed') counts.completed++;
  });
  const todayRevenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.total_amount, 0);
  const filtered = filter === 'delivery'
    ? orders.filter(o => o.status === 'pickup' || o.status === 'ready')
    : orders.filter(o => o.status === filter);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24">

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
        {(['pending','preparing','delivery','completed'] as const).map(tab => {
          const isActive = filter === tab;
          const count    = counts[tab] || 0;
          const labels   = { pending: 'واردة', preparing: 'قيد التجهيز', delivery: 'قيد التوصيل', completed: 'مكتمل' };
          return (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-all active:scale-95 ${isActive ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
              {labels[tab]}{count > 0 ? ` (${count})` : ''}
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
        ) : filter === 'delivery' ? (
          /* ═══ تاب قيد التوصيل — كل طلب بطاقة مستقلة ═══ */
          <div className="space-y-3">
            {filtered.map(order => (
              <button key={order.id} onClick={() => setSelectedOrder(order)}
                className="w-full bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 text-right active:scale-95 transition-all overflow-hidden flex items-stretch">
                <div className={`w-1.5 flex-shrink-0 ${order.status === 'ready' ? 'bg-purple-500' : 'bg-orange-500'}`} />
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      order.status === 'ready'
                        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                        : 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                    }`}>
                      {order.status === 'ready' ? 'في الطريق' : 'ينتظر السائق'}
                    </span>
                    <p className="font-bold text-gray-900 dark:text-white">{order.client_name}</p>
                  </div>
                  {order.delivery_address && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">📍 {order.delivery_address}</p>
                  )}
                  <div className="flex justify-between items-center">
                    {order.driver_name
                      ? <p className="text-xs text-blue-500 dark:text-blue-400">🏍️ {order.driver_name}</p>
                      : <span />}
                    <p className="text-green-500 font-bold text-sm">{order.total_amount.toLocaleString()} <span className="text-xs text-gray-400 font-normal">د.ع</span></p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* ═══ عرض الطلبات العادي ═══ */
          <div className="space-y-3">
            {filtered.map(order => {
              const cfg = STATUS[order.status as keyof typeof STATUS] ?? STATUS.completed;
              const wait = order.status !== 'completed' ? waitInfo(order.created_at) : null;
              const countdown = order.status === 'pending' ? getCountdown(order.created_at) : null;
              void tick;
              return (
                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                  {countdown ? (
                    <>
                      <div className="relative h-2 bg-gray-100 dark:bg-slate-700">
                        <div className="absolute inset-y-0 right-0 transition-all duration-1000"
                          style={{ width: `${countdown.pct * 100}%`, backgroundColor: countdown.urgent ? '#ef4444' : countdown.pct > 0.5 ? '#22c55e' : '#f59e0b' }} />
                      </div>
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
                              {img && <img src={img} alt={item.item_name} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
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
                      <div className="mt-2 w-full flex items-center bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2 gap-2">
                        <span className="text-xl">🏍️</span>
                        <div className="text-right">
                          <p className="text-blue-700 dark:text-blue-300 font-bold text-sm">{order.driver_name}</p>
                          <p className="text-blue-500 text-xs" dir="ltr">{order.driver_phone}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {order.status === 'pending' ? (
                    <div className="grid grid-cols-2">
                      <button onClick={() => rejectOrder(order.id)} className="py-4 text-white font-bold text-base transition-all active:opacity-80 bg-red-500">✕ رفض</button>
                      <button onClick={() => handleAction(order)} className="py-4 text-white font-bold text-base transition-all active:opacity-80 bg-blue-600">✓ قبول</button>
                    </div>
                  ) : cfg.next ? (
                    <button onClick={() => handleAction(order)}
                      className="w-full py-4 text-white font-bold text-base transition-all active:opacity-80"
                      style={{ backgroundColor: cfg.btnColor }}>
                      {cfg.nextLabel}
                    </button>
                  ) : (
                    <div className="w-full py-4 bg-gray-100 dark:bg-slate-700 text-center text-gray-400 dark:text-slate-500 font-bold text-sm">
                      ✓ مكتمل
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AdminBottomNav />

      {selectedOrder && (
        <DeliveryModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}

