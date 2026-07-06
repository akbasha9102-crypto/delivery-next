'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminBottomNav } from '@/components/BottomNav';
import { OwnerOnly } from '@/components/OwnerOnly';
import { useRestaurant } from '@/context/RestaurantContext';
import { useStaff } from '@/context/StaffContext';
import { Plus, Pencil, Trash2, Search, X, AlertTriangle, Package, TrendingUp, TrendingDown, RotateCcw, ArrowLeftRight, ChevronDown, PackagePlus, FolderPlus } from 'lucide-react';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_alert_stock: number;
  reorder_quantity: number;
  cost_per_unit: number;
  supplier: string | null;
  barcode: string | null;
  notes: string | null;
  is_active: boolean;
};

type MovementType = 'IN' | 'OUT_ORDER' | 'WASTE' | 'ADJUSTMENT' | 'RETURN';

type StockMovement = {
  id: string;
  inventory_item_id: string;
  movement_type: MovementType;
  quantity_changed: number;
  stock_before: number;
  stock_after: number;
  notes: string | null;
  created_at: string;
  inventory_items?: { name: string; unit: string; category: string } | null;
};

const UNITS = ['قطعة', 'غرام', 'كيلو', 'لتر', 'علبة', 'كيس', 'صندوق'];
const CATEGORIES = ['عام', 'مشروبات', 'لحوم', 'خبز', 'خضار', 'توابل', 'زيوت', 'تغليف'];

const MOVEMENT_LABELS: Record<MovementType, { label: string; color: string; icon: typeof TrendingUp; sign: string }> = {
  IN:          { label: 'استلام',        color: 'text-green-600 dark:text-green-400',  icon: TrendingUp,   sign: '+' },
  RETURN:      { label: 'إرجاع للمورد',  color: 'text-blue-600 dark:text-blue-400',    icon: RotateCcw,    sign: '-' },
  OUT_ORDER:   { label: 'استهلاك طلب',   color: 'text-orange-600 dark:text-orange-400', icon: TrendingDown, sign: '-' },
  WASTE:       { label: 'تلف/هدر',       color: 'text-red-600 dark:text-red-400',      icon: Trash2,       sign: '-' },
  ADJUSTMENT:  { label: 'تعديل يدوي',    color: 'text-purple-600 dark:text-purple-400', icon: ArrowLeftRight, sign: '±' },
};

const emptyForm = {
  name: '', category: 'عام', unit: 'قطعة',
  current_stock: '', min_alert_stock: '', reorder_quantity: '',
  cost_per_unit: '', supplier: '', barcode: '', notes: '',
};

export default function InventoryPage() {
  const { dark } = useDarkMode();
  const { restaurantId } = useRestaurant();

  const [tab, setTab] = useState<'items' | 'movements'>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [movCatFilter, setMovCatFilter] = useState<string | null>(null);
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [customCat, setCustomCat] = useState('');

  // قائمة اختيار "مادة جديدة / فئة جديدة" عند الضغط على +
  const [showAddMenu, setShowAddMenu] = useState(false);

  // فورم إضافة فئة جديدة مستقلة
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // فورم إضافة/تعديل مادة
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // فورم حركة المخزون
  const [movementTarget, setMovementTarget] = useState<InventoryItem | null>(null);
  const [movType, setMovType] = useState<MovementType>('IN');
  const [movQty, setMovQty] = useState('');
  const [movNotes, setMovNotes] = useState('');
  const [movSaving, setMovSaving] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchItems = useCallback(async () => {
    if (!restaurantId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('category')
      .order('name');
    if (error) { showToast('تعذّر تحميل المخزون', false); }
    else setItems(data || []);
    setLoading(false);
  }, [restaurantId]);

  const fetchMovements = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('stock_movements')
      .select('*, inventory_items(name, unit, category)')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(100);
    setMovements(data || []);
  }, [restaurantId]);

  const fetchCategoriesList = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('inventory_categories')
      .select('name')
      .eq('restaurant_id', restaurantId)
      .order('name');
    setCategoriesList((data || []).map((c: { name: string }) => c.name));
  }, [restaurantId]);

  // إصلاح ثغرة أمنية: هذه الصفحة (owner-only) لا يمكن لفها بـ layout.tsx
  // على مستوى /admin/inventory لأن /admin/inventory/waste (شاشة الكاشير
  // المبسّطة) مسار فرعي منها وسيُغلَق خطأً. لذلك الحارس هنا داخل الصفحة
  // نفسها، لكن على مستوى شرط الجلب (fetch) وليس فقط العرض — لا نستدعي
  // fetchItems/fetchMovements (اللذين يجيبان cost_per_unit/supplier مباشرة
  // عبر Supabase client) إطلاقاً قبل التأكد من أن الدور النشط ليس كاشيراً.
  const { ready: staffReady, isCashier } = useStaff();
  useEffect(() => {
    if (!staffReady || isCashier) return;
    setLoading(true);
    fetchItems();
    fetchMovements();
    fetchCategoriesList();
  }, [staffReady, isCashier, fetchItems, fetchMovements, fetchCategoriesList]);

  // قفل تمرير الصفحة خلف أي نافذة منبثقة حتى لا تتحرك الخلفية بدل النافذة
  useEffect(() => {
    const isModalOpen = showForm || !!movementTarget || showAddMenu || showCatForm;
    if (isModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showForm, movementTarget, showAddMenu, showCatForm]);

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm);
    setShowCustomCat(false);
    setCustomCat('');
    setShowForm(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setShowCustomCat(false);
    setCustomCat('');
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      current_stock: String(item.current_stock),
      min_alert_stock: String(item.min_alert_stock),
      reorder_quantity: String(item.reorder_quantity),
      cost_per_unit: String(item.cost_per_unit),
      supplier: item.supplier || '',
      barcode: item.barcode || '',
      notes: item.notes || '',
    });
    setShowForm(true);
  };

  const saveItem = async () => {
    if (!form.name.trim()) return;
    if (!restaurantId) { showToast('تعذّر تحديد المطعم، أعد تحميل الصفحة', false); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      current_stock: parseFloat(form.current_stock) || 0,
      min_alert_stock: parseFloat(form.min_alert_stock) || 0,
      reorder_quantity: parseFloat(form.reorder_quantity) || 0,
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
      supplier: form.supplier.trim() || null,
      barcode: form.barcode.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editItem) {
      const { error } = await supabase.from('inventory_items').update(payload).eq('id', editItem.id);
      if (error) showToast('تعذّر الحفظ', false);
      else {
        showToast('✓ تم الحفظ');
        setShowForm(false);
        setCatFilter(null);
        setSearch('');
        fetchItems();
      }
    } else {
      const { error } = await supabase.from('inventory_items').insert([{ ...payload, restaurant_id: restaurantId }]);
      if (error) showToast('تعذّر الإضافة', false);
      else {
        showToast('✓ تمت الإضافة');
        setShowForm(false);
        setCatFilter(null);
        setShowLowOnly(false);
        setSearch('');
        fetchItems();
      }
    }
    setSaving(false);
  };

  const saveNewCategory = async () => {
    const name = newCatName.trim();
    if (!name || !restaurantId) return;
    setCatSaving(true);
    const { error } = await supabase.from('inventory_categories').insert([{ restaurant_id: restaurantId, name }]);
    if (error) showToast(error.code === '23505' ? 'هذه الفئة موجودة مسبقاً' : 'تعذّرت إضافة الفئة', false);
    else {
      showToast('✓ تمت إضافة الفئة');
      setNewCatName('');
      setShowCatForm(false);
      fetchCategoriesList();
    }
    setCatSaving(false);
  };

  const deleteItem = async (item: InventoryItem) => {
    if (!confirm(`هل أنت متأكد من حذف "${item.name}"؟`)) return;
    const { error } = await supabase.from('inventory_items').update({ is_active: false }).eq('id', item.id);
    if (error) showToast('تعذّر الحذف', false);
    else { showToast('✓ تم الحذف'); fetchItems(); }
  };

  const submitMovement = async () => {
    if (!movementTarget || !movQty || !restaurantId) return;
    const qty = parseFloat(movQty);
    if (isNaN(qty) || qty <= 0) return;
    setMovSaving(true);
    const { error } = await supabase.from('stock_movements').insert([{
      inventory_item_id: movementTarget.id,
      restaurant_id: restaurantId,
      movement_type: movType,
      quantity_changed: qty,
      notes: movNotes.trim() || null,
    }]);
    if (error) showToast(error.message.includes('المخزون غير كافٍ') ? '⚠️ المخزون غير كافٍ' : 'تعذّر تسجيل الحركة', false);
    else {
      showToast('✓ تم تسجيل الحركة');
      setMovementTarget(null);
      setMovQty('');
      setMovNotes('');
      fetchItems();
      fetchMovements();
    }
    setMovSaving(false);
  };

  const categories = [...new Set(items.map(i => i.category))].sort();
  const lowStockCount = items.filter(i => i.current_stock <= i.min_alert_stock).length;

  const filtered = items.filter(i => {
    if (showLowOnly && i.current_stock > i.min_alert_stock) return false;
    if (catFilter && i.category !== catFilter) return false;
    if (search && !i.name.includes(search) && !i.supplier?.includes(search)) return false;
    return true;
  });

  const movementCategories = [...new Set(movements.map(m => m.inventory_items?.category).filter((c): c is string => !!c))].sort();
  const filteredMovements = movements.filter(m => !movCatFilter || m.inventory_items?.category === movCatFilter);

  const formCategories = [...new Set([...CATEGORIES, ...categories, ...categoriesList, ...(form.category ? [form.category] : [])])];

  const input = `w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316] mb-3`;

  return (
    <OwnerOnly>
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 md:pb-0 md:mr-[70px]">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 flex items-center justify-between">
        <button onClick={() => setShowAddMenu(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#f97316] text-white active:scale-90 transition-all">
          <Plus size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Package size={18} className="text-[#f97316]" />
          <p className="font-bold text-gray-900 dark:text-slate-100">المخزون</p>
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              <AlertTriangle size={10} /> {lowStockCount}
            </span>
          )}
        </div>
        <div className="w-9" />
      </header>

      {toast && (
        <div className={`mx-4 mt-3 px-4 py-3 rounded-xl border text-center font-bold text-sm ${toast.ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex mx-4 mt-4 mb-3 bg-gray-100 dark:bg-slate-800 rounded-2xl p-1">
        <button onClick={() => setTab('items')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${tab === 'items' ? 'bg-[#f97316] text-white' : 'text-gray-500 dark:text-slate-400'}`}>
          المواد ({items.length})
        </button>
        <button onClick={() => setTab('movements')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${tab === 'movements' ? 'bg-[#f97316] text-white' : 'text-gray-500 dark:text-slate-400'}`}>
          الحركات
        </button>
      </div>

      {tab === 'items' && (
        <div className="px-4">
          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن مادة..." dir="rtl"
              className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl py-3 pr-10 pl-4 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316]" />
            {search && <button onClick={() => setSearch('')} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400"><X size={16} /></button>}
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
            <button onClick={() => setShowLowOnly(!showLowOnly)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${showLowOnly ? 'bg-red-500 border-red-500 text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
              <AlertTriangle size={12} /> منخفض ({lowStockCount})
            </button>
            <button onClick={() => setCatFilter(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${!catFilter ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
              الكل
            </button>
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(catFilter === c ? null : c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${catFilter === c ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                {c}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center mt-20">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-gray-400 dark:text-slate-500">{items.length === 0 ? 'لا توجد مواد بعد — اضغط + للإضافة' : 'لا توجد نتائج'}</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filtered.map(item => {
                const isLow = item.current_stock <= item.min_alert_stock;
                const pct = item.min_alert_stock > 0
                  ? Math.min(1, item.current_stock / (item.min_alert_stock * 3))
                  : 1;
                return (
                  <div key={item.id} className={`bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden ${isLow ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-slate-700'}`}>
                    {isLow && <div className="h-1 bg-red-500" />}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(item)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-500 active:scale-90 transition-all">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteItem(item)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-400 active:scale-90 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 dark:text-slate-100">{item.name}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{item.category} · {item.supplier || 'بدون مورد'}</p>
                        </div>
                      </div>

                      {/* Stock bar */}
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          {isLow && <span className="text-xs text-red-500 font-bold flex items-center gap-1"><AlertTriangle size={10} /> منخفض</span>}
                          <div className={`flex-1 text-left ${!isLow && 'w-full'}`}>
                            <span className={`text-lg font-black ${isLow ? 'text-red-500' : 'text-gray-900 dark:text-slate-100'}`}>
                              {item.current_stock.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-400 mr-1">{item.unit}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isLow ? 'bg-red-500' : pct < 0.4 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.max(3, pct * 100)}%` }} />
                        </div>
                        {item.min_alert_stock > 0 && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 text-left">الحد الأدنى: {item.min_alert_stock} {item.unit}</p>
                        )}
                      </div>

                      {/* Cost + Move button */}
                      <div className="flex items-center justify-between">
                        <button onClick={() => { setMovementTarget(item); setMovType('IN'); setMovQty(''); setMovNotes(''); }}
                          className="flex items-center gap-1.5 bg-[#f97316] text-white font-bold text-xs px-3 py-2 rounded-xl active:scale-95 transition-all">
                          <ArrowLeftRight size={12} /> حركة مخزون
                        </button>
                        {item.cost_per_unit > 0 && (
                          <p className="text-xs text-gray-500 dark:text-slate-400">{item.cost_per_unit.toLocaleString()} د.ع/{item.unit}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'movements' && (
        <div className="px-4 pb-4">
          {movements.length > 0 && movementCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
              <button onClick={() => setMovCatFilter(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${!movCatFilter ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                الكل
              </button>
              {movementCategories.map(c => (
                <button key={c} onClick={() => setMovCatFilter(movCatFilter === c ? null : c)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${movCatFilter === c ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
          {filteredMovements.length === 0 ? (
            <div className="text-center mt-20">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-gray-400 dark:text-slate-500">{movements.length === 0 ? 'لا توجد حركات بعد' : 'لا توجد حركات في هذا القسم'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMovements.map(m => {
                const cfg = MOVEMENT_LABELS[m.movement_type];
                const Icon = cfg.icon;
                const isIn = m.movement_type === 'IN' || m.movement_type === 'ADJUSTMENT';
                const itemName = m.inventory_items?.name ?? '—';
                const unit = m.inventory_items?.unit ?? '';
                return (
                  <div key={m.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-black ${isIn ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {isIn ? '+' : '-'}{Math.abs(m.quantity_changed).toLocaleString()} {unit}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{itemName}</p>
                        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                      </div>
                    </div>
                    {(m.stock_before !== null || m.stock_after !== null) && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 dark:text-slate-500 justify-end">
                        <span>{m.stock_after?.toLocaleString()} {unit}</span>
                        <span>←</span>
                        <span>{m.stock_before?.toLocaleString()} {unit}</span>
                      </div>
                    )}
                    {m.notes && <p className="text-xs text-amber-600 dark:text-amber-400 text-right mt-1">📝 {m.notes}</p>}
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-right mt-1">
                      {new Date(m.created_at).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ موديل إضافة/تعديل مادة ═══ */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl max-h-[96dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-700">
              <button onClick={saveItem} disabled={saving || !form.name.trim()} className="bg-[#f97316] disabled:opacity-40 text-white font-bold px-4 py-2 rounded-xl active:scale-95 transition-all text-sm">
                {saving ? '...' : editItem ? 'حفظ' : 'إضافة'}
              </button>
              <h3 className="font-bold text-gray-900 dark:text-slate-100">{editItem ? '✏️ تعديل مادة' : '➕ مادة جديدة'}</h3>
              <button onClick={() => setShowForm(false)} className="bg-gray-100 dark:bg-slate-700 text-gray-500 px-3 py-2 rounded-xl text-sm font-bold active:scale-95">إلغاء</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-1">

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">اسم المادة *</p>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم المادة" dir="rtl" className={input} />

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">الفئة</p>
              <div className="flex gap-1.5 flex-wrap mb-2 justify-end">
                {formCategories.map(c => (
                  <button key={c} onClick={() => setForm(p => ({ ...p, category: c }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border active:scale-95 transition-all ${form.category === c ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                    {c}
                  </button>
                ))}
                <button onClick={() => setShowCustomCat(v => !v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border active:scale-95 transition-all ${showCustomCat ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                  + قسم جديد
                </button>
              </div>
              {showCustomCat && (
                <div className="flex gap-1.5 mb-3">
                  <input value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="اسم القسم الجديد" dir="rtl"
                    className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316]" />
                  <button onClick={() => {
                    const name = customCat.trim();
                    if (!name) return;
                    setForm(p => ({ ...p, category: name }));
                    setCustomCat('');
                    setShowCustomCat(false);
                  }} className="bg-[#f97316] text-white font-bold px-4 py-2.5 rounded-xl active:scale-95 transition-all text-sm">
                    تم
                  </button>
                </div>
              )}

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">وحدة القياس</p>
              <div className="flex gap-1.5 flex-wrap mb-3 justify-end">
                {UNITS.map(u => (
                  <button key={u} onClick={() => setForm(p => ({ ...p, unit: u }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border active:scale-95 transition-all ${form.unit === u ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                    {u}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">الكمية الحالية</p>
                  <input type="number" value={form.current_stock} onChange={e => setForm(p => ({ ...p, current_stock: e.target.value }))} placeholder="0" dir="rtl"
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">حد التنبيه الأدنى</p>
                  <input type="number" value={form.min_alert_stock} onChange={e => setForm(p => ({ ...p, min_alert_stock: e.target.value }))} placeholder="0" dir="rtl"
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">كمية إعادة الطلب</p>
                  <input type="number" value={form.reorder_quantity} onChange={e => setForm(p => ({ ...p, reorder_quantity: e.target.value }))} placeholder="0" dir="rtl"
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">التكلفة / وحدة (د.ع)</p>
                  <input type="number" value={form.cost_per_unit} onChange={e => setForm(p => ({ ...p, cost_per_unit: e.target.value }))} placeholder="0" dir="rtl"
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]" />
                </div>
              </div>

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">المورد</p>
              <input value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} placeholder="اسم المورد (اختياري)" dir="rtl" className={input} />

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">ملاحظات</p>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات (اختياري)" dir="rtl" className={input} />
            </div>
          </div>
        </div>
      )}

      {/* ═══ موديل حركة المخزون ═══ */}
      {movementTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setMovementTarget(null)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-5 pb-2">
              <p className="font-bold text-gray-900 dark:text-slate-100 text-right text-base mb-1">حركة مخزون</p>
              <p className="text-sm text-[#f97316] font-bold text-right mb-4">{movementTarget.name} — {movementTarget.current_stock} {movementTarget.unit}</p>

              {/* نوع الحركة */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['IN', 'WASTE', 'ADJUSTMENT', 'RETURN', 'OUT_ORDER'] as MovementType[]).map(t => {
                  const cfg = MOVEMENT_LABELS[t];
                  return (
                    <button key={t} onClick={() => setMovType(t)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${movType === t ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300'}`}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* الكمية */}
              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">الكمية ({movementTarget.unit})</p>
              <input type="number" value={movQty} onChange={e => setMovQty(e.target.value)} placeholder="0"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-3" />

              {/* ملاحظات */}
              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">ملاحظة (اختياري)</p>
              <input value={movNotes} onChange={e => setMovNotes(e.target.value)} placeholder="سبب التعديل..." dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-4" />

              <button onClick={submitMovement} disabled={movSaving || !movQty}
                className="w-full bg-[#f97316] disabled:opacity-40 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-all mb-6">
                {movSaving ? 'جاري الحفظ...' : 'تسجيل الحركة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ قائمة اختيار: مادة جديدة / فئة جديدة ═══ */}
      {showAddMenu && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowAddMenu(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-6 space-y-2">
              <button onClick={() => { setShowAddMenu(false); openAdd(); }}
                className="w-full flex items-center gap-3 bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 text-right active:scale-[0.98] transition-all">
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#f97316]/10 text-[#f97316]">
                  <PackagePlus size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">مادة جديدة</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">إضافة مادة جديدة إلى المخزون</p>
                </div>
              </button>
              <button onClick={() => { setShowAddMenu(false); setNewCatName(''); setShowCatForm(true); }}
                className="w-full flex items-center gap-3 bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 text-right active:scale-[0.98] transition-all">
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#f97316]/10 text-[#f97316]">
                  <FolderPlus size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">فئة جديدة</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">إضافة فئة جديدة تظهر عند إضافة مادة</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ موديل إضافة فئة جديدة ═══ */}
      {showCatForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowCatForm(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-6">
              <p className="font-bold text-gray-900 dark:text-slate-100 text-right text-base mb-4">فئة جديدة</p>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="اسم الفئة" dir="rtl"
                autoFocus
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316] mb-4" />
              <button onClick={saveNewCategory} disabled={catSaving || !newCatName.trim()}
                className="w-full bg-[#f97316] disabled:opacity-40 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-all mb-6">
                {catSaving ? 'جاري الحفظ...' : 'إضافة الفئة'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminBottomNav />
    </div>
    </OwnerOnly>
  );
}
