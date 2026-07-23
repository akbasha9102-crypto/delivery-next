'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminBottomNav } from '@/components/layout/BottomNav';
import { useRestaurant } from '@/context/RestaurantContext';
import { Pencil, Trash2, Search, X, AlertTriangle, Package, TrendingUp, TrendingDown, RotateCcw, ArrowLeftRight, ChevronDown, PackagePlus, FolderPlus, ShoppingCart, ArrowUp, ArrowDown, GitBranch, ChevronRight, Plus } from 'lucide-react';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_alert_stock: number;
  reorder_quantity: number | null;
  cost_per_unit: number;
  supplier: string | null;
  barcode: string | null;
  notes: string | null;
  is_active: boolean;
};

type CategoryRow = { id: string; name: string; notes: string | null; color: string | null; is_active: boolean; sort_order: number | null; supplier: string | null; is_system: boolean };

type MenuItemLite = { id: string; name: string };
type RecipeLink = { id: string; menu_item_id: string; quantity_required: number; unit: string | null };

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

const UNITS = ['عدد', 'غرام', 'كيلو', 'لتر', 'علبة', 'كيس', 'صندوق'];
const CATEGORIES = ['عام', 'مشروبات', 'لحوم', 'خبز', 'خضار', 'توابل', 'زيوت', 'تغليف'];

const CATEGORY_COLORS = [
  { label: 'أحمر',    hex: '#ef4444' },
  { label: 'أخضر',    hex: '#22c55e' },
  { label: 'أزرق',    hex: '#3b82f6' },
  { label: 'أصفر',    hex: '#eab308' },
  { label: 'بنفسجي',  hex: '#a855f7' },
  { label: 'وردي',    hex: '#ec4899' },
  { label: 'تركواز',  hex: '#14b8a6' },
  { label: 'نيلي',    hex: '#6366f1' },
  { label: 'بني',     hex: '#a16207' },
  { label: 'رمادي',   hex: '#64748b' },
];

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const selectedCategoryStyle = (color: string | null | undefined): React.CSSProperties | undefined =>
  color ? { backgroundColor: color, borderColor: color } : undefined;

const MOVEMENT_LABELS: Record<MovementType, { label: string; color: string; icon: typeof TrendingUp; sign: string }> = {
  IN:          { label: 'استلام',        color: 'text-green-600 dark:text-green-400',  icon: TrendingUp,   sign: '+' },
  RETURN:      { label: 'إرجاع للمورد',  color: 'text-blue-600 dark:text-blue-400',    icon: RotateCcw,    sign: '-' },
  OUT_ORDER:   { label: 'استهلاك طلب',   color: 'text-orange-600 dark:text-orange-400', icon: TrendingDown, sign: '-' },
  WASTE:       { label: 'تلف/هدر',       color: 'text-red-600 dark:text-red-400',      icon: Trash2,       sign: '-' },
  ADJUSTMENT:  { label: 'تعديل يدوي',    color: 'text-purple-600 dark:text-purple-400', icon: ArrowLeftRight, sign: '±' },
};

const emptyForm = {
  name: '', category: 'عام', unit: 'عدد',
  current_stock: '', min_alert_stock: '', reorder_quantity: '',
  cost_per_unit: '', supplier: '', barcode: '', notes: '',
};

export default function InventoryPage() {
  const { dark } = useDarkMode();
  const { restaurantId } = useRestaurant();

  const [tab, setTab] = useState<'items' | 'movements' | 'add' | 'categories'>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [movCatFilter, setMovCatFilter] = useState<string | null>(null);

  // فورم إضافة فئة جديدة مستقلة
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatNotes, setNewCatNotes] = useState('');
  const [newCatColor, setNewCatColor] = useState<string>(CATEGORY_COLORS[0].hex);
  const [newCatActive, setNewCatActive] = useState(true);
  const [catSaving, setCatSaving] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryRow | null>(null);
  const [newCatSupplier, setNewCatSupplier] = useState('');
  const [showCatReorder, setShowCatReorder] = useState(false);
  const [reorderCatRows, setReorderCatRows] = useState<CategoryRow[]>([]);
  const [catReorderSaving, setCatReorderSaving] = useState(false);

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

  // فورم تسجيل شراء
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseItemId, setPurchaseItemId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseCatFilter, setPurchaseCatFilter] = useState<string | null>(null);

  // شجرة المكونات: كم وجبة تكفيها الوحدة الواحدة من المادة (بدل تقدير الغرامات يدوياً)
  const [menuItems, setMenuItems] = useState<MenuItemLite[]>([]);
  const [showRecipeTree, setShowRecipeTree] = useState(false);
  const [treeSearch, setTreeSearch] = useState('');
  const [treeMaterial, setTreeMaterial] = useState<InventoryItem | null>(null);
  const [treeLinks, setTreeLinks] = useState<RecipeLink[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeDishId, setTreeDishId] = useState('');
  const [treeYield, setTreeYield] = useState('');
  const [treeSaving, setTreeSaving] = useState(false);

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
      .select('id, name, notes, color, is_active, sort_order, supplier, is_system')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name');
    setCategoryRows(data || []);
  }, [restaurantId]);

  const fetchMenuItemsList = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('items')
      .select('id, name')
      .eq('restaurant_id', restaurantId)
      .order('name');
    setMenuItems(data || []);
  }, [restaurantId]);

  // الكاشير له نفس صلاحيات المالك بالكامل بهذه الصفحة الآن — لا شرط دور هنا.
  useEffect(() => {
    setLoading(true);
    fetchItems();
    fetchMovements();
    fetchCategoriesList();
    fetchMenuItemsList();
  }, [fetchItems, fetchMovements, fetchCategoriesList, fetchMenuItemsList]);

  // نافذة منبثقة مفتوحة؟ تُستخدم لقفل تمرير الخلفية وإخفاء الشريط السفلي تحتها
  const isModalOpen = showForm || !!movementTarget || showCatForm || showPurchaseForm || showCatReorder || showRecipeTree;

  useEffect(() => {
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
  }, [isModalOpen]);

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      current_stock: String(item.current_stock),
      min_alert_stock: String(item.min_alert_stock),
      reorder_quantity: item.reorder_quantity == null ? '' : String(item.reorder_quantity),
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
      reorder_quantity: form.reorder_quantity.trim() === '' ? null : (parseFloat(form.reorder_quantity) || 0),
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

  const openAddCategory = () => {
    setEditingCat(null);
    setNewCatName('');
    setNewCatNotes('');
    setNewCatColor(CATEGORY_COLORS[0].hex);
    setNewCatSupplier('');
    setNewCatActive(true);
    setShowCatForm(true);
  };

  const openEditCategory = (cat: CategoryRow) => {
    setEditingCat(cat);
    setNewCatName(cat.name);
    setNewCatNotes(cat.notes || '');
    setNewCatColor(cat.color || CATEGORY_COLORS[0].hex);
    setNewCatSupplier(cat.supplier || '');
    setNewCatActive(cat.is_active);
    setShowCatForm(true);
  };

  const saveCategory = async () => {
    const name = newCatName.trim();
    if (!name || !restaurantId) return;
    setCatSaving(true);
    const payload = {
      name,
      notes: newCatNotes.trim() || null,
      color: newCatColor,
      supplier: newCatSupplier.trim() || null,
      is_active: newCatActive,
    };
    const { error } = editingCat
      ? await supabase.from('inventory_categories').update(payload).eq('id', editingCat.id)
      : await supabase.from('inventory_categories').insert([{ ...payload, restaurant_id: restaurantId }]);
    if (error) {
      showToast(error.code === '23505' ? 'هذه الفئة موجودة مسبقاً' : (editingCat ? 'تعذّر حفظ التعديلات' : 'تعذّرت إضافة الفئة'), false);
    } else {
      showToast(editingCat ? '✓ تم حفظ التعديلات' : '✓ تمت إضافة الفئة');
      setShowCatForm(false);
      setEditingCat(null);
      fetchCategoriesList();
    }
    setCatSaving(false);
  };

  const deleteCategory = async (cat: CategoryRow) => {
    const itemsUsingCat = items.filter(i => i.category === cat.name).length;
    const parts = [`هل أنت متأكد من حذف فئة "${cat.name}"؟`];
    if (cat.is_system) parts.push('هذه فئة افتراضية من فئات النظام.');
    if (itemsUsingCat > 0) parts.push(`تستخدمها حالياً ${itemsUsingCat} مادة — لن تُحذف أو تُعدَّل أي مادة، فقط ستفقد اللون والترتيب المخصصين للفئة.`);
    else parts.push('لا توجد مواد تستخدم هذه الفئة حالياً.');
    if (!confirm(parts.join('\n'))) return;
    setCatSaving(true);
    const { error } = await supabase.from('inventory_categories').delete().eq('id', cat.id);
    if (error) showToast('تعذّر حذف الفئة', false);
    else { showToast('✓ تم حذف الفئة'); fetchCategoriesList(); }
    setCatSaving(false);
  };

  const openCatReorder = () => {
    setReorderCatRows([...categoryRows]);
    setShowCatReorder(true);
  };

  const moveCatRow = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= reorderCatRows.length) return;
    setReorderCatRows(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const saveCatReorder = async () => {
    setCatReorderSaving(true);
    await Promise.all(
      reorderCatRows.map((cat, i) =>
        supabase.from('inventory_categories').update({ sort_order: i }).eq('id', cat.id)
      )
    );
    await fetchCategoriesList();
    setShowCatReorder(false);
    setCatReorderSaving(false);
    showToast('✓ تم حفظ الترتيب');
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

  const openPurchase = () => {
    setPurchaseItemId('');
    setPurchaseQty('');
    setPurchasePrice('');
    setPurchaseNotes('');
    setPurchaseCatFilter(null);
    setShowPurchaseForm(true);
  };

  const selectPurchaseItem = (id: string) => {
    setPurchaseItemId(id);
    const it = items.find(i => i.id === id);
    setPurchasePrice(it && it.cost_per_unit > 0 ? String(it.cost_per_unit) : '');
    setPurchaseQty(it && it.reorder_quantity ? String(it.reorder_quantity) : '');
  };

  const selectPurchaseCatFilter = (cat: string | null) => {
    setPurchaseCatFilter(cat);
    setPurchaseItemId('');
    setPurchasePrice('');
  };

  const recordPurchase = async () => {
    if (!purchaseItemId) { showToast('اختر مادة أولاً', false); return; }
    const qty = parseFloat(purchaseQty);
    const price = parseFloat(purchasePrice);
    if (isNaN(qty) || qty <= 0) { showToast('أدخل كمية صحيحة أكبر من صفر', false); return; }
    if (isNaN(price) || price < 0) { showToast('أدخل سعراً صحيحاً', false); return; }
    setPurchaseSaving(true);
    const { error } = await supabase.rpc('record_inventory_purchase', {
      p_item_id: purchaseItemId,
      p_quantity: qty,
      p_price: price,
      p_notes: purchaseNotes.trim() || null,
    });
    if (error) showToast('تعذّر تسجيل عملية الشراء', false);
    else {
      showToast('✓ تم تسجيل الشراء وتحديث السعر');
      setShowPurchaseForm(false);
      fetchItems();
      fetchMovements();
    }
    setPurchaseSaving(false);
  };

  const openRecipeTree = () => {
    setTreeSearch('');
    setTreeMaterial(null);
    setTreeLinks([]);
    setShowRecipeTree(true);
  };

  const openTreeMaterial = async (mat: InventoryItem) => {
    setTreeMaterial(mat);
    setTreeDishId('');
    setTreeYield('');
    setTreeLoading(true);
    const { data } = await supabase
      .from('menu_recipes')
      .select('id, menu_item_id, quantity_required, unit')
      .eq('inventory_item_id', mat.id);
    setTreeLinks(data || []);
    setTreeLoading(false);
  };

  const addTreeLink = async () => {
    if (!treeMaterial || !treeDishId) return;
    const servings = parseFloat(treeYield.replace(',', '.'));
    if (isNaN(servings) || servings <= 0) { showToast('أدخل عدد وجبات صحيح أكبر من صفر', false); return; }
    setTreeSaving(true);
    const qty = Math.round((1 / servings) * 1000) / 1000; // نفس دقة العمود NUMERIC(12,3)
    const { data, error } = await supabase
      .from('menu_recipes')
      .insert([{ menu_item_id: treeDishId, inventory_item_id: treeMaterial.id, quantity_required: qty, unit: treeMaterial.unit }])
      .select('id, menu_item_id, quantity_required, unit')
      .single();
    if (error) showToast(error.code === '23505' ? 'هذه الوجبة مرتبطة بهذه المادة مسبقاً' : 'تعذّر إضافة الربط', false);
    else {
      setTreeLinks(prev => [...prev, data]);
      setTreeDishId('');
      setTreeYield('');
      showToast('✓ تم الربط');
    }
    setTreeSaving(false);
  };

  const removeTreeLink = async (id: string) => {
    const { error } = await supabase.from('menu_recipes').delete().eq('id', id);
    if (error) { showToast('تعذّر حذف الربط', false); return; }
    setTreeLinks(prev => prev.filter(l => l.id !== id));
  };

  const itemCategoryNames = [...new Set(items.map(i => i.category))];
  const registeredOrdered = categoryRows.map(c => c.name).filter(n => itemCategoryNames.includes(n));
  const unregisteredNames = itemCategoryNames.filter(n => !categoryRows.some(c => c.name === n)).sort();
  const categories = [...registeredOrdered, ...unregisteredNames];
  const lowStockCount = items.filter(i => i.current_stock <= i.min_alert_stock).length;

  const filtered = items.filter(i => {
    if (showLowOnly && i.current_stock > i.min_alert_stock) return false;
    if (catFilter && i.category !== catFilter) return false;
    if (search && !i.name.includes(search) && !i.supplier?.includes(search)) return false;
    return true;
  });

  const movementCategories = [...new Set(movements.map(m => m.inventory_items?.category).filter((c): c is string => !!c))].sort();
  const filteredMovements = movements.filter(m => !movCatFilter || m.inventory_items?.category === movCatFilter);

  const activeCategoryNames = categoryRows.filter(c => c.is_active).map(c => c.name);
  const formCategories = [...new Set([...CATEGORIES, ...categories, ...activeCategoryNames, ...(form.category ? [form.category] : [])])];

  const selectedPurchaseItem = items.find(i => i.id === purchaseItemId);
  const purchaseFilteredItems = items.filter(i => !purchaseCatFilter || i.category === purchaseCatFilter);

  const treeFilteredItems = items.filter(i => !treeSearch || i.name.includes(treeSearch));
  const treeAvailableDishes = menuItems.filter(m => !treeLinks.some(l => l.menu_item_id === m.id));
  const dishName = (id: string) => menuItems.find(m => m.id === id)?.name || '—';

  const input = `w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316] mb-3`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 md:pb-0 md:mr-[70px]">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Package size={18} className="text-gray-500 dark:text-slate-400" />
          <p className="font-bold text-gray-500 dark:text-slate-400">المخزون</p>
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              <AlertTriangle size={10} /> {lowStockCount}
            </span>
          )}
        </div>
      </header>

      {toast && (
        <div className={`mx-4 mt-3 px-4 py-3 rounded-xl border text-center font-bold text-sm ${toast.ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex mx-4 mt-4 mb-3 bg-gray-100 dark:bg-slate-800 rounded-2xl p-1">
        <button onClick={() => setTab('items')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${tab === 'items' ? 'bg-[#15803D] text-white border border-[#1d1d1f] dark:bg-[#f97316] dark:border-transparent' : 'text-gray-500 dark:text-slate-400'}`}>
          المواد ({items.length})
        </button>
        <button onClick={() => setTab('categories')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${tab === 'categories' ? 'bg-[#15803D] text-white border border-[#1d1d1f] dark:bg-[#f97316] dark:border-transparent' : 'text-gray-500 dark:text-slate-400'}`}>
          الفئات
        </button>
        <button onClick={() => setTab('movements')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${tab === 'movements' ? 'bg-[#15803D] text-white border border-[#1d1d1f] dark:bg-[#f97316] dark:border-transparent' : 'text-gray-500 dark:text-slate-400'}`}>
          الحركات
        </button>
        <button onClick={() => setTab('add')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${tab === 'add' ? 'bg-[#15803D] text-white border border-[#1d1d1f] dark:bg-[#f97316] dark:border-transparent' : 'text-gray-500 dark:text-slate-400'}`}>
          إضافة
        </button>
      </div>

      {tab === 'add' && (
        <div className="px-4 space-y-3 pb-4">
          <button onClick={openPurchase}
            className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 active:scale-95 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <ShoppingCart size={26} className="text-gray-500 dark:text-slate-400" />
            </div>
            <div className="text-right flex-1">
              <p className="font-bold text-gray-900 dark:text-slate-100">تسجيل عملية شراء</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">تسجيل شراء مادة وتحديث السعر</p>
            </div>
          </button>

          <button onClick={openAdd}
            className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 active:scale-95 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <PackagePlus size={26} className="text-gray-500 dark:text-slate-400" />
            </div>
            <div className="text-right flex-1">
              <p className="font-bold text-gray-900 dark:text-slate-100">مادة جديدة</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">إضافة مادة جديدة إلى المخزون</p>
            </div>
          </button>

          <button onClick={openAddCategory}
            className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 active:scale-95 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <FolderPlus size={26} className="text-gray-500 dark:text-slate-400" />
            </div>
            <div className="text-right flex-1">
              <p className="font-bold text-gray-900 dark:text-slate-100">فئة جديدة</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">إضافة فئة جديدة تظهر عند إضافة مادة</p>
            </div>
          </button>

          <button onClick={openRecipeTree}
            className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 active:scale-95 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <GitBranch size={26} className="text-gray-500 dark:text-slate-400" />
            </div>
            <div className="text-right flex-1">
              <p className="font-bold text-gray-900 dark:text-slate-100">شجرة المكونات</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">اربط المادة بالوجبات حسب عدد الوجبات التي تكفيها، بدون تقدير الغرامات يدوياً</p>
            </div>
          </button>
        </div>
      )}

      {tab === 'categories' && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={openCatReorder}
              className="flex items-center p-1.5 rounded-xl bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 active:scale-95 transition-all">
              <div className="relative w-4 h-4 rounded-full border border-gray-500 dark:border-slate-400 flex items-center justify-center">
                <ArrowUp size={8} className="absolute top-0.5 text-gray-500 dark:text-slate-400" />
                <ArrowDown size={8} className="absolute bottom-0.5 text-gray-500 dark:text-slate-400" />
              </div>
            </button>
            <p className="font-bold text-gray-900 dark:text-slate-100">الفئات ({categoryRows.length})</p>
          </div>

          {categoryRows.length === 0 ? (
            <div className="text-center mt-20">
              <p className="text-4xl mb-3">🗂️</p>
              <p className="text-gray-400 dark:text-slate-500">لا توجد فئات بعد — أضف فئة من تبويب إضافة</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categoryRows.map(cat => (
                <div key={cat.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3">
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => openEditCategory(cat)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-500 active:scale-90 transition-all">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => deleteCategory(cat)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-400 active:scale-90 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <div className="flex items-center gap-2 justify-end">
                      <p className={`font-bold ${cat.is_active ? 'text-gray-900 dark:text-slate-100' : 'text-gray-400 dark:text-slate-500 line-through'}`}>{cat.name}</p>
                      {cat.is_system && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 flex-shrink-0">افتراضية</span>
                      )}
                      <span className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10 dark:border-white/10" style={{ backgroundColor: cat.color || '#94a3b8' }} />
                    </div>
                    {(cat.supplier || cat.notes) && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">
                        {[cat.supplier ? `المورد: ${cat.supplier}` : null, cat.notes].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${!catFilter ? 'bg-[#15803D] border-[#1d1d1f] text-white dark:bg-[#f97316] dark:border-[#f97316]' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
              الكل
            </button>
            {categories.map(c => {
              const dbCat = categoryRows.find(cr => cr.name === c);
              const selected = catFilter === c;
              const colorStyle = selected ? selectedCategoryStyle(dbCat?.color) : undefined;
              return (
                <button key={c} onClick={() => setCatFilter(catFilter === c ? null : c)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                    colorStyle
                      ? 'text-black'
                      : selected
                        ? 'bg-[#15803D] border-[#1d1d1f] text-white dark:bg-[#f97316] dark:border-[#f97316]'
                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'
                  }`}
                  style={colorStyle}>
                  {c}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center mt-20">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-gray-400 dark:text-slate-500">{items.length === 0 ? 'لا توجد مواد بعد — أضف مادة من تبويب «إضافة»' : 'لا توجد نتائج'}</p>
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
                          className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold text-xs px-3 py-2 rounded-xl active:scale-95 transition-all">
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
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${!movCatFilter ? 'bg-[#15803D] border-[#1d1d1f] text-white dark:bg-[#f97316] dark:border-[#f97316]' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                الكل
              </button>
              {movementCategories.map(c => (
                <button key={c} onClick={() => setMovCatFilter(movCatFilter === c ? null : c)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${movCatFilter === c ? 'bg-[#15803D] border-[#1d1d1f] text-white dark:bg-[#f97316] dark:border-[#f97316]' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl max-h-[96dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-700">
              <button onClick={saveItem} disabled={saving || !form.name.trim()} className="bg-[#15803D] disabled:opacity-40 text-white font-bold px-4 py-2 rounded-xl active:scale-95 transition-all text-sm">
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
                {formCategories.map(c => {
                  const dbCat = categoryRows.find(cr => cr.name === c);
                  const selected = form.category === c;
                  const colorStyle = selected ? selectedCategoryStyle(dbCat?.color) : undefined;
                  return (
                    <button key={c} onClick={() => setForm(p => ({ ...p, category: c }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border active:scale-95 transition-all ${
                        colorStyle
                          ? 'text-black'
                          : selected
                            ? 'bg-[#15803D] border-[#15803D] text-white dark:bg-[#15803D] dark:border-[#15803D]'
                            : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'
                      }`}
                      style={colorStyle}>
                      {c}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">وحدة القياس</p>
              <div className="flex gap-1.5 flex-wrap mb-3 justify-end">
                {UNITS.map(u => (
                  <button key={u} onClick={() => setForm(p => ({ ...p, unit: u }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border active:scale-95 transition-all ${form.unit === u ? 'bg-gray-600 dark:bg-slate-500 border-gray-600 dark:border-slate-500 text-white' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
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
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">كمية إعادة الطلب (اختياري)</p>
                  <input type="number" value={form.reorder_quantity} onChange={e => setForm(p => ({ ...p, reorder_quantity: e.target.value }))} placeholder="0" dir="rtl"
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">سعر الشراء (د.ع)</p>
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
              <p className="text-sm text-gray-500 dark:text-slate-400 font-bold text-right mb-4">{movementTarget.name} — {movementTarget.current_stock} {movementTarget.unit}</p>

              {/* نوع الحركة */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['IN', 'WASTE', 'ADJUSTMENT', 'RETURN', 'OUT_ORDER'] as MovementType[]).map(t => {
                  const cfg = MOVEMENT_LABELS[t];
                  return (
                    <button key={t} onClick={() => setMovType(t)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${movType === t ? 'bg-[#15803D] border-[#15803D] text-white dark:bg-[#15803D] dark:border-[#15803D]' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300'}`}>
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
                className="w-full bg-gray-100 dark:bg-slate-700 disabled:opacity-40 text-gray-600 dark:text-slate-400 font-bold py-4 rounded-2xl text-base active:scale-95 transition-all mb-6">
                {movSaving ? 'جاري الحفظ...' : 'تسجيل الحركة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ موديل تسجيل شراء ═══ */}
      {showPurchaseForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowPurchaseForm(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-6 pb-2">
              <p className="font-bold text-gray-900 dark:text-slate-100 text-right text-base mb-4">🛒 تسجيل عملية شراء</p>

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">فلترة حسب الفئة</p>
              <div className="flex gap-1.5 flex-wrap mb-3 justify-end">
                <button onClick={() => selectPurchaseCatFilter(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${!purchaseCatFilter ? 'bg-[#15803D] border-[#15803D] text-white dark:bg-[#15803D] dark:border-[#15803D]' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                  الكل
                </button>
                {categories.map(c => {
                  const dbCat = categoryRows.find(cr => cr.name === c);
                  const hasColor = !!dbCat?.color;
                  return (
                    <button key={c} onClick={() => selectPurchaseCatFilter(purchaseCatFilter === c ? null : c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                        hasColor
                          ? 'text-black'
                          : purchaseCatFilter === c
                            ? 'bg-[#15803D] border-[#15803D] text-white dark:bg-[#15803D] dark:border-[#15803D]'
                            : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'
                      }`}
                      style={hasColor ? { backgroundColor: hexToRgba(dbCat!.color as string, purchaseCatFilter === c ? 1 : 0.55), borderColor: dbCat!.color as string } : undefined}>
                      {c}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">المادة</p>
              <select value={purchaseItemId} onChange={e => selectPurchaseItem(e.target.value)} dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-3">
                <option value="">اختر مادة...</option>
                {[...purchaseFilteredItems].sort((a, b) => a.name.localeCompare(b.name, 'ar')).map(it => (
                  <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>
                ))}
              </select>

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">
                الكمية المشتراة {selectedPurchaseItem ? `(${selectedPurchaseItem.unit})` : ''}
                {selectedPurchaseItem?.reorder_quantity ? <span className="text-[#15803D]"> — مقترحة حسب كمية إعادة الطلب</span> : ''}
              </p>
              <input type="number" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} placeholder="0" dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-3" />

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">
                سعر الشراء (د.ع) {selectedPurchaseItem ? `— لكل ${selectedPurchaseItem.unit}` : ''}
                {selectedPurchaseItem && selectedPurchaseItem.cost_per_unit > 0 ? <span className="text-[#15803D]"> — مقترح حسب آخر سعر</span> : ''}
              </p>
              <input type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="0" dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-3" />

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">ملاحظة (اختياري)</p>
              <input value={purchaseNotes} onChange={e => setPurchaseNotes(e.target.value)} placeholder="مثال: فاتورة المورد رقم..." dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-4" />

              <button onClick={recordPurchase} disabled={purchaseSaving || !purchaseItemId || !purchaseQty || !purchasePrice}
                className="w-full bg-[#15803D] disabled:opacity-40 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-all mb-6">
                {purchaseSaving ? 'جاري الحفظ...' : 'تسجيل الشراء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ موديل إضافة/حذف فئة ═══ */}
      {showCatForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => { setShowCatForm(false); setEditingCat(null); }}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-6">
              <p className="font-bold text-gray-900 dark:text-slate-100 text-right text-base mb-4">{editingCat ? 'تعديل الفئة' : 'فئة جديدة'}</p>

              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="مثال: لحوم، خضار، مشروبات..." dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316] mb-3" />

              <textarea value={newCatNotes} onChange={e => setNewCatNotes(e.target.value)} placeholder="ملاحظات عن الفئة (اختياري)" dir="rtl" rows={2}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316] mb-3 resize-none" />

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">المورد</p>
              <input value={newCatSupplier} onChange={e => setNewCatSupplier(e.target.value)} placeholder="اسم المورد (اختياري)" dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316] mb-3" />

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">لون الفئة</p>
              <div className="flex items-center gap-2 flex-wrap justify-end mb-4">
                {CATEGORY_COLORS.map(c => (
                  <button key={c.hex} type="button" onClick={() => setNewCatColor(c.hex)} title={c.label}
                    className={`w-8 h-8 rounded-full border-2 transition-all active:scale-90 ${newCatColor === c.hex ? 'border-gray-900 dark:border-white scale-110 shadow-md' : 'border-transparent'}`}
                    style={{ backgroundColor: c.hex }} />
                ))}
              </div>

              {editingCat && (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 mb-4">
                  <button type="button" onClick={() => setNewCatActive(v => !v)} dir="ltr"
                    className="w-11 h-6 rounded-full transition-all relative flex-shrink-0"
                    style={{ backgroundColor: newCatActive ? '#22c55e' : '#d1d5db' }}>
                    <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ right: newCatActive ? '2px' : '22px' }} />
                  </button>
                  <span className="text-sm font-bold text-gray-700 dark:text-slate-200">{newCatActive ? 'الفئة مفعّلة' : 'الفئة معطّلة'}</span>
                </div>
              )}

              <button onClick={saveCategory} disabled={catSaving || !newCatName.trim()}
                className="w-full bg-gray-100 dark:bg-slate-700 disabled:opacity-40 text-gray-600 dark:text-slate-400 font-bold py-4 rounded-2xl text-base active:scale-95 transition-all mb-6">
                {catSaving ? 'جاري الحفظ...' : editingCat ? 'حفظ التعديلات' : 'إضافة الفئة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ موديل ترتيب الفئات ═══ */}
      {showCatReorder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowCatReorder(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-700">
              <button onClick={saveCatReorder} disabled={catReorderSaving} className="bg-[#f97316] text-white font-bold px-4 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-60">
                {catReorderSaving ? '...' : 'حفظ'}
              </button>
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">ترتيب الفئات</h3>
              <button onClick={() => setShowCatReorder(false)} className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold px-4 py-2 rounded-xl active:scale-95 transition-all">إلغاء</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-2">
              {reorderCatRows.map((cat, i) => (
                <div key={cat.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 border border-gray-200 dark:border-slate-600">
                  <div className="flex gap-1.5">
                    <button onClick={() => moveCatRow(i, -1)} disabled={i === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 text-gray-500 dark:text-slate-300 disabled:opacity-25 active:scale-90 transition-all">
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => moveCatRow(i, 1)} disabled={i === reorderCatRows.length - 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 text-gray-500 dark:text-slate-300 disabled:opacity-25 active:scale-90 transition-all">
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-slate-100">{cat.name}</span>
                    {cat.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-500 w-5 text-center">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ موديل شجرة المكونات ═══ */}
      {showRecipeTree && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowRecipeTree(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-700">
              {treeMaterial ? (
                <button onClick={() => setTreeMaterial(null)} className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold px-3 py-2 rounded-xl text-sm active:scale-95 transition-all">
                  <ChevronRight size={16} /> رجوع
                </button>
              ) : <span className="w-[74px]" />}
              <h3 className="font-bold text-gray-900 dark:text-slate-100">🌳 شجرة المكونات</h3>
              <button onClick={() => setShowRecipeTree(false)} className="bg-gray-100 dark:bg-slate-700 text-gray-500 px-3 py-2 rounded-xl text-sm font-bold active:scale-95 transition-all">إغلاق</button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5">
              {!treeMaterial ? (
                <>
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-3">اختر مادة لتحديد الوجبات المصنوعة منها، وكم وجبة تكفيها الوحدة الواحدة — بدل تقدير الغرامات يدوياً.</p>
                  <div className="relative mb-3">
                    <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400" />
                    <input value={treeSearch} onChange={e => setTreeSearch(e.target.value)} placeholder="ابحث عن مادة..." dir="rtl"
                      className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl py-3 pr-10 pl-4 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316]" />
                  </div>
                  {treeFilteredItems.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-right">لا توجد مواد مطابقة.</p>
                  ) : (
                    <div className="space-y-2">
                      {treeFilteredItems.map(mat => (
                        <button key={mat.id} onClick={() => openTreeMaterial(mat)}
                          className="w-full flex items-center justify-between bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 border border-gray-200 dark:border-slate-600 active:scale-95 transition-all">
                          <ChevronRight size={16} className="text-gray-400 rotate-180 flex-shrink-0" />
                          <div className="text-right flex-1 mr-3">
                            <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{mat.name}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">{mat.unit}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="font-bold text-[#15803D] text-right mb-1">{treeMaterial.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-4">وحدة المخزون: {treeMaterial.unit}</p>

                  {treeLoading ? (
                    <div className="flex justify-center py-6"><div className="w-8 h-8 border-4 border-[#15803D] border-t-transparent rounded-full animate-spin" /></div>
                  ) : (
                    <>
                      {treeLinks.length === 0 && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">هذه المادة غير مرتبطة بأي وجبة بعد.</p>
                      )}
                      {treeLinks.map(l => {
                        const servings = l.quantity_required > 0 ? Math.round(1 / l.quantity_required) : 0;
                        return (
                          <div key={l.id} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 mb-2 border border-gray-200 dark:border-slate-600">
                            <button onClick={() => removeTreeLink(l.id)} className="text-red-400 active:scale-90"><Trash2 size={14} /></button>
                            <div className="text-right flex-1 mr-3">
                              <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{dishName(l.menu_item_id)}</p>
                              <p className="text-xs text-gray-400 dark:text-slate-500">1 {l.unit || treeMaterial.unit} تكفي ≈ {servings} وجبة</p>
                            </div>
                          </div>
                        );
                      })}

                      {treeAvailableDishes.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-slate-500 text-right mt-2">
                          {menuItems.length === 0 ? 'أضف وجبات بالمنيو أولاً حتى تقدر تربطها.' : 'كل الوجبات مرتبطة بهذه المادة بالفعل.'}
                        </p>
                      ) : (
                        <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3 border border-dashed border-gray-300 dark:border-slate-600 mt-2">
                          <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">ربط وجبة جديدة</p>
                          <select value={treeDishId} onChange={e => setTreeDishId(e.target.value)} dir="rtl" className={`${input} mb-2`}>
                            <option value="">اختر وجبة</option>
                            {treeAvailableDishes.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">
                            1 {treeMaterial.unit} تكفي كم وجبة؟
                          </p>
                          <div className="flex gap-2">
                            <input value={treeYield} onChange={e => setTreeYield(e.target.value)} placeholder="مثال: 4" type="number" min="1" className={`${input} flex-1 mb-0`} />
                            <button onClick={addTreeLink} disabled={treeSaving || !treeDishId || !treeYield}
                              className="bg-[#15803D] disabled:opacity-40 text-white font-bold px-4 rounded-xl active:scale-95 transition-all">
                              {treeSaving ? '...' : <Plus size={18} />}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!isModalOpen && <AdminBottomNav />}
    </div>
  );
}
