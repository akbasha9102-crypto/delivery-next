'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminBottomNav } from '@/components/BottomNav';
import { Moon, Sun, ClipboardList, Clock, ChevronLeft, MapPin, AlertTriangle, User, Phone, X, Check } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useNewOrders } from '@/context/NewOrdersContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';

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

function LocationModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const routeLineRef   = useRef<any>(null);
  const [myPos, setMyPos] = useState<[number, number] | null>(null);
  const [locErr, setLocErr] = useState(false);

  // جلب موقع المطعم (الجهاز الحالي)
  useEffect(() => {
    if (!navigator.geolocation) { setLocErr(true); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setMyPos([pos.coords.latitude, pos.coords.longitude]),
      ()  => setLocErr(true),
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  // تهيئة الخريطة
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !order.client_lat || !order.client_lng) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    import('leaflet').then(mod => {
      const L = (mod as any).default ?? mod;
      if (!mapRef.current || mapInstanceRef.current) return;
      const map = L.map(mapRef.current, { attributionControl: false, zoomControl: true })
        .setView([order.client_lat!, order.client_lng!], 14);
      mapInstanceRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      // ماركر الزبون (أحمر)
      const custIcon = L.divIcon({
        html: `<div style="width:32px;height:38px;position:relative">
          <div style="width:32px;height:32px;background:#ef4444;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3)"></div>
          <span style="position:absolute;top:4px;left:0;width:32px;text-align:center;font-size:13px">🏠</span>
        </div>`,
        className: '', iconSize: [32, 38], iconAnchor: [16, 38],
      });
      L.marker([order.client_lat!, order.client_lng!], { icon: custIcon }).addTo(map)
        .bindPopup(`<b dir="rtl">${order.client_name}</b>${order.delivery_address ? `<br><small>${order.delivery_address}</small>` : ''}`, { offset: [0, -20] })
        .openPopup();
    });
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; routeLineRef.current = null; }
    };
  }, [order.client_lat, order.client_lng, order.client_name, order.delivery_address]);

  // رسم الخط والماركر بعد جلب موقعي
  useEffect(() => {
    if (!mapInstanceRef.current || !myPos || !order.client_lat || !order.client_lng) return;
    import('leaflet').then(mod => {
      const L = (mod as any).default ?? mod;
      if (!mapInstanceRef.current) return;

      // ماركر المطعم (أزرق)
      const restIcon = L.divIcon({
        html: `<div style="width:32px;height:38px;position:relative">
          <div style="width:32px;height:32px;background:#2563eb;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3)"></div>
          <span style="position:absolute;top:4px;left:0;width:32px;text-align:center;font-size:13px">🍽️</span>
        </div>`,
        className: '', iconSize: [32, 38], iconAnchor: [16, 38],
      });
      L.marker(myPos, { icon: restIcon }).addTo(mapInstanceRef.current)
        .bindPopup('<b>موقعك (المطعم)</b>');

      // Fit الخريطة على الموقعين
      mapInstanceRef.current.fitBounds(
        L.latLngBounds(myPos, [order.client_lat!, order.client_lng!]),
        { padding: [50, 50] }
      );

      // جلب المسار عبر OSRM
      const [rLat, rLng] = myPos;
      const [cLat, cLng] = [order.client_lat!, order.client_lng!];
      fetch(`https://router.project-osrm.org/route/v1/driving/${rLng},${rLat};${cLng},${cLat}?overview=full&geometries=geojson`)
        .then(r => r.json())
        .then(json => {
          const coords = json.routes?.[0]?.geometry?.coordinates?.map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
          );
          if (!coords?.length || !mapInstanceRef.current) return;
          routeLineRef.current = L.polyline(coords, {
            color: '#2563eb', weight: 5, opacity: 0.85,
          }).addTo(mapInstanceRef.current);
          routeLineRef.current.bringToBack();
        })
        .catch(() => {
          // إذا فشل OSRM ارسم خط مباشر
          if (mapInstanceRef.current)
            L.polyline([myPos, [order.client_lat!, order.client_lng!]], {
              color: '#2563eb', weight: 4, opacity: 0.7, dashArray: '8 6',
            }).addTo(mapInstanceRef.current);
        });
    });
  }, [myPos, order.client_lat, order.client_lng]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl w-full" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mt-3 mb-3" />
        <div className="flex items-center justify-between px-5 pb-3">
          <button onClick={onClose} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">✕</button>
          <div className="text-right">
            <p className="font-bold text-gray-900 dark:text-white">{order.client_name}</p>
            {order.delivery_address && <p className="text-xs text-gray-400 mt-0.5">{order.delivery_address}</p>}
          </div>
        </div>
        {order.client_lat && order.client_lng ? (
          <div className="relative">
            <div ref={mapRef} style={{ height: 380 }} className="w-full" />
            {!myPos && !locErr && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 rounded-xl px-3 py-1.5 text-xs text-gray-500 shadow">
                📡 جاري تحديد موقع المطعم...
              </div>
            )}
            {locErr && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 rounded-xl px-3 py-1.5 text-xs text-red-400 shadow">
                ⚠️ تعذر تحديد موقعك
              </div>
            )}
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-700 mx-4 mb-4 rounded-2xl">
            <p className="text-3xl mb-2">📍</p>
            <p className="text-gray-400 text-sm">لا يوجد موقع GPS للزبون</p>
          </div>
        )}
        <div className="pb-6" />
      </div>
    </div>
  );
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
  const [filter,        setFilter]        = useState<'pending'|'preparing'|'pickup'|'delivery'|'completed'>('pending');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [locationOrder, setLocationOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpandedOrders(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [islandExpanded, setIslandExpanded] = useState(false);
  const islandControls = useAnimation();
  const [tick,          setTick]          = useState(0);
  const [driverPopup,   setDriverPopup]   = useState<string | null>(null);


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
          setIslandExpanded(false);
          setTimeout(() => setIslandExpanded(true), 220);
          setTimeout(() => setNewOrderFlash(false), 4500);
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

  const counts = { pending: 0, preparing: 0, pickup: 0, delivery: 0, completed: 0 };
  orders.forEach(o => {
    if (o.status === 'pending')        counts.pending++;
    else if (o.status === 'preparing') counts.preparing++;
    else if (o.status === 'pickup')    counts.pickup++;
    else if (o.status === 'ready')     counts.delivery++;
    else if (o.status === 'completed') counts.completed++;
  });
  const todayRevenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.total_amount, 0);
  const filtered = orders.filter(o =>
    filter === 'delivery' ? o.status === 'ready' : o.status === filter
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 md:pb-0 md:mr-[70px]">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
        <button onClick={toggleDark} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 active:scale-90 transition-all">
          {dark ? <Sun size={16} className="text-yellow-400" /> : <Moon size={16} className="text-gray-600" />}
        </button>
        <div className="flex items-center gap-1.5">
          <ClipboardList size={18} className="text-[#f97316]" />
          <p className="font-bold text-red-500">الطلبات</p>
        </div>
        <div className="w-10" />
      </header>


      {/* إشعار طلب جديد — Dynamic Island */}
      <AnimatePresence>
        {newOrderFlash && (
          <motion.div
            key="new-order-notif"
            initial={{ width: 110, height: 34, borderRadius: 34, opacity: 0, y: -16, x: '-50%' }}
            animate={{
              width: islandExpanded ? 300 : 110,
              height: islandExpanded ? 58 : 34,
              borderRadius: islandExpanded ? 26 : 34,
              opacity: 1,
              y: 0,
              x: '-50%',
            }}
            exit={{ width: 110, height: 34, borderRadius: 34, opacity: 0, y: -16, x: '-50%' }}
            transition={{
              width:        { duration: 0.4, ease: [0.34, 1.15, 0.64, 1] },
              height:       { duration: 0.4, ease: [0.34, 1.15, 0.64, 1] },
              borderRadius: { duration: 0.4, ease: [0.34, 1.15, 0.64, 1] },
              opacity:      { duration: 0.2 },
              y:            { duration: 0.25, ease: [0.34, 1.56, 0.64, 1] },
            }}
            className="fixed top-3 left-1/2 z-[100] overflow-hidden flex items-center justify-center bg-[#120f00] shadow-[0_6px_28px_rgba(251,191,36,0.3),0_2px_8px_rgba(0,0,0,0.4)]"
          >
            <AnimatePresence>
              {islandExpanded && (
                <motion.div
                  key="island-content"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2, ease: 'backOut', delay: 0.05 }}
                  className="flex items-center gap-2.5 px-4 w-full"
                >
                  <motion.span
                    animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                    transition={{ duration: 0.5, delay: 0.15, ease: 'easeInOut' }}
                    className="text-lg leading-none select-none"
                  >🔔</motion.span>
                  <div className="flex-1 text-right">
                    <p className="text-yellow-400 font-black text-[13px] leading-tight">طلب جديد وصل!</p>
                    <p className="text-yellow-300/50 text-[10px] leading-tight mt-0.5">اضغط للمراجعة</p>
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.4, 1, 1.3, 1] }}
                    transition={{ duration: 0.8, delay: 0.3, ease: 'easeInOut' }}
                    className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.7)] flex-shrink-0"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* تابس الفلتر */}
      <div className="flex px-3 py-3 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 w-full">
        {(['pending','preparing','pickup','delivery','completed'] as const).map((tab, idx, arr) => {
          const isActive = filter === tab;
          const count    = counts[tab] || 0;
          const labels   = { pending: 'واردة', preparing: 'التجهيز', pickup: 'انتظار السائق', delivery: 'التوصيل', completed: 'مكتمل' };
          const btn = (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`flex-1 min-w-[60px] py-2 px-2 rounded-2xl text-xs font-bold text-center border transition-all active:scale-95 ${isActive ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-white'}`}>
              <span className="block">{labels[tab]}</span>
              {count > 0 && (
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-black mt-1 ${isActive ? 'bg-white text-[#f97316]' : 'bg-[#f97316] text-white'}`}>
                  {count}
                </span>
              )}
            </button>
          );
          return idx < arr.length - 1
            ? [btn, (
                <svg key={`arrow-${idx}`} className="flex-shrink-0 text-gray-400 dark:text-slate-500" width="16" height="8" viewBox="0 0 18 8" fill="none">
                  <path d="M17 4H1M5 1L1 4L5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )]
            : btn;
        })}
        </div>
      </div>

      {/* الطلبات */}
      <div className="px-3">
        {loading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center mt-20"><p className="text-4xl mb-3">📋</p><p className="text-gray-400 dark:text-slate-500">لا توجد طلبات</p></div>
        ) : filter === 'delivery' ? (
          /* ═══ تاب قيد التوصيل — كل طلب بطاقة مستقلة ═══ */
          <div className="space-y-3 max-w-3xl mx-auto">
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
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">
                      <span className="text-gray-400">📍 العنوان: </span>{order.delivery_address}
                    </p>
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
        ) : filter === 'preparing' ? (
          /* ═══ تاب قيد التجهيز — كارت مضغوط مع سهم للتوسيع ═══ */
          <div className="space-y-2 max-w-3xl mx-auto">
            {filtered.map(order => {
              const isOpen = expandedOrders.has(order.id);
              return (
                <div key={order.id} className="relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                  {/* أيقونة السائق في الزاوية */}
                  <button
                    onClick={e => { e.stopPropagation(); setDriverPopup(driverPopup === order.id ? null : order.id); }}
                    className={`absolute top-2 left-2 z-10 w-7 h-7 rounded-full flex items-center justify-center text-white text-base shadow active:scale-90 transition-transform ${order.driver_id ? 'bg-green-500' : 'bg-red-500'}`}
                  >
                    🏍️
                  </button>
                  <div className="h-1.5 bg-blue-400" />
                  {/* الصف الرئيسي — الوجبة + العنوان + السهم */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      onClick={() => toggleExpand(order.id)}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-700 transition-all active:scale-90"
                    >
                      <svg
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                        className={`text-gray-500 dark:text-slate-300 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                      >
                        <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="font-bold text-gray-900 dark:text-white text-sm truncate">
                        {order.items?.map(i => `${i.quantity}× ${i.item_name}`).join('، ')}
                      </p>
                      {order.delivery_address && (
                        <div className="flex items-center gap-1 mt-0.5 justify-end">
                          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{order.delivery_address}</p>
                          {order.client_lat && order.client_lng && (
                            <button onClick={e => { e.stopPropagation(); setLocationOrder(order); }} className="flex-shrink-0 text-blue-500 active:scale-90 transition-transform">
                              <MapPin size={20} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* التفاصيل الكاملة — تظهر عند الضغط */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="details"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-2 border-t border-gray-100 dark:border-slate-700 pt-2 space-y-1.5">
                          {/* المجموع */}
                          <div className="flex justify-between items-center">
                            <span className="text-green-500 font-black text-lg">{order.total_amount.toLocaleString()} <span className="text-xs text-gray-400 font-normal">د.ع</span></span>
                            <span className="text-xs text-blue-500 font-bold">قيد التجهيز</span>
                          </div>
                          {/* الأصناف */}
                          <div className="space-y-1">
                            {order.items?.map(item => {
                              const img = imageMap.get(item.item_name);
                              return (
                                <div key={item.id} className="flex justify-between items-center">
                                  <span className="text-[#f97316] font-bold text-sm">{(item.price * item.quantity).toLocaleString()} <span className="text-xs font-normal text-gray-400">د.ع</span></span>
                                  <div className="flex items-center gap-1.5">
                                    {img && <img src={img} alt={item.item_name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
                                    <span className="text-gray-800 dark:text-slate-200 font-semibold text-sm">{item.item_name}</span>
                                    <span className="bg-[#f97316] text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">{item.quantity}×</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* الاسم */}
                          <p className="font-bold text-gray-900 dark:text-white text-right text-sm">
                            <span className="text-gray-400 text-xs font-normal">الاسم: </span>{order.client_name}
                          </p>
                          {/* الهاتف */}
                          {order.client_phone && (
                            <a
                              href={`https://wa.me/${order.client_phone.replace(/\D/g,'').replace(/^0/,'964')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 justify-end text-red-500 active:scale-95 transition-transform text-xs"
                            >
                              <span dir="ltr">{order.client_phone}</span>
                              <span className="font-semibold">الرقم:</span>
                              <Phone size={14} className="flex-shrink-0" />
                            </a>
                          )}
                          {/* العنوان */}
                          {order.delivery_address && (
                            <div className="flex items-center gap-1 justify-end text-xs">
                              <span className="text-gray-500 dark:text-slate-400">{order.delivery_address}</span>
                              {order.client_lat && order.client_lng ? (
                                <button onClick={() => setLocationOrder(order)} className="flex items-center gap-1 text-blue-500 active:scale-90 transition-transform flex-shrink-0">
                                  <span className="font-semibold">العنوان:</span>
                                  <MapPin size={20} />
                                </button>
                              ) : (
                                <span className="text-gray-400">العنوان:</span>
                              )}
                            </div>
                          )}
                          {order.client_note && <p className="text-xs text-amber-600 dark:text-amber-400 text-right">📝 {order.client_note}</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* زر جاهز للتسليم — دائماً ظاهر */}
                  <button onClick={() => handleAction(order)} className="w-full py-2 text-white font-bold text-sm active:opacity-80 bg-orange-500">
                    جاهز للتسليم ✓
                  </button>
                </div>
              );
            })}
          </div>
        ) : filter === 'pickup' ? (
          /* ═══ تاب انتظار السائق ═══ */
          <div className="space-y-2 max-w-3xl mx-auto">
            {filtered.map(order => {
              const isOpen = expandedOrders.has(order.id);
              return (
                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                  <div className="h-1.5 bg-orange-400" />
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      onClick={() => toggleExpand(order.id)}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-700 transition-all active:scale-90"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                        className={`text-gray-500 dark:text-slate-300 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                        <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="font-bold text-gray-900 dark:text-white text-sm truncate">
                        {order.items?.map(i => `${i.quantity}× ${i.item_name}`).join('، ')}
                      </p>
                      {order.delivery_address && (
                        <div className="flex items-center gap-1 mt-0.5 justify-end">
                          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{order.delivery_address}</p>
                          {order.client_lat && order.client_lng && (
                            <button onClick={e => { e.stopPropagation(); setLocationOrder(order); }} className="flex-shrink-0 text-blue-500 active:scale-90 transition-transform">
                              <MapPin size={20} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {order.driver_name && (
                      <button
                        onClick={e => { e.stopPropagation(); setDriverPopup(driverPopup === order.id ? null : order.id); }}
                        className="flex-shrink-0 text-xs text-blue-500 font-bold active:scale-90 transition-transform"
                      >
                        🏍️ {order.driver_name}
                      </button>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="details"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 border-t border-gray-100 dark:border-slate-700 pt-2 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-green-500 font-black text-lg">{order.total_amount.toLocaleString()} <span className="text-xs text-gray-400 font-normal">د.ع</span></span>
                            <span className="text-xs text-orange-500 font-bold">⏳ في انتظار السائق</span>
                          </div>
                          <div className="space-y-1">
                            {order.items?.map(item => {
                              const img = imageMap.get(item.item_name);
                              return (
                                <div key={item.id} className="flex justify-between items-center">
                                  <span className="text-[#f97316] font-bold text-sm">{(item.price * item.quantity).toLocaleString()} <span className="text-xs font-normal text-gray-400">د.ع</span></span>
                                  <div className="flex items-center gap-1.5">
                                    {img && <img src={img} alt={item.item_name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
                                    <span className="text-gray-800 dark:text-slate-200 font-semibold text-sm">{item.item_name}</span>
                                    <span className="bg-[#f97316] text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">{item.quantity}×</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="font-bold text-gray-900 dark:text-white text-right text-sm">
                            <span className="text-gray-400 text-xs font-normal">الاسم: </span>{order.client_name}
                          </p>
                          {order.client_phone && (
                            <a
                              href={`https://wa.me/${order.client_phone.replace(/\D/g,'').replace(/^0/,'964')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 justify-end text-red-500 active:scale-95 transition-transform text-xs"
                            >
                              <span dir="ltr">{order.client_phone}</span>
                              <span className="font-semibold">الرقم:</span>
                              <Phone size={14} className="flex-shrink-0" />
                            </a>
                          )}
                          {order.delivery_address && (
                            <div className="flex items-center gap-1 justify-end text-xs">
                              <span className="text-gray-500 dark:text-slate-400">{order.delivery_address}</span>
                              {order.client_lat && order.client_lng ? (
                                <button onClick={() => setLocationOrder(order)} className="flex items-center gap-1 text-blue-500 active:scale-90 transition-transform flex-shrink-0">
                                  <span className="font-semibold">العنوان:</span>
                                  <MapPin size={20} />
                                </button>
                              ) : (
                                <span className="text-gray-400">العنوان:</span>
                              )}
                            </div>
                          )}
                          {order.client_note && <p className="text-xs text-amber-600 dark:text-amber-400 text-right">📝 {order.client_note}</p>}
                          {order.driver_name && (
                            <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 rounded-xl px-2.5 py-1.5 gap-2">
                              <span>🏍️</span>
                              <div className="text-right">
                                <p className="text-blue-700 dark:text-blue-300 font-bold text-xs">{order.driver_name}</p>
                                {order.driver_phone && <p className="text-blue-500 text-xs" dir="ltr">{order.driver_phone}</p>}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : (
          /* ═══ عرض الطلبات العادي ═══ */
          <div className="space-y-3 max-w-3xl mx-auto">
            {filtered.map(order => {
              const cfg = STATUS[order.status as keyof typeof STATUS] ?? STATUS.completed;
              const wait = order.status !== 'completed' ? waitInfo(order.created_at) : null;
              const countdown = order.status === 'pending' ? getCountdown(order.created_at) : null;
              void tick;
              return order.status === 'pending' && countdown ? (
                  /* ══════════════ كارت الواردة ══════════════ */
                  <div key={order.id} className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-md border border-gray-100 dark:border-slate-700" dir="rtl">

                    {/* 1. شريط التنبيه العلوي */}
                    <div className={`flex items-center justify-between px-4 py-2.5 ${countdown.urgent ? 'bg-red-500' : 'bg-amber-500'}`}>
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-white" />
                        <span className={`font-black text-white text-sm tabular-nums ${countdown.urgent ? 'animate-pulse' : ''}`}>
                          {fmtCountdown(countdown.secs)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm">
                          {countdown.urgent ? 'على وشك الإلغاء' : 'في انتظار القبول'}
                        </span>
                        <AlertTriangle size={15} className="text-white flex-shrink-0" />
                      </div>
                    </div>

                    {/* 2. رقم الطلب */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="font-bold text-gray-900 dark:text-slate-100 text-base">#طلب {order.id.slice(-4).toUpperCase()}</span>
                      <span className="text-base text-gray-700 dark:text-slate-300 font-bold">طلب توصيل</span>
                    </div>
                    <div className="h-px bg-gray-100 dark:bg-slate-700 mx-4" />

                    {/* 3. الوجبات */}
                    <div className="px-4 pt-3 pb-3 space-y-2.5">
                      {order.items?.map(item => {
                        const img = imageMap.get(item.item_name);
                        return (
                          <div key={item.id} className="flex items-center gap-3">
                            {/* الصورة على اليمين */}
                            {img
                              ? <img src={img} alt={item.item_name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-gray-100 dark:border-slate-600" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                              : <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-3xl flex-shrink-0">🍽️</div>
                            }
                            {/* الاسم والكمية مباشرة جنب الصورة */}
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-7 h-7 bg-orange-500 text-white text-sm font-black rounded-full inline-flex items-center justify-center flex-shrink-0">{item.quantity}×</span>
                              <span className="font-black text-gray-900 dark:text-slate-100 text-lg">{item.item_name}</span>
                            </div>
                            {/* فاصل */}
                            <div className="flex-1" />
                            {/* السعر على اليسار */}
                            <div className="text-left shrink-0">
                              <span className="text-gray-900 dark:text-slate-100 font-black text-xl block">{(item.price * item.quantity).toLocaleString()}</span>
                              <span className="text-xs text-gray-400">د.ع</span>
                            </div>
                          </div>
                        );
                      })}
                      {order.client_note && (
                        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-lg px-3 py-2">
                          <span className="text-amber-600 dark:text-amber-400 text-xs flex-1 text-right">{order.client_note}</span>
                          <span className="flex-shrink-0">📝</span>
                        </div>
                      )}
                    </div>
                    <div className="h-px bg-gray-100 dark:bg-slate-700 mx-4" />

                    {/* 4. بيانات العميل */}
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="text-gray-400 text-sm">الاسم:</span>
                        <span className="font-bold text-gray-700 dark:text-slate-200 text-sm">{order.client_name}</span>
                      </div>
                      {order.client_phone && (
                        <a
                          href={`https://wa.me/${order.client_phone.replace(/\D/g,'').replace(/^0/,'964')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-red-500 active:scale-95 transition-transform"
                        >
                          <Phone size={20} className="flex-shrink-0" />
                          <span className="text-sm font-semibold">الرقم:</span>
                          <span className="text-sm font-semibold" dir="ltr">{order.client_phone}</span>
                        </a>
                      )}
                      {order.delivery_address && (
                        <div className="flex items-center gap-2">
                          {order.client_lat && order.client_lng ? (
                            <button onClick={() => setLocationOrder(order)} className="flex items-center gap-1.5 text-blue-500 active:scale-95 transition-transform flex-shrink-0">
                              <MapPin size={20} />
                              <span className="text-sm font-semibold">العنوان:</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 text-gray-400 flex-shrink-0">
                              <MapPin size={20} />
                              <span className="text-sm">العنوان:</span>
                            </div>
                          )}
                          <span className="text-gray-600 dark:text-slate-300 text-sm">{order.delivery_address}</span>
                        </div>
                      )}
                    </div>
                    <div className="h-px bg-gray-100 dark:bg-slate-700 mx-4" />

                    {/* 5. الإجمالي */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-green-500 dark:text-green-400 font-black text-xl">
                        {order.total_amount.toLocaleString()} <span className="text-xs font-normal text-gray-400">د.ع</span>
                      </span>
                      <span className="font-bold text-gray-900 dark:text-slate-100 text-base">الإجمالي:</span>
                    </div>

                    {/* 6. أزرار الإجراءات */}
                    <div className="flex gap-3 px-4 pb-4">
                      <button
                        onClick={() => rejectOrder(order.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 text-white font-bold rounded-xl text-sm transition-all active:scale-95"
                      >
                        <X size={16} strokeWidth={2.5} />
                        <span>رفض</span>
                      </button>
                      <button
                        onClick={() => handleAction(order)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-bold rounded-xl text-sm transition-all active:scale-95"
                      >
                        <Check size={16} strokeWidth={2.5} />
                        <span>قبول</span>
                      </button>
                    </div>
                  </div>
                ) : (
                /* ══════════════ كروت الحالات الأخرى (بدون تغيير) ══════════════ */
                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                  <div className="h-1.5" style={{ backgroundColor: cfg.color }} />
                  <div className="px-3 py-2.5">
                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                      <span className="text-green-500 font-black text-xl">{order.total_amount.toLocaleString()} <span className="text-xs text-gray-400 font-normal">د.ع</span></span>
                      {wait && (
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: wait.color }} />
                          <span className="text-xs font-bold" style={{ color: wait.color }}>{wait.text}</span>
                        </div>
                      )}
                    </div>
                    <div className="mb-2 space-y-1.5">
                      {order.items?.map(item => {
                        const img = imageMap.get(item.item_name);
                        return (
                          <div key={item.id} className="flex justify-between items-center">
                            <span className="text-[#f97316] font-bold text-sm">{(item.price * item.quantity).toLocaleString()} <span className="text-xs font-normal text-gray-400">د.ع</span></span>
                            <div className="flex items-center gap-1.5">
                              {img && <img src={img} alt={item.item_name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
                              <span className="text-gray-800 dark:text-slate-200 font-semibold text-sm">{item.item_name}</span>
                              <span className="bg-[#f97316] text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">{item.quantity}×</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white text-right text-sm mb-1">
                      <span className="text-gray-400 text-xs font-normal">الاسم: </span>{order.client_name}
                    </p>
                    {order.client_phone && (
                      <a
                        href={`https://wa.me/${order.client_phone.replace(/\D/g,'').replace(/^0/,'964')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 justify-end text-red-500 active:scale-95 transition-transform text-xs mb-1"
                      >
                        <span dir="ltr">{order.client_phone}</span>
                        <span className="font-semibold">الرقم:</span>
                        <Phone size={14} className="flex-shrink-0" />
                      </a>
                    )}
                    {order.delivery_address && (
                      <div className="flex items-center gap-1 justify-end text-xs mb-1">
                        <span className="text-gray-500 dark:text-slate-400">{order.delivery_address}</span>
                        {order.client_lat && order.client_lng ? (
                          <button onClick={() => setLocationOrder(order)} className="flex items-center gap-1 text-blue-500 active:scale-90 transition-transform flex-shrink-0">
                            <span className="font-semibold">العنوان:</span>
                            <MapPin size={20} />
                          </button>
                        ) : (
                          <span className="text-gray-400">العنوان:</span>
                        )}
                      </div>
                    )}
                    {order.client_note && <p className="text-xs text-amber-600 dark:text-amber-400 text-right">📝 {order.client_note}</p>}
                    {order.driver_name && (
                      <div className="mt-1.5 w-full flex items-center bg-blue-50 dark:bg-blue-900/20 rounded-xl px-2.5 py-1.5 gap-2">
                        <span className="text-base">🏍️</span>
                        <div className="text-right">
                          <p className="text-blue-700 dark:text-blue-300 font-bold text-xs">{order.driver_name}</p>
                          <p className="text-blue-500 text-xs" dir="ltr">{order.driver_phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {cfg.next ? (
                    <button onClick={() => handleAction(order)}
                      className="w-full py-2.5 text-white font-bold text-sm transition-all active:opacity-80"
                      style={{ backgroundColor: cfg.btnColor }}>
                      {cfg.nextLabel}
                    </button>
                  ) : (
                    <div className="w-full py-2.5 bg-gray-100 dark:bg-slate-700 text-center text-gray-400 dark:text-slate-500 font-bold text-sm">
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

      {locationOrder && (
        <LocationModal order={locationOrder} onClose={() => setLocationOrder(null)} />
      )}

      {/* مودال معلومات السائق */}
      {driverPopup && (() => {
        const o = filtered.find(x => x.id === driverPopup);
        if (!o) return null;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6" onClick={() => setDriverPopup(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 relative shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* زر الإغلاق */}
              <button onClick={() => setDriverPopup(null)} className="absolute top-4 left-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-500 dark:text-slate-300 active:scale-90 transition-transform">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
              {o.driver_id ? (
                <div className="text-right space-y-4">
                  <div className="flex items-center justify-end gap-3">
                    <div>
                      <p className="text-lg font-black text-gray-900 dark:text-white">{o.driver_name}</p>
                      <p className="text-xs text-green-500 font-bold mt-0.5">سائق مخصص لهذا الطلب ✓</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-3xl">🏍️</div>
                  </div>
                  {o.driver_phone && (
                    <div className="space-y-2">
                      <a href={`tel:${o.driver_phone}`} dir="ltr"
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-blue-500 text-white font-bold text-lg active:opacity-80 transition-opacity">
                        📞 {o.driver_phone}
                      </a>
                      <a href={`https://wa.me/${o.driver_phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-green-500 text-white font-bold text-lg active:opacity-80 transition-opacity">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.062.525 4.003 1.447 5.699L.052 23.55a.5.5 0 00.599.6l5.936-1.395A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.032-1.386l-.36-.214-3.733.878.889-3.637-.235-.374A9.817 9.817 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
                        واتساب
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-3 py-2">
                  <div className="text-5xl">🏍️</div>
                  <p className="text-red-500 font-black text-lg">لا يوجد سائق بعد</p>
                  <p className="text-gray-400 dark:text-slate-500 text-sm">لم يقبل أي سائق هذا الطلب حتى الآن</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}


