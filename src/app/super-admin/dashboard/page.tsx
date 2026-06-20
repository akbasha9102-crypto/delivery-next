'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────
type Restaurant = {
  id: string; restaurant_name: string; primary_color: string;
  logo_url: string | null; is_closed: boolean; whatsapp_number: string | null;
  updated_at?: string;
};
type Driver = {
  id: string; name: string; phone: string; status: string;
};
type Order = {
  id: string; client_name: string; client_phone: string;
  delivery_address: string | null; total_amount: number;
  status: string; created_at: string; driver_name?: string | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'انتظار',       color: '#f59e0b', dot: 'bg-amber-400' },
  preparing: { label: 'قيد التجهيز', color: '#3b82f6', dot: 'bg-blue-400' },
  pickup:    { label: 'قيد التوصيل', color: '#f97316', dot: 'bg-orange-400' },
  ready:     { label: 'في الطريق',   color: '#8b5cf6', dot: 'bg-purple-400' },
  completed: { label: 'مكتمل',       color: '#22c55e', dot: 'bg-green-400' },
  rejected:  { label: 'مرفوض',       color: '#ef4444', dot: 'bg-red-400' },
};

const DRIVER_STATUS: Record<string, { label: string; color: string }> = {
  active:   { label: 'نشط',        color: '#22c55e' },
  on_trip:  { label: 'في رحلة',    color: '#f97316' },
  offline:  { label: 'غير متصل',   color: '#6b7280' },
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes().toString().padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'م' : 'ص'}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="bg-[#1a1a2e] rounded-2xl p-4 border border-slate-700/40 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: color + '22' }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-xs truncate">{label}</p>
        <p className="text-white font-black text-xl leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [drivers,     setDrivers]     = useState<Driver[]>([]);
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<'overview' | 'restaurants' | 'drivers' | 'orders'>('overview');
  const [toggling,    setToggling]    = useState<string | null>(null);
  const lastOrderCount = useRef(0);

  const loadAll = useCallback(async () => {
    const today = todayISO();
    const [{ data: rs }, { data: dr }, { data: or }] = await Promise.all([
      supabase.from('restaurant_settings').select('*').order('updated_at', { ascending: false }),
      supabase.from('drivers').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').gte('created_at', today + 'T00:00:00').order('created_at', { ascending: false }).limit(200),
    ]);
    setRestaurants((rs || []) as Restaurant[]);
    setDrivers((dr || []) as Driver[]);
    setOrders((or || []) as Order[]);
    lastOrderCount.current = or?.length ?? 0;
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    // realtime
    const ch = supabase.channel('super-admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_settings' }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadAll]);

  const toggleRestaurant = async (r: Restaurant) => {
    setToggling(r.id);
    await supabase.from('restaurant_settings').update({ is_closed: !r.is_closed }).eq('id', r.id);
    await loadAll();
    setToggling(null);
  };

  const signOut = async () => {
    await fetch('/api/super-admin/auth', { method: 'DELETE' });
    window.location.href = '/super-admin/login';
  };

  // ── Derived stats ──
  const todayOrders   = orders.length;
  const todayRevenue  = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.total_amount, 0);
  const activeDrivers = drivers.filter(d => d.status === 'active' || d.status === 'on_trip').length;
  const liveOrders    = orders.filter(o => !['completed', 'rejected'].includes(o.status));

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white pb-24" dir="rtl">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0f0f1a]/95 backdrop-blur border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-black text-violet-400 leading-none">Super Admin</p>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">لوحة التحكم العليا</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all active:scale-90">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            <button onClick={signOut} className="px-3 py-1.5 rounded-xl text-xs text-red-400 border border-red-900/40 hover:bg-red-900/20 transition-all active:scale-90">
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="المطاعم المسجلة"   value={restaurants.length} icon="🏪" color="#8b5cf6" />
          <StatCard label="السائقين النشطين"  value={activeDrivers}      icon="🏍️" color="#f97316" />
          <StatCard label="طلبات اليوم"        value={todayOrders}        icon="📦" color="#3b82f6" />
          <StatCard label="إيرادات اليوم"      value={`${todayRevenue.toLocaleString()} د.ع`} icon="💰" color="#22c55e" />
        </div>

        {/* Live Orders Badge */}
        {liveOrders.length > 0 && (
          <div className="bg-violet-900/30 border border-violet-700/40 rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-violet-300 text-sm font-bold">{liveOrders.length} طلب حي الآن</span>
            <span className="flex gap-1">
              {liveOrders.slice(0, 4).map(o => (
                <span key={o.id} className={`w-2.5 h-2.5 rounded-full ${STATUS_LABEL[o.status]?.dot ?? 'bg-gray-400'}`} />
              ))}
              {liveOrders.length > 4 && <span className="text-violet-400 text-xs">+{liveOrders.length - 4}</span>}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-[#1a1a2e] rounded-2xl p-1 gap-1 border border-slate-700/40">
          {([
            { key: 'overview',     label: 'نظرة عامة', icon: '📊' },
            { key: 'restaurants',  label: 'المطاعم',   icon: '🏪' },
            { key: 'drivers',      label: 'السائقين',  icon: '🏍️' },
            { key: 'orders',       label: 'الطلبات',   icon: '📦' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.key ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30' : 'text-slate-400 hover:text-white'}`}>
              <span className="block">{t.icon}</span>
              <span className="block mt-0.5">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab: نظرة عامة ── */}
        {tab === 'overview' && (
          <div className="space-y-3">
            {/* Active orders quick view */}
            <div className="bg-[#1a1a2e] rounded-2xl border border-slate-700/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
                <span className="text-slate-400 text-xs">الطلبات الحية</span>
                <span className="font-bold text-sm">{liveOrders.length} طلب</span>
              </div>
              {liveOrders.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">لا توجد طلبات حالية</div>
              ) : liveOrders.slice(0, 6).map(o => (
                <div key={o.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_LABEL[o.status]?.dot ?? 'bg-gray-400'}`} />
                    <span className="text-sm font-medium">{o.client_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{fmtTime(o.created_at)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (STATUS_LABEL[o.status]?.color ?? '#6b7280') + '22', color: STATUS_LABEL[o.status]?.color ?? '#6b7280' }}>
                      {STATUS_LABEL[o.status]?.label ?? o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Driver status summary */}
            <div className="bg-[#1a1a2e] rounded-2xl border border-slate-700/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/40">
                <span className="text-slate-400 text-xs">حالة السائقين</span>
              </div>
              {drivers.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">لا يوجد سائقون</div>
              ) : drivers.map(d => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 last:border-0">
                  <span className="text-sm font-medium">{d.name}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                    style={{ backgroundColor: (DRIVER_STATUS[d.status]?.color ?? '#6b7280') + '22', color: DRIVER_STATUS[d.status]?.color ?? '#6b7280' }}>
                    {DRIVER_STATUS[d.status]?.label ?? d.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: المطاعم ── */}
        {tab === 'restaurants' && (
          <div className="space-y-3">
            {restaurants.length === 0 ? (
              <div className="bg-[#1a1a2e] rounded-2xl p-8 text-center text-slate-500 border border-slate-700/40">لا توجد مطاعم مسجلة</div>
            ) : restaurants.map(r => (
              <div key={r.id} className="bg-[#1a1a2e] rounded-2xl p-4 border border-slate-700/40">
                <div className="flex items-start gap-3">
                  {r.logo_url ? (
                    <img src={r.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-slate-700" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl" style={{ backgroundColor: r.primary_color + '33' }}>
                      🏪
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base leading-tight">{r.restaurant_name}</p>
                    {r.whatsapp_number && (
                      <p className="text-slate-400 text-xs mt-0.5">{r.whatsapp_number}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${r.is_closed ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                        {r.is_closed ? 'مغلق' : 'نشط'}
                      </span>
                      <div className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-slate-700" style={{ backgroundColor: r.primary_color }} />
                    </div>
                  </div>
                  <button
                    onClick={() => toggleRestaurant(r)}
                    disabled={toggling === r.id}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-90 disabled:opacity-50 flex-shrink-0 ${
                      r.is_closed
                        ? 'bg-green-900/30 text-green-400 border border-green-700/40'
                        : 'bg-red-900/30 text-red-400 border border-red-700/40'
                    }`}
                  >
                    {toggling === r.id ? '...' : r.is_closed ? 'تفعيل' : 'تعليق'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: السائقين ── */}
        {tab === 'drivers' && (
          <div className="bg-[#1a1a2e] rounded-2xl border border-slate-700/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
              <span className="text-slate-400 text-xs">جميع السائقين</span>
              <span className="font-bold text-sm">{drivers.length}</span>
            </div>
            {drivers.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">لا يوجد سائقون</div>
            ) : drivers.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800/60 last:border-0">
                <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center text-base flex-shrink-0">
                  🏍️
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm leading-tight">{d.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{d.phone}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0"
                  style={{ backgroundColor: (DRIVER_STATUS[d.status]?.color ?? '#6b7280') + '22', color: DRIVER_STATUS[d.status]?.color ?? '#6b7280' }}>
                  {DRIVER_STATUS[d.status]?.label ?? d.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: الطلبات ── */}
        {tab === 'orders' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-slate-400 text-xs">طلبات اليوم</span>
              <span className="text-slate-400 text-xs">{todayOrders} طلب</span>
            </div>
            {orders.length === 0 ? (
              <div className="bg-[#1a1a2e] rounded-2xl p-8 text-center text-slate-500 border border-slate-700/40">لا توجد طلبات اليوم</div>
            ) : orders.map(o => (
              <div key={o.id} className="bg-[#1a1a2e] rounded-2xl px-4 py-3 border border-slate-700/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_LABEL[o.status]?.dot ?? 'bg-gray-400'}`} />
                      <p className="font-bold text-sm truncate">{o.client_name}</p>
                    </div>
                    <p className="text-slate-500 text-xs mt-1 truncate">{o.delivery_address || o.client_phone}</p>
                    {o.driver_name && (
                      <p className="text-violet-400 text-xs mt-0.5">🏍️ {o.driver_name}</p>
                    )}
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="font-black text-sm text-green-400">{o.total_amount.toLocaleString()} د.ع</p>
                    <p className="text-slate-500 text-xs mt-0.5">{fmtTime(o.created_at)}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block"
                      style={{ backgroundColor: (STATUS_LABEL[o.status]?.color ?? '#6b7280') + '22', color: STATUS_LABEL[o.status]?.color ?? '#6b7280' }}>
                      {STATUS_LABEL[o.status]?.label ?? o.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
