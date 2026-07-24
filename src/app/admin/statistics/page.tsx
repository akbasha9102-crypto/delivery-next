'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useDarkMode } from '@/context/ThemeContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { AdminBottomNav } from '@/components/layout/BottomNav';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { OwnerOnly } from '@/components/guards/OwnerOnly';
import { Search, X, ChevronLeft, ChevronRight, Flame, Car, Package, LayoutGrid, ClipboardList, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportStatisticsToExcel, exportStatisticsToWord, type StatsExportData } from '@/lib/export/exportStatistics';
import { SalesChart } from '@/components/shared/SalesChart';

type OrderItem = { id: string; item_id?: string | null; item_name: string; quantity: number; price: number };
type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; client_note: string | null; total_amount: number; created_at: string; order_type?: string | null; table_number?: number | string | null; delivery_fee?: number | null; discount_amount?: number | null; coupon_code?: string | null; items: OrderItem[] };
type Category = { id: string; name: string };

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

  const [activeTab, setActiveTab] = useState<'overview' | 'orders'>('overview');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [costMap, setCostMap] = useState<Map<string, number>>(new Map());
  const [showAllTopItems, setShowAllTopItems] = useState(false);

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

  const fetchCostMap = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('menu_item_cost')
      .select('menu_item_id, total_cost_per_serving')
      .eq('restaurant_id', restaurantId);
    const map = new Map<string, number>();
    (data || []).forEach(r => map.set(r.menu_item_id, r.total_cost_per_serving || 0));
    setCostMap(map);
  }, [restaurantId]);

  useEffect(() => { fetchCostMap(); }, [fetchCostMap]);

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

  const totalCost = useMemo(() => {
    let cost = 0;
    filtered.forEach(o => o.items.forEach(it => {
      const unitCost = it.item_id ? costMap.get(it.item_id) : undefined;
      if (unitCost != null) cost += unitCost * it.quantity;
    }));
    return cost;
  }, [filtered, costMap]);
  const netProfit = totalRevenue - totalCost;
  const hasAnyRecipeData = costMap.size > 0;

  const chartData = useMemo(() => {
    const byDay = new Map<string, number>();
    filtered.forEach(o => {
      const day = localDate(new Date(o.created_at));
      byDay.set(day, (byDay.get(day) || 0) + o.total_amount);
    });
    const result: { date: string; label: string; revenue: number }[] = [];
    const start = new Date(fromDate + 'T00:00:00');
    const end   = new Date(toDate + 'T00:00:00');
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = localDate(d);
      result.push({
        date: dateStr,
        label: d.toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' }),
        revenue: byDay.get(dateStr) || 0,
      });
    }
    return result;
  }, [filtered, fromDate, toDate]);

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

  const orderTypeLabel = (ot?: string | null) => ot === 'local' ? 'محلي' : ot === 'pickup' ? 'داخلي' : 'توصيل';

  const exportRangeLabel = useMemo(() => {
    if (range === 'today') return dayView === today ? 'اليوم' : formatDayLabel(dayView);
    if (range === 'week') return 'الأسبوع';
    if (range === 'month') return 'الشهر';
    return 'فترة مخصصة';
  }, [range, dayView, today]);

  const buildExportData = useCallback((): StatsExportData => ({
    fromDate,
    toDate,
    rangeLabel: exportRangeLabel,
    summary: { ordersCount: filtered.length, totalRevenue, avgOrder },
    byOrderType: [
      { name: 'محلي', count: localOrders.length, revenue: localRevenue },
      { name: 'توصيل', count: deliveryOrders.length, revenue: deliveryRevenue },
      { name: 'داخلي', count: internalOrders.length, revenue: internalRevenue },
    ].filter(r => r.count > 0),
    byCategory: catBreakdown,
    topItems: topItemsStats,
    ordersSummary: filtered.map(o => ({
      orderId: o.id,
      createdAt: new Date(o.created_at).toLocaleString('ar-IQ', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric' }),
      orderTypeLabel: orderTypeLabel(o.order_type),
      customerOrTable: o.table_number ? `طاولة ${o.table_number}` : o.client_name,
      itemsText: o.items.map(it => `${it.item_name}×${it.quantity}`).join('، ') || '-',
      status: 'مكتمل',
      total: o.total_amount,
    })),
    orderItems: filtered.flatMap(o => {
      const createdAt = new Date(o.created_at).toLocaleString('ar-IQ', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric' });
      const subtotal = o.items.reduce((s2, it) => s2 + it.price * it.quantity, 0);
      const base = {
        orderId: o.id,
        createdAt,
        orderTypeLabel: orderTypeLabel(o.order_type),
        tableNumber: o.table_number ?? '',
        clientName: o.client_name,
        clientPhone: o.client_phone,
        address: o.delivery_address || '',
        note: o.client_note || '',
        subtotal,
        deliveryFee: o.delivery_fee || 0,
        discountAmount: o.discount_amount || 0,
        couponCode: o.coupon_code || '',
        orderTotal: o.total_amount,
      };
      if (o.items.length === 0) return [{ ...base, itemName: '', qty: 0, unitPrice: 0, lineTotal: 0 }];
      return o.items.map(it => ({ ...base, itemName: it.item_name, qty: it.quantity, unitPrice: it.price, lineTotal: it.price * it.quantity }));
    }),
  }), [fromDate, toDate, exportRangeLabel, filtered, totalRevenue, avgOrder, localOrders, deliveryOrders, internalOrders, localRevenue, deliveryRevenue, internalRevenue, catBreakdown, topItemsStats]);

  const handleExport = async (kind: 'excel' | 'word') => {
    setExportOpen(false);
    setExporting(true);
    try {
      const data = buildExportData();
      if (kind === 'excel') await exportStatisticsToExcel(data);
      else exportStatisticsToWord(data);
    } finally {
      setExporting(false);
    }
  };

  const s = {
    bg:      dark ? '#212121' : '#f8fafc',
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
      <AdminHeader
        style={{ backgroundColor: s.surface, borderColor: s.border }}
        title={<span style={{ color: s.text }}>الإحصائيات</span>}
        right={
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition-all" style={{ backgroundColor: s.muted }}>
            <ChevronRight size={20} style={{ color: s.sub }} />
          </button>
        }
        left={
          <div className="relative">
            <button onClick={() => setExportOpen(o => !o)} disabled={exporting}
              className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition-all disabled:opacity-50"
              style={{ backgroundColor: s.muted }}>
              {exporting
                ? <div className="w-4 h-4 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
                : <Download size={18} style={{ color: s.sub }} />}
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                <div className="absolute left-0 top-11 z-50 w-44 rounded-xl border shadow-lg overflow-hidden"
                  style={{ backgroundColor: s.surface, borderColor: s.border }}>
                  <button onClick={() => handleExport('excel')}
                    className="w-full flex items-center gap-2 justify-end px-3 py-2.5 text-sm font-bold active:scale-[0.98] transition-all"
                    style={{ color: s.text }}>
                    تصدير Excel
                    <FileSpreadsheet size={16} style={{ color: '#22c55e' }} />
                  </button>
                  <div className="h-px" style={{ backgroundColor: s.border }} />
                  <button onClick={() => handleExport('word')}
                    className="w-full flex items-center gap-2 justify-end px-3 py-2.5 text-sm font-bold active:scale-[0.98] transition-all"
                    style={{ color: s.text }}>
                    تصدير Word
                    <FileText size={16} style={{ color: '#3b82f6' }} />
                  </button>
                </div>
              </>
            )}
          </div>
        }
      />

      {/* روابط إحصائيات السائقين والمخزون */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-4">
        <button onClick={() => router.push('/admin/statistics/drivers')}
          className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl border transition-all active:scale-95"
          style={{ backgroundColor: s.surface, borderColor: s.border }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
            <Car size={16} style={{ color: '#3b82f6' }} />
          </div>
          <span className="font-bold text-xs" style={{ color: s.text }}>إحصائيات السائقين</span>
        </button>
        <button onClick={() => router.push('/admin/statistics/inventory')}
          className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl border transition-all active:scale-95"
          style={{ backgroundColor: s.surface, borderColor: s.border }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(249,115,22,0.1)' }}>
            <Package size={16} style={{ color: '#f97316' }} />
          </div>
          <span className="font-bold text-xs" style={{ color: s.text }}>إحصائيات المخزون</span>
        </button>
      </div>

      {/* Quick range */}
      <div className="flex gap-2 px-4 pt-4 pb-2">
        {(['today','week','month'] as const).map(r => (
          <button key={r} onClick={() => handleQuick(r)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95"
            style={{ backgroundColor: range===r ? (dark ? 'var(--admin-accent-dark)' : 'var(--admin-accent-light-bg)') : s.surface, borderColor: range===r ? (dark ? 'var(--admin-accent-dark)' : 'var(--admin-accent-light-border)') : s.border, color: range===r ? '#fff' : s.sub }}>
            {r==='today'?'اليوم':r==='week'?'الأسبوع':'الشهر'}
          </button>
        ))}
        <button onClick={() => setRange('custom')}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95"
          style={{ backgroundColor: range==='custom' ? (dark ? 'var(--admin-accent-dark)' : 'var(--admin-accent-light-bg)') : s.surface, borderColor: range==='custom' ? (dark ? 'var(--admin-accent-dark)' : 'var(--admin-accent-light-border)') : s.border, color: range==='custom' ? '#fff' : s.sub }}>
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

      {/* Tabs */}
      <div className="flex gap-2 px-4 pb-3">
        <button onClick={() => setActiveTab('overview')}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95 flex items-center justify-center gap-1.5"
          style={{ backgroundColor: activeTab==='overview' ? s.text : s.surface, borderColor: activeTab==='overview' ? s.text : s.border, color: activeTab==='overview' ? s.bg : s.sub }}>
          <LayoutGrid size={15} />
          نظرة عامة
        </button>
        <button onClick={() => setActiveTab('orders')}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95 flex items-center justify-center gap-1.5"
          style={{ backgroundColor: activeTab==='orders' ? s.text : s.surface, borderColor: activeTab==='orders' ? s.text : s.border, color: activeTab==='orders' ? s.bg : s.sub }}>
          <ClipboardList size={15} />
          الطلبات {filtered.length > 0 ? `(${filtered.length})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
      ) : activeTab === 'overview' ? (<>

        {/* Financial summary — صافي الأرباح / إجمالي المبيعات / التكلفة */}
        <div className="grid grid-cols-3 gap-2 px-4 pt-3 pb-2">
          {[
            {
              key: 'profit', label: 'صافي الأرباح',
              color: netProfit >= 0 ? '#22c55e' : '#ef4444',
              bg: netProfit >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: netProfit >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
              val: hasAnyRecipeData ? netProfit.toLocaleString() : '—',
            },
            {
              key: 'revenue', label: 'إجمالي المبيعات',
              color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)',
              val: totalRevenue.toLocaleString(),
            },
            {
              key: 'cost', label: hasAnyRecipeData ? 'التكلفة (تقديرية)' : 'إجمالي التكاليف',
              color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)',
              val: hasAnyRecipeData ? totalCost.toLocaleString() : '—',
            },
          ].map(c => (
            <div key={c.key} className="rounded-2xl p-3 text-center border" style={{ backgroundColor: c.bg, borderColor: c.border }}>
              <p className="font-bold leading-tight" style={{ color: (c.key !== 'revenue' && !hasAnyRecipeData) ? s.sub : c.color, fontSize: 22 }}>{c.val}</p>
              {c.val !== '—' && (
                <p className="text-[11px] opacity-60" style={{ color: (c.key !== 'revenue' && !hasAnyRecipeData) ? s.sub : c.color }}>د.ع</p>
              )}
              <p className="text-xs mt-1 opacity-75" style={{ color: (c.key !== 'revenue' && !hasAnyRecipeData) ? s.sub : c.color }}>{c.label}</p>
              {c.key !== 'revenue' && !hasAnyRecipeData && (
                <p className="text-[10px] mt-1 leading-tight" style={{ color: s.sub }}>لم يتم تسجيل وصفات المواد بعد</p>
              )}
            </div>
          ))}
        </div>

        {/* Secondary metrics: order count + average order value — same size/weight as the cards above for visual consistency */}
        <div className="grid grid-cols-2 gap-2 px-4 pb-3">
          <div className="rounded-2xl p-3 text-center border" style={{ backgroundColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)' }}>
            <p className="font-bold leading-tight" style={{ color: '#3b82f6', fontSize: 22 }}>{filtered.length}</p>
            <p className="text-xs mt-1 opacity-75" style={{ color: '#3b82f6' }}>طلب مكتمل</p>
          </div>
          <div className="rounded-2xl p-3 text-center border" style={{ backgroundColor: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.2)' }}>
            <p className="font-bold leading-tight" style={{ color: '#f97316', fontSize: 22 }}>{avgOrder.toLocaleString()}</p>
            <p className="text-[11px] opacity-60" style={{ color: '#f97316' }}>د.ع</p>
            <p className="text-xs mt-1 opacity-75" style={{ color: '#f97316' }}>متوسط قيمة الطلب</p>
          </div>
        </div>

        <SalesChart data={chartData} dark={dark} />

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
              {topItemsStats.slice(0, showAllTopItems ? topItemsStats.length : 5).map((it, idx) => {
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
            {topItemsStats.length > 5 && (
              <button onClick={() => setShowAllTopItems(v => !v)}
                className="w-full mt-3 text-center py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all"
                style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
                {showAllTopItems ? 'إظهار أقل' : 'عرض الكل'}
              </button>
            )}
          </div>
        )}

      </>) : (<>

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
            style={{ backgroundColor: !selectedCat ? (dark ? 'var(--admin-accent-dark)' : 'var(--admin-accent-light-bg)') : s.surface, borderColor: !selectedCat ? (dark ? 'var(--admin-accent-dark)' : 'var(--admin-accent-light-border)') : s.border, color: !selectedCat ? '#fff' : s.sub }}>
            الكل ({orders.length})
          </button>
          {categories.map(cat => {
            const count = orders.filter(o => o.items.some(i => catMap.get(i.item_name) === cat.id)).length;
            if (count === 0) return null;
            return (
              <button key={cat.id} onClick={() => setSelectedCat(selectedCat===cat.id ? null : cat.id)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border active:scale-95 transition-all"
                style={{ backgroundColor: selectedCat===cat.id ? (dark ? 'var(--admin-accent-dark)' : 'var(--admin-accent-light-bg)') : s.surface, borderColor: selectedCat===cat.id ? (dark ? 'var(--admin-accent-dark)' : 'var(--admin-accent-light-border)') : s.border, color: selectedCat===cat.id ? '#fff' : s.sub }}>
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

