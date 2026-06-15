'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminBottomNav } from '@/components/BottomNav';
import { Moon, Sun, ClipboardList, Clock } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useNewOrders } from '@/context/NewOrdersContext';

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



function DeliveryModal({ order: init, onClose }: { order: Order; onClose: () => void }) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const [order, setOrder] = useState(init);

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
      const icon = L.divIcon({
        html: '<div style="width:34px;height:34px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center;font-size:18px">🏠</div>',
        className: '', iconSize: [34, 34], iconAnchor: [17, 17],
      });
      L.marker([order.client_lat!, order.client_lng!], { icon }).addTo(map)
        .bindPopup(`<b dir="rtl">${order.client_name}</b>`);
    });
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; driverMarkerRef.current = null; }
    };
  }, [order.client_lat, order.client_lng, order.client_name]);

  useEffect(() => {
    if (!mapInstanceRef.current || !order.driver_lat || !order.driver_lng) return;
    import('leaflet').then((mod) => {
      const L = (mod as any).default ?? mod;
      if (!mapInstanceRef.current) return;
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([order.driver_lat!, order.driver_lng!]);
      } else {
        const icon = L.divIcon({
          html: '<div style="width:40px;height:40px;background:#2563eb;border-radius:50%;border:3px solid white;box-shadow:0 3px 14px rgba(37,99,235,0.5);display:flex;align-items:center;justify-content:center;font-size:22px">🏍️</div>',
          className: '', iconSize: [40, 40], iconAnchor: [20, 20],
        });
        driverMarkerRef.current = L.marker([order.driver_lat!, order.driver_lng!], { icon }).addTo(mapInstanceRef.current);
        if (order.client_lat && order.client_lng) {
          mapInstanceRef.current.fitBounds(
            L.latLngBounds([order.client_lat, order.client_lng], [order.driver_lat!, order.driver_lng!]),
            { padding: [40, 40] }
          );
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
          /* ═══ تاب قيد التوصيل — بطاقات مضغوطة ═══ */
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(order => (
              <button key={order.id} onClick={() => setSelectedOrder(order)}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 text-right active:scale-95 transition-all overflow-hidden flex flex-col">
                <div className={`h-1 rounded-full mb-3 w-full ${order.status === 'ready' ? 'bg-purple-500' : 'bg-orange-500'}`} />
                <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{order.client_name}</p>
                {order.delivery_address && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 leading-tight line-clamp-2">📍 {order.delivery_address}</p>
                )}
                <p className="text-green-500 font-bold text-sm mt-2">{order.total_amount.toLocaleString()} <span className="text-xs text-gray-400 font-normal">د.ع</span></p>
                {order.driver_name && <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">🏍️ {order.driver_name}</p>}
                <span className={`mt-2 text-xs font-bold px-2 py-0.5 rounded-full self-end ${
                  order.status === 'ready'
                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                    : 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                }`}>
                  {order.status === 'ready' ? 'في الطريق' : 'ينتظر السائق'}
                </span>
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

export default function DashboardPageGuarded() {
  return <AdminGuard><DashboardPage /></AdminGuard>;
}
