'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminBottomNav } from '@/components/BottomNav';
import { Send, ChevronDown, MapPin, X, Locate } from 'lucide-react';
import { useRestaurant } from '@/context/RestaurantContext';

type OrderItem = { id: string; item_name: string; quantity: number; price: number };
type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; client_note: string | null; total_amount: number; status: 'pending' | 'preparing' | 'ready' | 'completed'; created_at: string; items?: OrderItem[]; client_lat: number | null; client_lng: number | null };

function MapModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const myMarkerRef = useRef<any>(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    let watchId: number | null = null;

    import('leaflet').then((mod) => {
      const L = (mod as any).default ?? mod;
      if (!mapContainerRef.current || mapRef.current) return;

      const map = L.map(mapContainerRef.current).setView([order.client_lat!, order.client_lng!], 15);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const customerIcon = L.divIcon({
        html: `<div style="width:36px;height:36px;background:#ef4444;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35)"></div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      L.marker([order.client_lat!, order.client_lng!], { icon: customerIcon })
        .addTo(map)
        .bindPopup(`<div dir="rtl" style="font-family:sans-serif"><b>${order.client_name}</b>${order.delivery_address ? `<br><small style="color:#6b7280">${order.delivery_address}</small>` : ''}</div>`, { offset: [0, -18] })
        .openPopup();

      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            const meIcon = L.divIcon({
              html: `<div style="width:38px;height:38px;background:#2563eb;border-radius:50%;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:18px">📍</div>`,
              className: '',
              iconSize: [38, 38],
              iconAnchor: [19, 19],
            });

            if (myMarkerRef.current) {
              myMarkerRef.current.setLatLng([latitude, longitude]);
            } else {
              myMarkerRef.current = L.marker([latitude, longitude], { icon: meIcon })
                .addTo(map)
                .bindPopup('<div dir="rtl">موقعك الحالي</div>');

              map.fitBounds(
                L.latLngBounds([order.client_lat!, order.client_lng!], [latitude, longitude]),
                { padding: [60, 60] }
              );
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 }
        );
      }
    });

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; myMarkerRef.current = null; }
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, [order]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 active:scale-90 transition-all">
            <X size={16} />
          </button>
          <div className="text-right">
            <p className="font-bold text-gray-900 dark:text-slate-100">{order.client_name}</p>
            {order.delivery_address && <p className="text-xs text-gray-400 dark:text-slate-500">{order.delivery_address}</p>}
          </div>
          <MapPin size={18} className="text-red-500 flex-shrink-0" />
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
          <span className="text-blue-700 dark:text-blue-300 text-xs font-medium flex items-center gap-1.5">
            <Locate size={12} /> يتم تحديد موقعك تلقائياً
          </span>
        </div>
        <div ref={mapContainerRef} style={{ height: 360 }} />
        <button
          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.client_lat},${order.client_lng}&travelmode=driving`, '_blank')}
          className="w-full py-4 bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:opacity-80 transition-all"
        >
          فتح في Google Maps
        </button>
      </div>
    </div>
  );
}
type Driver = { id: string; name: string; phone: string };

const STATUS = {
  pending:   { label: 'واردة',        color: '#f59e0b', next: 'preparing' as const, nextLabel: 'ابدأ التجهيز',  btnColor: '#3b82f6' },
  preparing: { label: 'قيد التجهيز', color: '#3b82f6', next: 'ready'     as const, nextLabel: 'جاهز للتسليم', btnColor: '#22c55e' },
  ready:     { label: 'جاهز',        color: '#22c55e', next: 'completed'  as const, nextLabel: 'تم التسليم',   btnColor: '#6b7280' },
  completed: { label: 'مكتمل',       color: '#9ca3af', next: null,                  nextLabel: '',             btnColor: '#9ca3af' },
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `منذ ${s} ث`;
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  return `منذ ${Math.floor(s / 3600)} س`;
}

const TABS = [
  { id: 'pending'   as const, name: 'واردة' },
  { id: 'preparing' as const, name: 'تجهيز' },
  { id: 'ready'     as const, name: 'جاهز' },
  { id: 'completed' as const, name: 'مكتمل' },
];

export default function OrdersPage() {
  const { restaurantId } = useRestaurant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'preparing' | 'ready' | 'completed'>('pending');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [mapOrder, setMapOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
    if (restaurantId) q = q.eq('restaurant_id', restaurantId) as typeof q;
    const { data } = await q;
    if (!data) { setLoading(false); return; }
    const withItems = await Promise.all(data.map(async o => {
      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', o.id);
      return { ...o, items: items || [] };
    }));
    setOrders(withItems);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    let dq = supabase.from('drivers').select('id, name, phone');
    if (restaurantId) dq = dq.eq('restaurant_id', restaurantId) as typeof dq;
    dq.then(({ data }) => setDrivers(data || []));
  }, [restaurantId]);

  useEffect(() => {
    const ch = supabase.channel('orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  const advance = async (order: Order) => {
    const next = STATUS[order.status].next;
    if (!next) return;
    await supabase.from('orders').update({ status: next }).eq('id', order.id);
    fetchOrders();
  };

  const sendToDriver = async (order: Order) => {
    const driverId = selectedDriver[order.id];
    if (!driverId) return;
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;

    setSending(prev => ({ ...prev, [order.id]: true }));

    await supabase.from('orders').update({
      driver_name: driver.name,
      driver_phone: driver.phone,
      driver_id: driverId,
    }).eq('id', order.id);

    const link = `${window.location.origin}/delivery/${order.id}`;
    fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': process.env.NEXT_PUBLIC_API_SECRET! },
      body: JSON.stringify({ driver_id: driverId, title: '🛵 طلب جديد!', body: `طلب جديد من ${order.client_name}`, url: link, tag: 'new-order' }),
    }).catch(() => {});

    setSending(prev => ({ ...prev, [order.id]: false }));
    fetchOrders();
  };

  const filtered = orders.filter(o => o.status === tab);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 stagger-0">
        <div className="flex border-b border-gray-100 dark:border-slate-700">
          {TABS.map(t => {
            const cfg = STATUS[t.id];
            const count = orders.filter(o => o.status === t.id).length;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 py-4 text-center transition-all border-b-2 flex flex-col items-center gap-1"
                style={{ borderBottomColor: active ? cfg.color : 'transparent' }}>
                <span className={`text-sm font-bold ${active ? '' : 'text-gray-400 dark:text-slate-500'}`}
                  style={{ color: active ? cfg.color : undefined }}>
                  {t.name}
                </span>
                {count > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: active ? cfg.color : '#d1d5db' }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <div className="px-4 pt-4 stagger-1">
        {loading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-slate-500 mt-20">لا توجد طلبات</p>
        ) : (
          <div className="space-y-4">
            {filtered.map(order => {
              const cfg = STATUS[order.status];
              return (
                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                  <div className="h-1.5" style={{ backgroundColor: cfg.color }} />
                  <div className="p-4">
                    {/* Client + price */}
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-50 dark:border-slate-700">
                      <p className="text-green-500 font-bold text-lg">{order.total_amount.toLocaleString()} <span className="text-xs text-gray-400 font-normal">د.ع</span></p>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-slate-100 text-base">{order.client_name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{order.client_phone}{order.delivery_address ? ` — ${order.delivery_address}` : ''}</p>
                      </div>
                    </div>
                    {/* Items */}
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 mb-3 space-y-2">
                      {order.items?.map(i => (
                        <div key={i.id} className="flex justify-between items-center">
                          <span className="text-[#f97316] font-semibold text-sm">{(i.price * i.quantity).toLocaleString()} د.ع</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-800 dark:text-slate-200 text-sm">{i.item_name}</span>
                            <span className="bg-white dark:bg-slate-600 text-gray-600 dark:text-slate-300 text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center">{i.quantity}×</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {order.client_note && <p className="text-sm text-amber-600 dark:text-amber-400 text-right">📝 {order.client_note}</p>}
                    {order.client_lat && order.client_lng && (
                      <button
                        onClick={() => setMapOrder(order)}
                        className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-red-500 active:scale-95 transition-all"
                      >
                        <MapPin size={14} /> عرض موقع العميل على الخريطة
                      </button>
                    )}
                  </div>

                  {/* Driver assignment — only for ready orders */}
                  {order.status === 'ready' && (
                    <div className="px-4 pb-3 space-y-2 border-b border-gray-50 dark:border-slate-700">
                      <p className="text-xs text-gray-400 dark:text-slate-500 text-right font-medium">إرسال للسائق عبر واتساب</p>
                      <div className="relative">
                        <select
                          value={selectedDriver[order.id] || ''}
                          onChange={e => setSelectedDriver(prev => ({ ...prev, [order.id]: e.target.value }))}
                          dir="rtl"
                          className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-right text-sm text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#22c55e] appearance-none"
                        >
                          <option value="">اختر سائقاً...</option>
                          {drivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name} — {d.phone}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      {selectedDriver[order.id] && (
                        <button
                          onClick={() => sendToDriver(order)}
                          disabled={sending[order.id]}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white font-bold rounded-xl text-sm active:opacity-80 transition-all disabled:opacity-60"
                        >
                          {sending[order.id]
                            ? 'جاري الإرسال...'
                            : <><Send size={15} /> إرسال عبر واتساب</>
                          }
                        </button>
                      )}
                    </div>
                  )}

                  {/* Full-width action button */}
                  {cfg.next ? (
                    <button onClick={() => advance(order)}
                      className="w-full py-4 text-white font-bold text-base transition-all active:opacity-80"
                      style={{ backgroundColor: cfg.btnColor }}>
                      {cfg.nextLabel}
                    </button>
                  ) : (
                    <div className="w-full py-4 bg-gray-100 dark:bg-slate-700 text-center text-gray-400 font-bold text-sm">✓ مكتمل</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AdminBottomNav />
      {mapOrder && <MapModal order={mapOrder} onClose={() => setMapOrder(null)} />}
    </div>
  );
}

