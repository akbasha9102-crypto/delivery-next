'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { AdminBottomNav } from '@/components/BottomNav';
import { OwnerOnly } from '@/components/OwnerOnly';
import { Search, X, ChevronLeft, ChevronRight, Package, ChevronDown, Flame } from 'lucide-react';

type OrderItem = { id: string; item_name: string; quantity: number; price: number };
type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; client_note: string | null; total_amount: number; created_at: string; order_type?: string | null; items: OrderItem[] };
type Category = { id: string; name: string };

type StockMovementRow = {
  id: string;
  inventory_item_id: string;
  quantity_changed: number;
  reference_id: string | null;
  created_at: string;
  inventory_items: { name: string; unit: string } | null;
};

type IngredientAgg = {
  id: string;
  name: string;
  unit: string;
  total: number;
  byOrder: Map<string, { qty: number; time: string }>;
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

export default function StatisticsPage() {
  const router = useRouter();
  const { dark } = useDarkMode();
  const { restaurantId } = useRestaurant();
  const today = localDate();

  const [orders,     setOrders]     = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageMap,   setImageMap]   = useState<Map<string, string>>(new Map());
  const [catMap,     setCatMap]     = useState<Map<string, string>>(new Map()); // itemName → catId
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [range,      setRange]      = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [fromDate,   setFromDate]   = useState(today);
  const [toDate,     setToDate]     = useState(today);
  const [dayView,    setDayView]    = useState(today);

  const [invMovements, setInvMovements] = useState<StockMovementRow[]>([]);
  const [invOrderNames, setInvOrderNames] = useState<Map<string, string>>(new Map());
  const [invLoading,  setInvLoading]  = useState(true);
  const [expandedIng, setExpandedIng] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!restaurantId) { setLoading(false); return; }
    setLoading(true);
    const start = new Date(fromDate + 'T00:00:00').toISOString();
    const end   = new Date(toDate   + 'T23:59:59').toISOString();

    const [ordersRes, itemsRes, catsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('restaurant_id', restaurantId).eq('status', 'completed')
        .gte('created_at', start).lte('created_at', end)
        .order('created_at', { ascending: false }).limit(500),
      supabase.from('items').select('name, category_id, image_url').eq('restaurant_id', restaurantId),
      supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: true }),
    ]);

    const imgMap = new Map<string, string>();
    const cMap   = new Map<string, string>();
    (itemsRes.data || []).forEach(i => { imgMap.set(i.name, i.image_url); cMap.set(i.name, i.category_id); });
    setImageMap(imgMap);
    setCatMap(cMap);
    setCategories(catsRes.data || []);

    const orders = ordersRes.data || [];
    const orderIds = orders.map(o => o.id);
    const allItems = orderIds.length
      ? (await supabase.from('order_items').select('*').in('order_id', orderIds)).data || []
      : [];
    const itemsByOrder = new Map<string, typeof allItems>();
    allItems.forEach(it => {
      const arr = itemsByOrder.get(it.order_id) ?? [];
      arr.push(it);
      itemsByOrder.set(it.order_id, arr);
    });
    const withItems = orders.map(o => ({ ...o, items: itemsByOrder.get(o.id) ?? [] }));
    setOrders(withItems);
    setLoading(false);
  }, [fromDate, toDate, restaurantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchInventoryStats = useCallback(async () => {
    if (!restaurantId) { setInvLoading(false); return; }
    setInvLoading(true);
    const start = new Date(fromDate + 'T00:00:00').toISOString();
    const end   = new Date(toDate   + 'T23:59:59').toISOString();

    const { data } = await supabase
      .from('stock_movements')
      .select('id, inventory_item_id, quantity_changed, reference_id, created_at, inventory_items(name, unit)')
      .eq('restaurant_id', restaurantId)
      .eq('movement_type', 'OUT_ORDER')
      .gte('created_at', start).lte('created_at', end)
      .order('created_at', { ascending: false })
      .limit(2000);

    const rows = (data || []) as unknown as StockMovementRow[];
    setInvMovements(rows);

    const orderIds = [...new Set(rows.map(r => r.reference_id).filter(Boolean))] as string[];
    if (orderIds.length) {
      const { data: ords } = await supabase.from('orders').select('id, client_name').in('id', orderIds);
      const map = new Map<string, string>();
      (ords || []).forEach(o => map.set(o.id, o.client_name));
      setInvOrderNames(map);
    } else {
      setInvOrderNames(new Map());
    }
    setInvLoading(false);
  }, [restaurantId, fromDate, toDate]);

  useEffect(() => { fetchInventoryStats(); }, [fetchInventoryStats]);

  const ingredientStats = useMemo(() => {
    const map = new Map<string, IngredientAgg>();
    invMovements.forEach(r => {
      const invItem = r.inventory_items;
      if (!invItem) return;
      const qty = Math.abs(r.quantity_changed);
      const e = map.get(r.inventory_item_id) || { id: r.inventory_item_id, name: invItem.name, unit: invItem.unit, total: 0, byOrder: new Map<string, { qty: number; time: string }>() };
      e.total += qty;
      if (r.reference_id) {
        const prev = e.byOrder.get(r.reference_id);
        e.byOrder.set(r.reference_id, { qty: (prev?.qty || 0) + qty, time: prev?.time || r.created_at });
      }
      map.set(r.inventory_item_id, e);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [invMovements]);

  const handleQuick = (r: 'today' | 'week' | 'month') => {
    const { from, to } = quickRange(r);
    setFromDate(from); setToDate(to); setRange(r);
    if (r === 'today') setDayView(today);
  };

  const changeDay = (delta: number) => {
    const d = new Date(dayView + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const next = localDate(d);
    if (next <= today) {
      setDayView(next);
      setFromDate(next);
      setToDate(next);
      setRange('today');
    }
  };

  const formatDayLabel = (dateStr: string) => {
    const d    = new Date(dateStr + 'T00:00:00');
    const now  = new Date(); now.setHours(0,0,0,0);
    const yest = new Date(); yest.setDate(yest.getDate()-1); yest.setHours(0,0,0,0);
    if (d.getTime() === now.getTime())  return 'اليوم';
    if (d.getTime() === yest.getTime()) return 'أمس';
    return d.toLocaleDateString('ar-IQ', { weekday:'short', day:'numeric', month:'short' });
  };

  const filtered = useMemo(() => orders.filter(o => {
    const q = search.trim();
    const matchSearch = !q || o.client_name.includes(q) || o.client_phone.includes(q) ||
      o.items.some(i => i.item_name.includes(q));
    const matchCat = !selectedCat || o.items.some(i => catMap.get(i.item_name) === selectedCat);
    return matchSearch && matchCat;
  }), [orders, search, selectedCat, catMap]);

  const totalRevenue   = filtered.reduce((s, o) => s + o.total_amount, 0);
  const avgOrder       = filtered.length ? Math.round(totalRevenue / filtered.length) : 0;
  const localOrders     = filtered.filter(o => o.order_type === 'local');
  const internalOrders  = filtered.filter(o => o.order_type === 'pickup');
  const deliveryOrders  = filtered.filter(o => !o.order_type || o.order_type === 'delivery');
  const localRevenue    = localOrders.reduce((s, o) => s + o.total_amount, 0);
  const internalRevenue = internalOrders.reduce((s, o) => s + o.total_amount, 0);
  const deliveryRevenue = deliveryOrders.reduce((s, o) => s + o.total_amount, 0);

  const catBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    orders.forEach(order => {
      const seen = new Set<string>();
      order.items.forEach(item => {
        const catId = catMap.get(item.item_name);
        if (!catId || seen.has(catId)) return;
        seen.add(catId);
        const cat = categories.find(c => c.id === catId);
        if (!cat) return;
        const e = map.get(catId) || { name: cat.name, revenue: 0, count: 0 };
        map.set(catId, { ...e, revenue: e.revenue + order.total_amount, count: e.count + 1 });
      });
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [orders, catMap, categories]);

  const topItemsStats = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    orders.forEach(order => {
      order.items.forEach(item => {
        const e = map.get(item.item_name) || { name: item.item_name, qty: 0, revenue: 0 };
        e.qty += item.quantity;
        e.revenue += item.price * item.quantity;
        map.set(item.item_name, e);
      });
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [orders]);

  const s = {
    bg:      dark ? '#0f172a' : '#f8fafc',
    surface: dark ? '#1e293b' : '#fff',
    border:  dark ? '#334155' : '#e2e8f0',
    text:    dark ? '#f1f5f9' : '#0f172a',
    sub:     dark ? '#94a3b8' : '#64748b',
    muted:   dark ? '#334155' : '#f1f5f9',
  };

  return (
    <OwnerOnly>
    <div className="min-h-screen pb-24 md:pb-0 md:mr-[70px]" style={{ backgroundColor: s.bg }}>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b px-4 py-4 flex items-center justify-between" style={{ backgroundColor: s.surface, borderColor: s.border }}>
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition-all" style={{ backgroundColor: s.muted }}>
          <ChevronRight size={20} style={{ color: s.sub }} />
        </button>
        <h1 className="text-xl font-bold" style={{ color: s.text }}>الإحصائيات</h1>
        <div className="w-9" />
      </header>

      {/* Quick range */}
      <div className="flex gap-2 px-4 pt-4 pb-2">
        {(['today','week','month'] as const).map(r => (
          <button key={r} onClick={() => handleQuick(r)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95"
            style={{ backgroundColor: range===r ? '#f97316' : s.surface, borderColor: range===r ? '#f97316' : s.border, color: range===r ? '#fff' : s.sub }}>
            {r==='today'?'اليوم':r==='week'?'الأسبوع':'الشهر'}
          </button>
        ))}
        <button onClick={() => setRange('custom')}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95"
          style={{ backgroundColor: range==='custom' ? '#f97316' : s.surface, borderColor: range==='custom' ? '#f97316' : s.border, color: range==='custom' ? '#fff' : s.sub }}>
          تخصيص
        </button>
      </div>

      {/* التنقل بين الأيام */}
      <div className="flex items-center justify-between mx-4 mb-3 rounded-2xl border px-2 py-1.5" style={{ backgroundColor: s.surface, borderColor: s.border }}>
        <button onClick={() => changeDay(+1)} disabled={dayView === today}
          className="p-2 rounded-xl transition-all active:scale-90 disabled:opacity-20"
          style={{ color: s.sub }}>
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <p className="font-bold" style={{ color: s.text }}>{formatDayLabel(dayView)}</p>
          {dayView !== today && (
            <button onClick={() => { setDayView(today); setFromDate(today); setToDate(today); setRange('today'); }}
              className="text-xs px-2.5 py-1 rounded-lg font-bold active:scale-95 transition-all"
              style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
              اليوم ←
            </button>
          )}
        </div>
        <button onClick={() => changeDay(-1)}
          className="p-2 rounded-xl transition-all active:scale-90"
          style={{ color: s.sub }}>
          <ChevronRight size={20} />
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
        <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
      ) : (<>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
          {[
            { val: filtered.length,            label: 'طلب مكتمل', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  big: true },
            { val: totalRevenue.toLocaleString(), label: 'د.ع إيراد', color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)' },
            { val: avgOrder.toLocaleString(),   label: 'د.ع متوسط',  color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl p-3 text-center border" style={{ backgroundColor: c.bg, borderColor: c.border }}>
              <p className="font-bold leading-tight" style={{ color: c.color, fontSize: c.big ? 24 : 15 }}>{c.val}</p>
              <p className="text-xs mt-1 opacity-75" style={{ color: c.color }}>{c.label}</p>
            </div>
          ))}
        </div>

        {/* Local vs Delivery vs Internal revenue breakdown */}
        {(localOrders.length > 0 || deliveryOrders.length > 0 || internalOrders.length > 0) && (
          <div className="mx-4 mb-3 rounded-2xl border p-4" style={{ backgroundColor: s.surface, borderColor: s.border }}>
            <h3 className="font-bold text-right mb-4" style={{ color: s.text }}>الإيراد حسب نوع الطلب</h3>
            <div className="space-y-4">
              {/* Local */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-sm" style={{ color: '#8b5cf6' }}>{localRevenue.toLocaleString()} د.ع</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: s.sub }}>{localOrders.length} طلب</span>
                    <span className="font-bold text-sm" style={{ color: s.text }}>🏪 الإيراد المحلي</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: s.muted }}>
                  <div className="h-full rounded-full transition-all" style={{ width: totalRevenue > 0 ? `${(localRevenue / totalRevenue) * 100}%` : '0%', backgroundColor: '#8b5cf6' }} />
                </div>
                <p className="text-xs text-left mt-0.5" style={{ color: s.sub }}>
                  {totalRevenue > 0 ? `${Math.round((localRevenue / totalRevenue) * 100)}%` : '0%'}
                </p>
              </div>
              {/* Delivery */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-sm" style={{ color: '#22c55e' }}>{deliveryRevenue.toLocaleString()} د.ع</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: s.sub }}>{deliveryOrders.length} طلب</span>
                    <span className="font-bold text-sm" style={{ color: s.text }}>إيراد التوصيل</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: s.muted }}>
                  <div className="h-full rounded-full transition-all" style={{ width: totalRevenue > 0 ? `${(deliveryRevenue / totalRevenue) * 100}%` : '0%', backgroundColor: '#22c55e' }} />
                </div>
                <p className="text-xs text-left mt-0.5" style={{ color: s.sub }}>
                  {totalRevenue > 0 ? `${Math.round((deliveryRevenue / totalRevenue) * 100)}%` : '0%'}
                </p>
              </div>
              {/* Internal (dine-in/pickup) */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-sm" style={{ color: '#f59e0b' }}>{internalRevenue.toLocaleString()} د.ع</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: s.sub }}>{internalOrders.length} طلب</span>
                    <span className="font-bold text-sm" style={{ color: s.text }}>إيراد الطلب الداخلي</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: s.muted }}>
                  <div className="h-full rounded-full transition-all" style={{ width: totalRevenue > 0 ? `${(internalRevenue / totalRevenue) * 100}%` : '0%', backgroundColor: '#f59e0b' }} />
                </div>
                <p className="text-xs text-left mt-0.5" style={{ color: s.sub }}>
                  {totalRevenue > 0 ? `${Math.round((internalRevenue / totalRevenue) * 100)}%` : '0%'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Category breakdown */}
        {catBreakdown.length > 0 && (
          <div className="mx-4 mb-3 rounded-2xl border p-4" style={{ backgroundColor: s.surface, borderColor: s.border }}>
            <h3 className="font-bold text-right mb-4" style={{ color: s.text }}>الإيراد حسب القسم</h3>
            <div className="space-y-3">
              {catBreakdown.map(cat => {
                const pct = totalRevenue > 0 ? (cat.revenue / orders.reduce((sum,o)=>sum+o.total_amount,0)) * 100 : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-bold text-sm" style={{ color: '#f97316' }}>{Math.round(cat.revenue).toLocaleString()} د.ع</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: s.sub }}>{cat.count} طلب</span>
                        <span className="font-bold text-sm" style={{ color: s.text }}>{cat.name}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: s.muted }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: '#f97316' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* الأصناف الأكثر مبيعاً */}
        {topItemsStats.length > 0 && (
          <div className="mx-4 mb-3 rounded-2xl border p-4" style={{ backgroundColor: s.surface, borderColor: s.border }}>
            <div className="flex items-center gap-2 mb-4 justify-end">
              <h3 className="font-bold text-right" style={{ color: s.text }}>الأصناف الأكثر مبيعاً</h3>
              <Flame size={18} style={{ color: '#f97316' }} />
            </div>
            <div className="space-y-3">
              {topItemsStats.slice(0, 10).map((it, idx) => {
                const maxQty = topItemsStats[0].qty;
                const pct = maxQty > 0 ? (it.qty / maxQty) * 100 : 0;
                return (
                  <div key={it.name}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-bold text-sm" style={{ color: '#f97316' }}>{Math.round(it.revenue).toLocaleString()} د.ع</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: s.sub }}>{it.qty}× مباع</span>
                        <span className="font-bold text-sm" style={{ color: s.text }}>{it.name}</span>
                        <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: idx === 0 ? 'rgba(249,115,22,0.15)' : s.muted, color: idx === 0 ? '#f97316' : s.sub }}>
                          {idx + 1}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: s.muted }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#f97316' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* إحصائيات المخزون */}
        <div className="mx-4 mb-3 rounded-2xl border p-4" style={{ backgroundColor: s.surface, borderColor: s.border }}>
          <div className="flex items-center gap-2 mb-4 justify-end">
            <h3 className="font-bold text-right" style={{ color: s.text }}>إحصائيات المخزون</h3>
            <Package size={18} style={{ color: '#f97316' }} />
          </div>

          {invLoading ? (
            <div className="flex justify-center py-6"><div className="w-7 h-7 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
          ) : ingredientStats.length === 0 ? (
            <p className="text-center text-sm py-4" style={{ color: s.sub }}>لا يوجد استهلاك مخزون في هذه الفترة</p>
          ) : (
            <div className="space-y-2">
              {ingredientStats.map(ing => {
                const isOpen = expandedIng === ing.id;
                const orderEntries = [...ing.byOrder.entries()].sort((a, b) => b[1].qty - a[1].qty);
                return (
                  <div key={ing.id} className="rounded-xl border overflow-hidden" style={{ borderColor: s.border }}>
                    <button onClick={() => setExpandedIng(isOpen ? null : ing.id)}
                      className="w-full flex items-center justify-between p-3 active:scale-[0.99] transition-all">
                      <span className="font-bold text-sm" style={{ color: '#f97316' }}>
                        {ing.total.toLocaleString(undefined, { maximumFractionDigits: 3 })} {ing.unit}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: s.sub }}>{ing.byOrder.size} طلب</span>
                        <span className="font-bold text-sm" style={{ color: s.text }}>{ing.name}</span>
                        <ChevronDown size={16} style={{ color: s.sub, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t px-3 py-2 space-y-1.5" style={{ borderColor: s.border, backgroundColor: s.muted }}>
                        {orderEntries.map(([orderId, info]) => (
                          <div key={orderId} className="flex items-center justify-between text-xs">
                            <span className="font-bold" style={{ color: '#f97316' }}>
                              {info.qty.toLocaleString(undefined, { maximumFractionDigits: 3 })} {ing.unit}
                            </span>
                            <div className="flex items-center gap-2">
                              <span style={{ color: s.sub }}>
                                {new Date(info.time).toLocaleString('ar-IQ', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                              </span>
                              <span style={{ color: s.text }}>{invOrderNames.get(orderId) || 'طلب محذوف'}</span>
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
        </div>

        {/* Search */}
        <div className="px-4 mb-2">
          <div className="relative">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="اسم الزبون، رقم الهاتف، أو اسم الوجبة..."
              dir="rtl"
              className="w-full rounded-2xl py-3 pr-10 pl-10 text-right border outline-none focus:ring-2 focus:ring-[#f97316]"
              style={{ backgroundColor: s.surface, borderColor: s.border, color: s.text }} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute top-1/2 -translate-y-1/2 left-3" style={{ color: s.sub }}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          <button onClick={() => setSelectedCat(null)}
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border active:scale-95 transition-all"
            style={{ backgroundColor: !selectedCat ? '#f97316' : s.surface, borderColor: !selectedCat ? '#f97316' : s.border, color: !selectedCat ? '#fff' : s.sub }}>
            الكل ({orders.length})
          </button>
          {categories.map(cat => {
            const count = orders.filter(o => o.items.some(i => catMap.get(i.item_name) === cat.id)).length;
            if (count === 0) return null;
            return (
              <button key={cat.id} onClick={() => setSelectedCat(selectedCat===cat.id ? null : cat.id)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border active:scale-95 transition-all"
                style={{ backgroundColor: selectedCat===cat.id ? '#f97316' : s.surface, borderColor: selectedCat===cat.id ? '#f97316' : s.border, color: selectedCat===cat.id ? '#fff' : s.sub }}>
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* نتائج البحث */}
        {search && (
          <p className="px-4 pb-2 text-sm text-right" style={{ color: s.sub }}>
            {filtered.length} نتيجة
          </p>
        )}

        {/* Orders list */}
        <div className="px-4 space-y-3 pb-4">
          {filtered.length === 0 ? (
            <div className="text-center mt-10">
              <p className="text-4xl mb-3">📋</p>
              <p style={{ color: s.sub }}>لا توجد طلبات</p>
            </div>
          ) : filtered.map(order => (
            <div key={order.id} className="rounded-2xl overflow-hidden border" style={{ backgroundColor: s.surface, borderColor: s.border }}>
              <div className="h-1.5 bg-green-400" />
              <div className="p-4">
                {/* Header */}
                <div className="flex justify-between items-start pb-3 mb-3 border-b" style={{ borderColor: s.border }}>
                  <div>
                    <p className="font-bold text-lg" style={{ color: '#22c55e' }}>
                      {order.total_amount.toLocaleString()} <span className="text-xs font-normal" style={{ color: s.sub }}>د.ع</span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: s.sub }}>
                      {new Date(order.created_at).toLocaleString('ar-IQ', { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-base" style={{ color: s.text }}>{order.client_name}</p>
                    <p className="text-sm mt-0.5" style={{ color: s.sub }}>{order.client_phone}</p>
                    {order.delivery_address && <p className="text-xs mt-0.5" style={{ color: s.sub }}>📍 {order.delivery_address}</p>}
                  </div>
                </div>
                {/* Items */}
                <div className="space-y-2">
                  {order.items.map(item => {
                    const img = imageMap.get(item.item_name);
                    return (
                      <div key={item.id} className="flex justify-between items-center py-1">
                        <span className="font-bold text-sm" style={{ color: '#f97316' }}>{(item.price * item.quantity).toLocaleString()} د.ع</span>
                        <div className="flex items-center gap-2">
                          {img && (
                            <img src={img} alt={item.item_name} className="w-9 h-9 rounded-xl object-cover"
                              onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                          )}
                          <span className="text-sm" style={{ color: s.text }}>{item.item_name}</span>
                          <span className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: s.muted, color: s.sub }}>{item.quantity}×</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {order.client_note && <p className="text-sm mt-2 text-right" style={{ color: '#d97706' }}>📝 {order.client_note}</p>}
              </div>
            </div>
          ))}
        </div>
      </>)}

      <AdminBottomNav />
    </div>
    </OwnerOnly>
  );
}

