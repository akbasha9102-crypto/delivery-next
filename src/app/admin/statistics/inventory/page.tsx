'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useDarkMode } from '@/context/ThemeContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { AdminBottomNav } from '@/components/layout/BottomNav';
import { OwnerOnly } from '@/components/guards/OwnerOnly';
import { ChevronRight, ChevronDown, Package } from 'lucide-react';
import { formatConsumedQuantity } from '@/lib/utils/unitConversion';

type StockMovementRow = {
  id: string;
  inventory_item_id: string;
  quantity_changed: number;
  reference_id: string | null;
  created_at: string;
  inventory_items: { name: string; unit: string; category: string } | null;
};

type IngredientAgg = {
  id: string;
  name: string;
  unit: string;
  category: string;
  total: number;
  byOrder: Map<string, { qty: number; time: string }>;
};

type CategoryRow = { id: string; name: string; color: string | null; sort_order: number | null };

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

const selectedCategoryStyle = (color: string | null | undefined): React.CSSProperties | undefined =>
  color ? { backgroundColor: color, borderColor: color } : undefined;

export default function InventoryStatisticsPage() {
  const router = useRouter();
  const { dark } = useDarkMode();
  const { restaurantId } = useRestaurant();
  const today = localDate();

  const [movements, setMovements]   = useState<StockMovementRow[]>([]);
  const [orderNames, setOrderNames] = useState<Map<string, string>>(new Map());
  const [loading,   setLoading]     = useState(true);
  const [range,     setRange]       = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [fromDate,  setFromDate]    = useState(quickRange('week').from);
  const [toDate,    setToDate]      = useState(quickRange('week').to);
  const [expanded,  setExpanded]    = useState<string | null>(null);
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [categoryTab, setCategoryTab] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!restaurantId) { setLoading(false); return; }
    setLoading(true);
    const start = new Date(fromDate + 'T00:00:00').toISOString();
    const end   = new Date(toDate   + 'T23:59:59').toISOString();

    const { data } = await supabase
      .from('stock_movements')
      .select('id, inventory_item_id, quantity_changed, reference_id, created_at, inventory_items(name, unit, category)')
      .eq('restaurant_id', restaurantId)
      .eq('movement_type', 'OUT_ORDER')
      .gte('created_at', start).lte('created_at', end)
      .order('created_at', { ascending: false })
      .limit(2000);

    const rows = (data || []) as unknown as StockMovementRow[];
    setMovements(rows);

    const orderIds = [...new Set(rows.map(r => r.reference_id).filter(Boolean))] as string[];
    if (orderIds.length) {
      const { data: ords } = await supabase.from('orders').select('id, client_name').in('id', orderIds);
      const map = new Map<string, string>();
      (ords || []).forEach(o => map.set(o.id, o.client_name));
      setOrderNames(map);
    } else {
      setOrderNames(new Map());
    }
    setLoading(false);
  }, [restaurantId, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchCategories = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('inventory_categories')
      .select('id, name, color, sort_order')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name');
    setCategoryRows(data || []);
  }, [restaurantId]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleQuick = (r: 'today' | 'week' | 'month') => {
    const { from, to } = quickRange(r);
    setFromDate(from); setToDate(to); setRange(r);
  };

  const ingredientStats = useMemo(() => {
    const map = new Map<string, IngredientAgg>();
    movements.forEach(r => {
      const invItem = r.inventory_items;
      if (!invItem) return;
      const qty = Math.abs(r.quantity_changed);
      const e = map.get(r.inventory_item_id) || { id: r.inventory_item_id, name: invItem.name, unit: invItem.unit, category: invItem.category, total: 0, byOrder: new Map<string, { qty: number; time: string }>() };
      e.total += qty;
      if (r.reference_id) {
        const prev = e.byOrder.get(r.reference_id);
        e.byOrder.set(r.reference_id, { qty: (prev?.qty || 0) + qty, time: prev?.time || r.created_at });
      }
      map.set(r.inventory_item_id, e);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [movements]);

  const presentCategoryNames = [...new Set(ingredientStats.map(i => i.category).filter(Boolean))];
  const registeredOrdered   = categoryRows.map(c => c.name).filter(n => presentCategoryNames.includes(n));
  const unregisteredNames   = presentCategoryNames.filter(n => !categoryRows.some(c => c.name === n)).sort();
  const categoryTabs        = [...registeredOrdered, ...unregisteredNames];

  const activeCategoryTab = categoryTab && categoryTabs.includes(categoryTab) ? categoryTab : null;
  const visibleStats = activeCategoryTab
    ? ingredientStats.filter(i => i.category === activeCategoryTab)
    : ingredientStats;

  const s = {
    bg:      dark ? '#0f172a' : '#f8fafc',
    surface: dark ? '#1e293b' : '#fff',
    border:  dark ? '#334155' : '#e2e8f0',
    text:    dark ? '#f1f5f9' : '#0f172a',
    sub:     dark ? '#94a3b8' : '#64748b',
    detailText: dark ? '#cbd5e1' : '#64748b',
    muted:   dark ? '#334155' : '#f1f5f9',
  };

  return (
    <OwnerOnly>
    <div className="min-h-screen pb-24 md:pb-0 md:mr-[70px]" style={{ backgroundColor: s.bg }}>

      <header className="sticky top-0 z-40 border-b px-4 py-4 flex items-center justify-between" style={{ backgroundColor: s.surface, borderColor: s.border }}>
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition-all" style={{ backgroundColor: s.muted }}>
          <ChevronRight size={20} style={{ color: s.sub }} />
        </button>
        <h1 className="text-xl font-bold" style={{ color: s.text }}>إحصائيات المخزون</h1>
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

      {categoryTabs.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 px-4 mb-1 scrollbar-none">
          <button onClick={() => setCategoryTab(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${!activeCategoryTab ? 'bg-[#f97316] border-[#f97316] text-white' : ''}`}
            style={!activeCategoryTab ? undefined : { backgroundColor: s.surface, borderColor: s.border, color: s.sub }}>
            الكل
          </button>
          {categoryTabs.map(c => {
            const dbCat = categoryRows.find(cr => cr.name === c);
            const selected = activeCategoryTab === c;
            const colorStyle = selected ? selectedCategoryStyle(dbCat?.color) : undefined;
            return (
              <button key={c} onClick={() => setCategoryTab(selected ? null : c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                  colorStyle ? 'text-black' : selected ? 'bg-[#f97316] border-[#f97316] text-white' : ''
                }`}
                style={colorStyle || (selected ? undefined : { backgroundColor: s.surface, borderColor: s.border, color: s.sub })}>
                {c}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
      ) : visibleStats.length === 0 ? (
        <div className="text-center mt-16">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-sm" style={{ color: s.sub }}>لا يوجد استهلاك مخزون في هذه الفترة</p>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {visibleStats.map(ing => {
            const isOpen = expanded === ing.id;
            const orderEntries = [...ing.byOrder.entries()].sort((a, b) => b[1].qty - a[1].qty);
            const totalDisplay = formatConsumedQuantity(ing.total, ing.unit);
            return (
              <div key={ing.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: s.surface, borderColor: s.border }}>
                <button onClick={() => setExpanded(isOpen ? null : ing.id)}
                  className="w-full flex items-center justify-between p-4 active:scale-[0.99] transition-all">
                  <ChevronDown size={16} style={{ color: s.sub, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  <div className="flex items-center gap-4">
                    <span className="font-black text-base" style={{ color: '#f97316' }}>
                      {totalDisplay.value} {totalDisplay.unit}
                    </span>
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-sm" style={{ color: s.text }}>{ing.name}</span>
                      <span className="text-xs mt-0.5" style={{ color: s.sub }}>{ing.byOrder.size} طلب</span>
                    </div>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(249,115,22,0.1)' }}>
                      <Package size={16} style={{ color: '#f97316' }} />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t px-4 py-3 space-y-2" style={{ borderColor: s.border, backgroundColor: s.muted }}>
                    {orderEntries.map(([orderId, info]) => {
                      const qtyDisplay = formatConsumedQuantity(info.qty, ing.unit);
                      return (
                      <div key={orderId} className="flex items-center justify-between text-xs">
                        <span className="font-bold" style={{ color: '#f97316' }}>
                          {qtyDisplay.value} {qtyDisplay.unit}
                        </span>
                        <div className="flex items-center gap-2 text-right min-w-0">
                          <span style={{ color: s.detailText }}>
                            {new Date(info.time).toLocaleString('ar-IQ', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                          </span>
                          <span className="truncate" style={{ color: s.text }}>{orderNames.get(orderId) || 'طلب محذوف'}</span>
                        </div>
                      </div>
                      );
                    })}
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
