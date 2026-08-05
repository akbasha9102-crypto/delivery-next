'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useDarkMode } from '@/context/ThemeContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { AdminBottomNav } from '@/components/layout/BottomNav';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { OwnerOnly } from '@/components/guards/OwnerOnly';
import { ChevronRight, ChevronDown, Car, Phone } from 'lucide-react';
import { formatTime12h } from '@/lib/utils/formatTime';

type DriverRow = { id: string; name: string; phone: string; status: string };
type DriverOrder = {
  id: string; driver_id: string | null; driver_name: string | null; driver_phone: string | null;
  total_amount: number; status: string; order_type: string | null;
  delivery_address: string | null; client_name: string; created_at: string; delivered_at: string | null;
};

type DriverStat = {
  id: string;
  name: string;
  phone: string;
  status: string | null;
  completedCount: number;
  revenue: number;
  rejectedCount: number;
  avgDeliveryMins: number | null;
  hasCompletedNoDeliveryData: boolean;
  orders: DriverOrder[];
};

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function quickRange(range: 'today' | 'week' | 'month') {
  const end = new Date(); end.setHours(23,59,59,999);
  const start = new Date(); start.setHours(0,0,0,0);
  if (range === 'week')  start.setDate(start.getDate() - 6);
  if (range === 'month') start.setDate(start.getDate() - 29);
  return { from: localDate(start), to: localDate(end) };
}

export default function DriverStatisticsPage() {
  const router = useRouter();
  const { dark } = useDarkMode();
  const { restaurantId } = useRestaurant();
  const today = localDate();

  const [drivers,  setDrivers]  = useState<DriverRow[]>([]);
  const [orders,   setOrders]   = useState<DriverOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [range,    setRange]    = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [fromDate, setFromDate] = useState(quickRange('week').from);
  const [toDate,   setToDate]   = useState(quickRange('week').to);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!restaurantId) { setLoading(false); return; }
    setLoading(true);
    const start = new Date(fromDate + 'T00:00:00').toISOString();
    const end   = new Date(toDate   + 'T23:59:59').toISOString();

    const [driversRes, ordersRes] = await Promise.all([
      supabase.from('drivers').select('id, name, phone, status').eq('restaurant_id', restaurantId),
      supabase.from('orders')
        .select('id, driver_id, driver_name, driver_phone, total_amount, status, order_type, delivery_address, client_name, created_at, delivered_at')
        .eq('restaurant_id', restaurantId)
        .not('driver_id', 'is', null)
        .gte('created_at', start).lte('created_at', end)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    setDrivers(driversRes.data || []);
    setOrders((ordersRes.data as DriverOrder[]) || []);
    setLoading(false);
  }, [restaurantId, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleQuick = (r: 'today' | 'week' | 'month') => {
    const { from, to } = quickRange(r);
    setFromDate(from); setToDate(to); setRange(r);
  };

  const driverStats = useMemo(() => {
    const map = new Map<string, DriverStat>();

    // نضمن ظهور كل سائق مسجَّل حتى لو ما عنده أي طلب بالفترة المختارة
    drivers.forEach(d => {
      map.set(d.id, { id: d.id, name: d.name, phone: d.phone, status: d.status, completedCount: 0, revenue: 0, rejectedCount: 0, avgDeliveryMins: null, hasCompletedNoDeliveryData: false, orders: [] });
    });

    const durations = new Map<string, number[]>();

    orders.forEach(o => {
      if (!o.driver_id) return;
      const key = o.driver_id;
      const e = map.get(key) || { id: key, name: o.driver_name || 'سائق محذوف', phone: o.driver_phone || '', status: null, completedCount: 0, revenue: 0, rejectedCount: 0, avgDeliveryMins: null, hasCompletedNoDeliveryData: false, orders: [] };
      if (o.status === 'completed') {
        e.completedCount += 1;
        e.revenue += o.total_amount;
        e.orders.push(o);
        if (o.delivered_at) {
          const mins = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60000;
          if (mins >= 0) durations.set(key, [...(durations.get(key) || []), mins]);
        }
      } else if (o.status === 'rejected') {
        e.rejectedCount += 1;
      }
      map.set(key, e);
    });

    durations.forEach((arr, key) => {
      const e = map.get(key);
      if (e) e.avgDeliveryMins = arr.reduce((s, v) => s + v, 0) / arr.length;
    });

    map.forEach(e => {
      if (e.completedCount > 0 && e.avgDeliveryMins === null) e.hasCompletedNoDeliveryData = true;
    });

    return [...map.values()].sort((a, b) => b.completedCount - a.completedCount);
  }, [drivers, orders]);

  const s = {
    bg:      dark ? '#212121' : '#f8fafc',
    surface: dark ? '#1e293b' : '#fff',
    border:  dark ? '#334155' : '#e2e8f0',
    text:    dark ? '#f1f5f9' : '#0f172a',
    sub:     dark ? '#94a3b8' : '#64748b',
    faint:   dark ? '#64748b' : '#94a3b8',
    muted:   dark ? '#334155' : '#f1f5f9',
    divider: dark ? '#475569' : '#e2e8f0',
  };

  return (
    <OwnerOnly>
    <div className="min-h-screen pb-24 md:pb-0 md:mr-[70px]" style={{ backgroundColor: s.bg }}>

      <AdminHeader
        style={{ backgroundColor: s.surface, borderColor: s.border }}
        title={<span style={{ color: s.text }}>إحصائيات السائقين</span>}
        right={
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition-all" style={{ backgroundColor: s.muted }}>
            <ChevronRight size={20} style={{ color: s.sub }} />
          </button>
        }
      />

      {/* Quick range */}
      <div className="flex gap-2 px-4 pt-4 pb-2">
        {(['today','week','month'] as const).map(r => (
          <button key={r} onClick={() => handleQuick(r)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95"
            style={{ backgroundColor: range===r ? '#D96846' : s.surface, borderColor: range===r ? '#D96846' : s.border, color: range===r ? '#fff' : s.sub }}>
            {r==='today'?'اليوم':r==='week'?'الأسبوع':'الشهر'}
          </button>
        ))}
        <button onClick={() => setRange('custom')}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95"
          style={{ backgroundColor: range==='custom' ? '#D96846' : s.surface, borderColor: range==='custom' ? '#D96846' : s.border, color: range==='custom' ? '#fff' : s.sub }}>
          تخصيص
        </button>
      </div>

      {range === 'custom' && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <input type="date" value={toDate} max={today} onChange={e => setToDate(e.target.value)}
            className="flex-1 rounded-xl px-3 py-2 text-sm text-center border outline-none"
            style={{ backgroundColor: s.surface, borderColor: s.border, color: s.text }} />
          <span style={{ color: s.sub }}>—</span>
          <input type="date" value={fromDate} max={toDate} onChange={e => setFromDate(e.target.value)}
            className="flex-1 rounded-xl px-3 py-2 text-sm text-center border outline-none"
            style={{ backgroundColor: s.surface, borderColor: s.border, color: s.text }} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin" /></div>
      ) : driverStats.length === 0 ? (
        <div className="text-center mt-16">
          <p className="text-4xl mb-3">🛵</p>
          <p className="text-sm" style={{ color: s.sub }}>لا يوجد سائقون أو طلبات توصيل بهذه الفترة</p>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {driverStats.map((d, idx) => {
            const isOpen = expanded === d.id;
            return (
              <div key={d.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: s.surface, borderColor: s.border }}>
                <button onClick={() => setExpanded(isOpen ? null : d.id)} className="w-full p-4 text-right active:scale-[0.99] transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <ChevronDown size={16} style={{ color: s.sub, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm" style={{ color: s.text }}>{d.name}</span>
                        {d.phone && (
                          <span className="flex items-center gap-0.5 text-[11px]" dir="ltr" style={{ color: s.sub }}>
                            <Phone size={9} /> {d.phone}
                          </span>
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: idx === 0 ? 'rgba(249,197,7,0.15)' : 'rgba(59,130,246,0.1)' }}>
                        <Car size={16} style={{ color: idx === 0 ? '#f9c507' : '#3b82f6' }} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                      <p className="font-black text-base" style={{ color: '#3b82f6' }}>{d.completedCount}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: s.sub }}>رحلة مكتملة</p>
                    </div>
                    <div className="text-center">
                      <p className="font-black text-base" style={{ color: '#22c55e' }}>{d.revenue.toLocaleString()}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: s.sub }}>د.ع مبيعات وصّلها</p>
                    </div>
                    <div className="text-center">
                      <p className="font-black text-base" style={{ color: d.avgDeliveryMins !== null ? '#f97316' : s.sub }}>{d.avgDeliveryMins !== null ? Math.round(d.avgDeliveryMins) : '—'}</p>
                      <p className={`text-[10px] mt-0.5${d.avgDeliveryMins !== null ? '' : ' font-normal'}`} style={{ color: d.avgDeliveryMins !== null ? s.sub : s.faint }}>
                        {d.avgDeliveryMins !== null
                          ? 'دقيقة متوسط التوصيل'
                          : d.completedCount === 0
                          ? 'لا رحلات مكتملة'
                          : 'قبل التتبع'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="font-black text-base" style={{ color: d.rejectedCount > 0 ? '#ef4444' : s.sub }}>{d.rejectedCount}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: s.sub }}>طلب ملغى</p>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t px-4" style={{ borderColor: s.border, backgroundColor: s.muted }}>
                    {d.orders.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: s.sub }}>لا توجد طلبات موصَّلة بهذه الفترة</p>
                    ) : d.orders.map((o, oidx) => (
                      <div key={o.id}
                        className="flex items-center justify-between text-xs py-3"
                        style={oidx > 0 ? { borderTop: `1px solid ${s.divider}` } : undefined}>
                        <span className="font-bold" style={{ color: '#22c55e' }}>{o.total_amount.toLocaleString()} د.ع</span>
                        <div className="flex items-center gap-2 text-right min-w-0">
                          <span style={{ color: s.sub }}>
                            {new Date(o.created_at).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' })} {formatTime12h(o.created_at)}
                          </span>
                          <span className="truncate" style={{ color: s.text }}>
                            {o.client_name}{o.delivery_address ? ` — ${o.delivery_address}` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AdminBottomNav />
    </div>
    </OwnerOnly>
  );
}
