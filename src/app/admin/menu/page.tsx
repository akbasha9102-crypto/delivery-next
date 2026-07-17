'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminBottomNav } from '@/components/layout/BottomNav';
import { BrandMark } from '@/components/shared/BrandMark';
import { X, Plus, Pencil, Trash2, Search, ArrowUp, ArrowDown, ArrowUpDown, SlidersHorizontal, FolderPlus, UtensilsCrossed } from 'lucide-react';
import { useRestaurant } from '@/context/RestaurantContext';
import { HexColorPicker } from 'react-colorful';
import { compatibleUnits } from '@/lib/utils/unitConversion';

type Category = { id: string; name: string; color?: string; card_color?: string; color_dark?: string; card_color_dark?: string; sort_order?: number | null };
type Extra = { id: string; name: string; price: number };
type Item = { id: string; category_id: string; name: string; description: string; price: number; image_url: string; is_available: boolean; item_status?: string; extras_json?: string; images_json?: string };
type InventoryItem = { id: string; name: string; unit: string; current_stock: number };
type Recipe = { id: string; menu_item_id: string; inventory_item_id: string; quantity_required: number; unit: string | null };

const ITEM_STATUSES = [
  { value: 'available',   label: 'متوفر',            color: 'bg-green-500 text-white border-green-500' },
  { value: 'unavailable', label: 'غير متوفر حاليا', color: 'bg-amber-500 text-white border-amber-500' },
  { value: 'hidden',      label: 'انتهى',            color: 'bg-red-500 text-white border-red-500' },
] as const;

function getItemStatus(item: Item) {
  return item.item_status || (item.is_available ? 'available' : 'hidden');
}

function getItemImages(item: Item): string[] {
  let arr: string[] = [];
  try { arr = JSON.parse(item.images_json || '[]'); } catch { arr = []; }
  const cleaned = arr.filter((u): u is string => typeof u === 'string' && u.trim() !== '');
  if (cleaned.length > 0) return cleaned.slice(0, MAX_ITEM_IMAGES);
  return item.image_url ? [item.image_url] : [];
}

const DEFAULT_IMAGE = 'https://via.placeholder.com/300x200.png?text=Food';
const MAX_ITEM_IMAGES = 3;

const getTextColor = (hex: string): string => {
  const h = (hex || '#000000').replace('#', '');
  if (h.length !== 6) return '#ffffff';
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? '#000000' : '#ffffff';
};

export default function MenuPage() {
  const { dark } = useDarkMode();
  const { restaurantId } = useRestaurant();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('list');
  const [newCat, setNewCat] = useState('');
  const [newCatColor, setNewCatColor] = useState('#e67e22');
  const [form, setForm] = useState({ category_id: '', name: '', description: '', price: '' });
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editForm, setEditForm] = useState({ category_id: '', name: '', description: '', price: '' });
  const [newItemImages, setNewItemImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [extras, setExtras] = useState<Extra[]>([]);
  const [extraName, setExtraName] = useState('');
  const [extraPrice, setExtraPrice] = useState('');
  const [newItemExtras, setNewItemExtras] = useState<Extra[]>([]);
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraPrice, setNewExtraPrice] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [showReorder, setShowReorder] = useState(false);
  const [reorderCats, setReorderCats] = useState<Category[]>([]);
  const [editCatSheet, setEditCatSheet] = useState<{ catId: string } | null>(null);
  const [editCatAnimateIn, setEditCatAnimateIn] = useState(false);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColors, setEditCatColors] = useState<{ color: string; card_color: string; color_dark: string; card_color_dark: string } | null>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<'color' | 'card_color' | 'color_dark' | 'card_color_dark' | null>(null);
  const [colorPickerPos, setColorPickerPos] = useState({ top: 0, left: 0 });
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [previewDark, setPreviewDark] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeInvId, setRecipeInvId] = useState('');
  const [recipeQty, setRecipeQty] = useState('');
  const [recipeUnit, setRecipeUnit] = useState('');
  const [newItemRecipes, setNewItemRecipes] = useState<{ tempId: string; inventory_item_id: string; quantity_required: number; unit: string }[]>([]);
  const [newRecipeInvId, setNewRecipeInvId] = useState('');
  const [newRecipeQty, setNewRecipeQty] = useState('');
  const [newRecipeUnit, setNewRecipeUnit] = useState('');
  const [showAddCatSheet, setShowAddCatSheet] = useState(false);
  const [showAddItemSheet, setShowAddItemSheet] = useState(false);

  const fetchMenu = async (seedIfEmpty = true) => {
    // لا نجلب أي شيء حتى يُحدَّد restaurant_id — يمنع تسريب بيانات مطاعم أخرى
    if (!restaurantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const catsQ = supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('sort_order', { ascending: true, nullsFirst: false });
      const itsQ  = supabase.from('items').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false });

      const { data: cats, error: catsError } = await catsQ;
      if (catsError) throw catsError;

      // الأقسام فارغة وهذه أول محاولة → نُدرج البيانات الافتراضية مرة واحدة فقط
      if (!cats?.length && seedIfEmpty) {
        const { error: insertError } = await supabase
          .from('categories')
          .insert([
            { name: 'وجبات سريعة', restaurant_id: restaurantId },
            { name: 'مشروبات',     restaurant_id: restaurantId },
            { name: 'حلويات',      restaurant_id: restaurantId },
          ]);
        if (insertError) {
          console.error('خطأ في إدراج الأقسام الافتراضية:', insertError.message);
          setCategories([]);
        } else {
          return fetchMenu(false);
        }
      } else {
        setCategories(cats || []);
      }

      const { data: its, error: itemsError } = await itsQ;
      if (itemsError) throw itemsError;
      setItems(its || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('fetchMenu error:', msg);
      showToast('تعذّر تحميل القائمة — ' + msg, false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMenu(); }, [restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!restaurantId) return;
    supabase.from('inventory_items').select('id, name, unit, current_stock').eq('restaurant_id', restaurantId).eq('is_active', true).order('name')
      .then(({ data }) => setInventoryItems(data || []));
  }, [restaurantId]);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('categories').insert([{
      name: newCat.trim(),
      color: newCatColor,
      restaurant_id: restaurantId,
    }]);
    error ? showToast('تعذّر إضافة القسم', false) : (setNewCat(''), setShowAddCatSheet(false), fetchMenu(), showToast('✓ تم إضافة القسم'));
    setSaving(false);
  };

  const saveCatColors = async () => {
    if (!editCatSheet || !editCatColors) return;
    const id = editCatSheet.catId;
    const prevCat = categories.find(c => c.id === id);
    setSaving(true);
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...editCatColors } : c));
    const { error } = await supabase.from('categories').update(editCatColors).eq('id', id);
    setSaving(false);
    if (error) {
      if (prevCat) setCategories(prev => prev.map(c => c.id === id ? prevCat : c));
      showToast('تعذّر حفظ الألوان', false);
      return;
    }
    showToast('✓ تم حفظ الألوان');
  };

  const deleteCategory = async (cat: Category) => {
    const itemCount = items.filter(i => i.category_id === cat.id).length;
    const msg = itemCount > 0
      ? `هل أنت متأكد من حذف قسم "${cat.name}"؟\nسيتم حذف ${itemCount} طبق داخله أيضاً.`
      : `هل أنت متأكد من حذف قسم "${cat.name}"؟`;
    if (!confirm(msg)) return;
    setSaving(true);
    if (itemCount > 0) {
      const { error: itemsErr } = await supabase.from('items').delete().eq('category_id', cat.id);
      if (itemsErr) { showToast('تعذّر حذف أطباق القسم', false); setSaving(false); return; }
    }
    const { error: catErr } = await supabase.from('categories').delete().eq('id', cat.id);
    if (catErr) { showToast('تعذّر حذف القسم', false); setSaving(false); return; }
    if (selectedCat === cat.id) setSelectedCat(null);
    await fetchMenu();
    showToast('✓ تم حذف القسم');
    setSaving(false);
  };

  const addItem = async () => {
    if (!form.category_id || !form.name.trim() || !form.price.trim()) return alert('الرجاء ملء الحقول المطلوبة');
    const price = parseFloat(form.price.replace(',', '.'));
    if (isNaN(price) || price <= 0) return alert('سعر غير صالح');
    setSaving(true);
    const images = newItemImages.map(u => u.trim()).filter(Boolean).slice(0, MAX_ITEM_IMAGES);
    const primaryImage = images[0] || DEFAULT_IMAGE;
    const { data, error } = await supabase.from('items').insert([{
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      image_url: primaryImage,
      images_json: JSON.stringify(images.length ? images : [primaryImage]),
      is_available: true,
      restaurant_id: restaurantId,
      extras_json: JSON.stringify(newItemExtras),
    }]).select().single();
    if (error) { showToast('تعذّر إضافة الطبق', false); setSaving(false); return; }
    if (newItemRecipes.length > 0) {
      const { error: recErr } = await supabase.from('menu_recipes').insert(
        newItemRecipes.map(r => ({ menu_item_id: data.id, inventory_item_id: r.inventory_item_id, quantity_required: r.quantity_required, unit: r.unit }))
      );
      if (recErr) showToast('تم إضافة الطبق لكن تعذّر ربط بعض المكونات', false);
    }
    setForm({ category_id: '', name: '', description: '', price: '' });
    setNewItemExtras([]);
    setNewItemRecipes([]);
    setNewItemImages([]);
    setNewImageUrl('');
    setShowAddItemSheet(false);
    fetchMenu();
    showToast('✓ تم إضافة الطبق');
    setSaving(false);
  };

  const addNewItemImage = () => {
    const url = newImageUrl.trim();
    if (!url || newItemImages.length >= MAX_ITEM_IMAGES) return;
    setNewItemImages(prev => [...prev, url]);
    setNewImageUrl('');
  };
  const removeNewItemImage = (idx: number) => setNewItemImages(prev => prev.filter((_, i) => i !== idx));

  const addEditImage = () => {
    const url = editImageUrl.trim();
    if (!url || editImages.length >= MAX_ITEM_IMAGES) return;
    setEditImages(prev => [...prev, url]);
    setEditImageUrl('');
  };
  const removeEditImage = (idx: number) => setEditImages(prev => prev.filter((_, i) => i !== idx));

  const addNewItemRecipe = () => {
    if (!newRecipeInvId) return;
    const qty = parseFloat(newRecipeQty.replace(',', '.')) || 1;
    const inv = inventoryItems.find(i => i.id === newRecipeInvId);
    const unit = newRecipeUnit || inv?.unit || '';
    setNewItemRecipes(prev => [...prev, { tempId: Date.now().toString(), inventory_item_id: newRecipeInvId, quantity_required: qty, unit }]);
    setNewRecipeInvId(''); setNewRecipeQty(''); setNewRecipeUnit('');
  };

  const openEdit = (item: Item) => {
    setEditItem(item);
    setEditForm({ category_id: item.category_id, name: item.name, description: item.description || '', price: String(item.price) });
    setEditImages(getItemImages(item));
    setEditImageUrl('');
    try { setExtras(JSON.parse(item.extras_json || '[]')); } catch { setExtras([]); }
    setExtraName(''); setExtraPrice('');
    setRecipes([]);
    setRecipeInvId(''); setRecipeQty(''); setRecipeUnit('');
    supabase.from('menu_recipes').select('*').eq('menu_item_id', item.id)
      .then(({ data }) => setRecipes(data || []));
  };

  const addRecipe = async () => {
    if (!editItem || !recipeInvId) return;
    const qty = parseFloat(recipeQty.replace(',', '.')) || 1;
    const inv = inventoryItems.find(i => i.id === recipeInvId);
    const unit = recipeUnit || inv?.unit || '';
    const { data, error } = await supabase.from('menu_recipes')
      .insert([{ menu_item_id: editItem.id, inventory_item_id: recipeInvId, quantity_required: qty, unit }])
      .select().single();
    if (error) { showToast('تعذّر إضافة المكوّن', false); return; }
    setRecipes(prev => [...prev, data]);
    setRecipeInvId(''); setRecipeQty(''); setRecipeUnit('');
  };

  const removeRecipe = async (id: string) => {
    await supabase.from('menu_recipes').delete().eq('id', id);
    setRecipes(prev => prev.filter(r => r.id !== id));
  };

  useEffect(() => {
    if (!editItem) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [editItem]);

  useEffect(() => {
    if (!showAddCatSheet && !showAddItemSheet) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [showAddCatSheet, showAddItemSheet]);

  const saveEdit = async () => {
    if (!editItem || !editForm.name.trim() || !editForm.price.trim()) return;
    const price = parseFloat(editForm.price.replace(',', '.'));
    if (isNaN(price) || price <= 0) return alert('سعر غير صالح');
    setSaving(true);
    const images = editImages.map(u => u.trim()).filter(Boolean).slice(0, MAX_ITEM_IMAGES);
    const primaryImage = images[0] || DEFAULT_IMAGE;
    const { error } = await supabase.from('items').update({ ...editForm, name: editForm.name.trim(), description: editForm.description.trim(), price, image_url: primaryImage, images_json: JSON.stringify(images.length ? images : [primaryImage]) }).eq('id', editItem.id);
    error ? showToast('تعذّر الحفظ', false) : (fetchMenu(), setEditItem(null), showToast('✓ تم الحفظ'));
    setSaving(false);
  };

  const saveExtras = async (updated: Extra[]) => {
    if (!editItem) return;
    await supabase.from('items').update({ extras_json: JSON.stringify(updated) }).eq('id', editItem.id);
    setExtras(updated);
  };

  const addExtra = async () => {
    if (!extraName.trim()) return;
    const price = parseFloat(extraPrice.replace(',', '.')) || 0;
    await saveExtras([...extras, { id: Date.now().toString(), name: extraName.trim(), price }]);
    setExtraName(''); setExtraPrice('');
  };

  const setItemStatus = async (item: Item, status: string) => {
    const is_available = status === 'available';
    await supabase.from('items').update({ item_status: status, is_available }).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, item_status: status, is_available } : i));
  };

  const deleteItem = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    await supabase.from('items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
    showToast('✓ تم الحذف');
  };

  const openReorder = () => {
    setReorderCats([...categories]);
    setShowReorder(true);
  };

  const moveCategory = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= reorderCats.length) return;
    setReorderCats(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const saveReorder = async () => {
    setSaving(true);
    await Promise.all(
      reorderCats.map((cat, i) =>
        supabase.from('categories').update({ sort_order: i }).eq('id', cat.id)
      )
    );
    await fetchMenu();
    setShowReorder(false);
    setSaving(false);
    showToast('✓ تم حفظ الترتيب');
  };

  useEffect(() => {
    if (editCatSheet) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const top = parseInt(document.body.style.top || '0', 10);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, -top);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [editCatSheet]);

  useEffect(() => {
    if (!activeColorPicker) return;
    const handler = (e: PointerEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setActiveColorPicker(null);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [activeColorPicker]);

  const openColorPicker = (field: 'color' | 'card_color' | 'color_dark' | 'card_color_dark', e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeColorPicker === field) { setActiveColorPicker(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pickerW = 220;
    const pickerH = 260;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - pickerW - 8));
    const above = rect.bottom + pickerH > window.innerHeight - 20;
    const top = above ? rect.top - pickerH - 6 : rect.bottom + 6;
    setColorPickerPos({ top, left });
    setActiveColorPicker(field);
  };

  const openCatEdit = (cat: Category) => {
    setEditCatName(cat.name);
    setEditCatColors({
      color: cat.color || '#e67e22',
      card_color: cat.card_color || '#ffffff',
      color_dark: cat.color_dark || cat.color || '#e67e22',
      card_color_dark: cat.card_color_dark || '#1e293b',
    });
    setEditCatSheet({ catId: cat.id });
    requestAnimationFrame(() => setEditCatAnimateIn(true));
  };

  const closeCatEdit = () => {
    setEditCatAnimateIn(false);
    setTimeout(() => { setEditCatSheet(null); setEditCatColors(null); }, 300);
  };

  const saveCatName = async () => {
    if (!editCatSheet || !editCatName.trim()) return;
    const id = editCatSheet.catId;
    setSaving(true);
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editCatName.trim() } : c));
    await supabase.from('categories').update({ name: editCatName.trim() }).eq('id', id);
    setSaving(false);
    showToast('✓ تم حفظ القسم');
  };

  const input = `w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316] mb-3`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 md:pb-0 md:mr-[70px]">
      {/* Add Category Modal */}
      {showAddCatSheet && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center pb-10">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-700">
              <button onClick={addCategory} disabled={saving || !newCat.trim()} className="bg-black text-white font-bold px-4 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-60">
                {saving ? '...' : 'حفظ'}
              </button>
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">➕ قسم جديد</h3>
              <button onClick={() => setShowAddCatSheet(false)} className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold px-4 py-2 rounded-xl active:scale-95 transition-all">إلغاء</button>
            </div>
            <div className="overflow-y-auto overscroll-contain p-5">
              <p className="text-gray-400 dark:text-slate-500 text-xs text-right mb-1">اسم القسم</p>
              <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="اسم القسم" dir="rtl" className={input} />
              <div className="flex items-center justify-end gap-3 mb-3">
                <span className="text-sm text-gray-400 dark:text-slate-500">لون القسم</span>
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                  className="w-9 h-9 rounded-xl cursor-pointer border border-gray-200 dark:border-slate-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemSheet && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center pb-10">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-700">
              <button onClick={addItem} disabled={saving} className="bg-black text-white font-bold px-4 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-60">
                {saving ? '...' : 'حفظ'}
              </button>
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">🍽️ طبق جديد</h3>
              <button onClick={() => setShowAddItemSheet(false)} className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold px-4 py-2 rounded-xl active:scale-95 transition-all">إلغاء</button>
            </div>
            <div className="overflow-y-auto overscroll-contain p-5">
              <p className="text-gray-400 dark:text-slate-500 text-xs text-right mb-2">اختر القسم</p>
              <div className="flex gap-2 overflow-x-auto mb-4 flex-row-reverse">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setForm(p => ({ ...p, category_id: cat.id }))}
                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border active:scale-95 transition-all ${form.category_id === cat.id ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-gray-100 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
                    {cat.name}
                  </button>
                ))}
              </div>
              {[
                { key: 'name', placeholder: 'اسم الطبق *' },
                { key: 'description', placeholder: 'وصف الطبق' },
                { key: 'price', placeholder: 'السعر * (د.ع)', type: 'number' },
              ].map(({ key, placeholder, type }) => (
                <input key={key} type={type || 'text'} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} dir="rtl" className={input} />
              ))}

              <div className="mb-2">
                <p className="text-gray-400 dark:text-slate-500 text-xs text-right mb-2">صور الطبق (حتى {MAX_ITEM_IMAGES})</p>
                {newItemImages.map((url, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 mb-2 border border-gray-200 dark:border-slate-600">
                    <button onClick={() => removeNewItemImage(idx)} className="text-red-400 active:scale-90"><Trash2 size={14} /></button>
                    <p dir="ltr" className="text-right flex-1 mr-3 text-xs text-gray-600 dark:text-slate-300 truncate">{idx === 0 ? '⭐ ' : ''}{url}</p>
                  </div>
                ))}
                {newItemImages.length < MAX_ITEM_IMAGES && (
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3 border border-dashed border-gray-300 dark:border-slate-600">
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">إضافة رابط صورة</p>
                    <div className="flex gap-2">
                      <input value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder="رابط الصورة" dir="rtl" className={`${input} flex-1 mb-0`} />
                      <button onClick={addNewItemImage} disabled={!newImageUrl.trim()} className="bg-[#f97316] disabled:opacity-40 text-white font-bold px-4 rounded-xl active:scale-95 transition-all"><Plus size={18} /></button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-slate-700 pt-4 mt-2">
                <h4 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-3">🧂 الإضافات</h4>
                {newItemExtras.map(e => (
                  <div key={e.id} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 mb-2 border border-gray-200 dark:border-slate-600">
                    <button onClick={() => setNewItemExtras(newItemExtras.filter(x => x.id !== e.id))} className="text-red-400 active:scale-90"><Trash2 size={14} /></button>
                    <div className="text-right flex-1 mr-3">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{e.name}</p>
                      <p className={`text-xs ${e.price > 0 ? 'text-[#f97316]' : 'text-gray-400 dark:text-slate-500'}`}>{e.price > 0 ? `+${e.price.toLocaleString()} د.ع` : 'مجاني'}</p>
                    </div>
                  </div>
                ))}
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3 border border-dashed border-gray-300 dark:border-slate-600">
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">إضافة جديدة</p>
                  <input value={newExtraName} onChange={e => setNewExtraName(e.target.value)} placeholder="اسم الإضافة" dir="rtl" className={`${input} mb-2`} />
                  <div className="flex gap-2">
                    <input value={newExtraPrice} onChange={e => setNewExtraPrice(e.target.value)} placeholder="السعر (0=مجاني)" type="number" className={`${input} flex-1 mb-0`} />
                    <button onClick={() => {
                      if (!newExtraName.trim()) return;
                      const price = parseFloat(newExtraPrice.replace(',', '.')) || 0;
                      setNewItemExtras([...newItemExtras, { id: Date.now().toString(), name: newExtraName.trim(), price }]);
                      setNewExtraName(''); setNewExtraPrice('');
                    }} disabled={!newExtraName.trim()} className="bg-[#f97316] disabled:opacity-40 text-white font-bold px-4 rounded-xl active:scale-95 transition-all"><Plus size={18} /></button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-slate-700 pt-4 mt-2">
                <h4 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-3">🧾 إدارة المكونات</h4>
                {newItemRecipes.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">لا توجد مكونات مرتبطة بعد — عند إضافة مكوّن، سيُخصم من المخزون تلقائياً مع كل طلب.</p>
                )}
                {newItemRecipes.map(r => {
                  const inv = inventoryItems.find(i => i.id === r.inventory_item_id);
                  return (
                    <div key={r.tempId} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 mb-2 border border-gray-200 dark:border-slate-600">
                      <button onClick={() => setNewItemRecipes(prev => prev.filter(x => x.tempId !== r.tempId))} className="text-red-400 active:scale-90"><Trash2 size={14} /></button>
                      <div className="text-right flex-1 mr-3">
                        <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{inv?.name || '—'}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{r.quantity_required} {r.unit || inv?.unit || ''} لكل وجبة</p>
                      </div>
                    </div>
                  );
                })}
                {inventoryItems.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right">أضف مواد في المخزون أولاً حتى تقدر تربطها بالوجبة.</p>
                ) : (
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3 border border-dashed border-gray-300 dark:border-slate-600">
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">إضافة مكوّن</p>
                    <select value={newRecipeInvId} onChange={e => {
                      setNewRecipeInvId(e.target.value);
                      setNewRecipeUnit(inventoryItems.find(i => i.id === e.target.value)?.unit || '');
                    }} dir="rtl" className={`${input} mb-2`}>
                      <option value="">اختر مادة من المخزون</option>
                      {inventoryItems.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input value={newRecipeQty} onChange={e => setNewRecipeQty(e.target.value)} placeholder="الكمية لكل وجبة" type="number" className={`${input} flex-1 mb-0`} />
                      <button onClick={addNewItemRecipe} disabled={!newRecipeInvId} className="bg-[#f97316] disabled:opacity-40 text-white font-bold px-4 rounded-xl active:scale-95 transition-all"><Plus size={18} /></button>
                    </div>
                    {(() => {
                      const inv = inventoryItems.find(i => i.id === newRecipeInvId);
                      if (!inv) return null;
                      const opts = compatibleUnits(inv.unit);
                      if (opts.length <= 1) return null;
                      return (
                        <div className="flex gap-1.5 flex-wrap justify-end mt-2">
                          {opts.map(u => (
                            <button key={u} type="button" onClick={() => setNewRecipeUnit(u)}
                              className={`px-3 py-1 rounded-full text-xs font-bold border active:scale-95 transition-all ${newRecipeUnit === u ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                              {u}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center pb-10">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-700">
              <button onClick={saveEdit} disabled={saving} className="bg-black text-white font-bold px-4 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-60">
                {saving ? '...' : 'حفظ'}
              </button>
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">✏️ تعديل الطبق</h3>
              <button onClick={() => setEditItem(null)} className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold px-4 py-2 rounded-xl active:scale-95 transition-all">إلغاء</button>
            </div>
            <div className="overflow-y-auto overscroll-contain p-5">
              <p className="text-gray-400 dark:text-slate-500 text-xs text-right mb-2">القسم</p>
              <div className="flex gap-2 overflow-x-auto mb-4 flex-row-reverse">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setEditForm(p => ({ ...p, category_id: cat.id }))}
                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border active:scale-95 transition-all ${editForm.category_id === cat.id ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-gray-100 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
                    {cat.name}
                  </button>
                ))}
              </div>
              {[
                { label: 'اسم الطبق', key: 'name', placeholder: 'اسم الطبق' },
                { label: 'الوصف', key: 'description', placeholder: 'وصف الطبق' },
                { label: 'السعر (د.ع)', key: 'price', placeholder: 'السعر', type: 'number' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <p className="text-gray-400 dark:text-slate-500 text-xs text-right mb-1">{label}</p>
                  <input type={type || 'text'} value={(editForm as any)[key]} onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} dir="rtl" className={input} />
                </div>
              ))}

              <div className="mb-2">
                <p className="text-gray-400 dark:text-slate-500 text-xs text-right mb-2">صور الطبق (حتى {MAX_ITEM_IMAGES})</p>
                {editImages.map((url, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 mb-2 border border-gray-200 dark:border-slate-600">
                    <button onClick={() => removeEditImage(idx)} className="text-red-400 active:scale-90"><Trash2 size={14} /></button>
                    <p dir="ltr" className="text-right flex-1 mr-3 text-xs text-gray-600 dark:text-slate-300 truncate">{idx === 0 ? '⭐ ' : ''}{url}</p>
                  </div>
                ))}
                {editImages.length < MAX_ITEM_IMAGES && (
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3 border border-dashed border-gray-300 dark:border-slate-600">
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">إضافة رابط صورة</p>
                    <div className="flex gap-2">
                      <input value={editImageUrl} onChange={e => setEditImageUrl(e.target.value)} placeholder="رابط الصورة" dir="rtl" className={`${input} flex-1 mb-0`} />
                      <button onClick={addEditImage} disabled={!editImageUrl.trim()} className="bg-[#f97316] disabled:opacity-40 text-white font-bold px-4 rounded-xl active:scale-95 transition-all"><Plus size={18} /></button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-slate-700 pt-4 mt-2">
                <h4 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-3">🧂 الإضافات</h4>
                {extras.map(e => (
                  <div key={e.id} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 mb-2 border border-gray-200 dark:border-slate-600">
                    <button onClick={() => saveExtras(extras.filter(x => x.id !== e.id))} className="text-red-400 active:scale-90"><Trash2 size={14} /></button>
                    <div className="text-right flex-1 mr-3">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{e.name}</p>
                      <p className={`text-xs ${e.price > 0 ? 'text-[#f97316]' : 'text-gray-400 dark:text-slate-500'}`}>{e.price > 0 ? `+${e.price.toLocaleString()} د.ع` : 'مجاني'}</p>
                    </div>
                  </div>
                ))}
                <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3 border border-dashed border-gray-300 dark:border-slate-600">
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">إضافة جديدة</p>
                  <input value={extraName} onChange={e => setExtraName(e.target.value)} placeholder="اسم الإضافة" dir="rtl" className={`${input} mb-2`} />
                  <div className="flex gap-2">
                    <input value={extraPrice} onChange={e => setExtraPrice(e.target.value)} placeholder="السعر (0=مجاني)" type="number" className={`${input} flex-1 mb-0`} />
                    <button onClick={addExtra} disabled={!extraName.trim()} className="bg-[#f97316] disabled:opacity-40 text-white font-bold px-4 rounded-xl active:scale-95 transition-all"><Plus size={18} /></button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-slate-700 pt-4 mt-2">
                <h4 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-3">🧾 إدارة المكونات</h4>
                {recipes.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">لا توجد مكونات مرتبطة بعد — عند إضافة مكوّن، سيُخصم من المخزون تلقائياً مع كل طلب.</p>
                )}
                {recipes.map(r => {
                  const inv = inventoryItems.find(i => i.id === r.inventory_item_id);
                  return (
                    <div key={r.id} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 mb-2 border border-gray-200 dark:border-slate-600">
                      <button onClick={() => removeRecipe(r.id)} className="text-red-400 active:scale-90"><Trash2 size={14} /></button>
                      <div className="text-right flex-1 mr-3">
                        <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{inv?.name || '—'}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{r.quantity_required} {r.unit || inv?.unit || ''} لكل وجبة</p>
                      </div>
                    </div>
                  );
                })}
                {inventoryItems.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right">أضف مواد في المخزون أولاً حتى تقدر تربطها بالوجبة.</p>
                ) : (
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3 border border-dashed border-gray-300 dark:border-slate-600">
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2">إضافة مكوّن</p>
                    <select value={recipeInvId} onChange={e => {
                      setRecipeInvId(e.target.value);
                      setRecipeUnit(inventoryItems.find(i => i.id === e.target.value)?.unit || '');
                    }} dir="rtl" className={`${input} mb-2`}>
                      <option value="">اختر مادة من المخزون</option>
                      {inventoryItems.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input value={recipeQty} onChange={e => setRecipeQty(e.target.value)} placeholder="الكمية لكل وجبة" type="number" className={`${input} flex-1 mb-0`} />
                      <button onClick={addRecipe} disabled={!recipeInvId} className="bg-[#f97316] disabled:opacity-40 text-white font-bold px-4 rounded-xl active:scale-95 transition-all"><Plus size={18} /></button>
                    </div>
                    {(() => {
                      const inv = inventoryItems.find(i => i.id === recipeInvId);
                      if (!inv) return null;
                      const opts = compatibleUnits(inv.unit);
                      if (opts.length <= 1) return null;
                      return (
                        <div className="flex gap-1.5 flex-wrap justify-end mt-2">
                          {opts.map(u => (
                            <button key={u} type="button" onClick={() => setRecipeUnit(u)}
                              className={`px-3 py-1 rounded-full text-xs font-bold border active:scale-95 transition-all ${recipeUnit === u ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                              {u}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reorder Modal */}
      {showReorder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl max-h-[88vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-700">
              <button onClick={saveReorder} disabled={saving} className="bg-black text-white font-bold px-4 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-60">
                {saving ? '...' : 'حفظ'}
              </button>
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">ترتيب الأقسام</h3>
              <button onClick={() => setShowReorder(false)} className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold px-4 py-2 rounded-xl active:scale-95 transition-all">إلغاء</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-2">
              {reorderCats.map((cat, i) => (
                <div key={cat.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 border border-gray-200 dark:border-slate-600">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => moveCategory(i, -1)}
                      disabled={i === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 text-gray-500 dark:text-slate-300 disabled:opacity-25 active:scale-90 transition-all">
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moveCategory(i, 1)}
                      disabled={i === reorderCats.length - 1}
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

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 flex items-center justify-between stagger-0">
        <div className="w-9" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">تعديل المنيو</h1>
        <BrandMark />
      </header>

      {toast && (
        <div className={`mx-4 mt-3 px-4 py-3 rounded-xl border text-center font-bold text-sm ${toast.ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tabs — القائمة يمين، إضافة يسار (RTL) */}
      <div className="flex mx-4 mt-4 mb-4 bg-gray-100 dark:bg-slate-800 rounded-2xl p-1 stagger-1">
        <button onClick={() => setActiveTab('list')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${activeTab === 'list' ? 'bg-[#f97316] text-white' : 'text-gray-500 dark:text-slate-400'}`}>القائمة ({items.length})</button>
        <button onClick={() => setActiveTab('add')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${activeTab === 'add' ? 'bg-[#f97316] text-white' : 'text-gray-500 dark:text-slate-400'}`}>إضافة</button>
      </div>

      <div className="px-4 stagger-2">
        {loading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
        ) : activeTab === 'add' ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowAddCatSheet(true)}
              className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 active:scale-95 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                <FolderPlus size={26} className="text-[#f97316]" />
              </div>
              <div className="text-right flex-1">
                <p className="font-bold text-gray-900 dark:text-slate-100">إضافة قسم جديد</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">أنشئ قسماً جديداً في المنيو</p>
              </div>
            </button>

            <button
              onClick={() => setShowAddItemSheet(true)}
              className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 active:scale-95 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                <UtensilsCrossed size={26} className="text-[#f97316]" />
              </div>
              <div className="text-right flex-1">
                <p className="font-bold text-gray-900 dark:text-slate-100">إضافة وجبة جديدة</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">أضف طبقاً جديداً لأحد الأقسام</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-6 pb-8">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400 dark:text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث عن وجبة..."
                dir="rtl"
                className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl py-3 pr-10 pl-4 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Category filter chips */}
            <div className="space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedCat(null)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border transition-all active:scale-95 ${!selectedCat ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                  الكل ({items.length})
                </button>
                {categories.map(cat => {
                  const count = items.filter(i => i.category_id === cat.id).length;
                  const active = selectedCat === cat.id;
                  return (
                    <div key={cat.id} className="flex-shrink-0 flex items-center gap-1">
                      <button
                        onClick={() => setSelectedCat(active ? null : cat.id)}
                        className={`px-4 py-2 rounded-full text-sm font-bold border transition-all active:scale-95 ${active ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                        {cat.name} ({count})
                      </button>
                      <button
                        onClick={() => deleteCategory(cat)}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-400 active:scale-90 transition-all"
                        title="حذف القسم">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={openReorder}
                  className="flex items-center p-1.5 rounded-xl bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 active:scale-95 transition-all">
                  <div className="relative w-4 h-4 rounded-full border border-gray-500 dark:border-slate-400 flex items-center justify-center">
                    <ArrowUp size={8} className="absolute top-0.5 text-gray-500 dark:text-slate-400" />
                    <ArrowDown size={8} className="absolute bottom-0.5 text-gray-500 dark:text-slate-400" />
                  </div>

                </button>
              </div>
            </div>

            {search && (
              <p className="text-sm text-gray-400 dark:text-slate-500 text-right">
                {items.filter(i => i.name.includes(search) || i.description?.includes(search)).length} نتيجة لـ &quot;{search}&quot;
              </p>
            )}

            {categories.map(cat => {
              const catItems = items.filter(i =>
                i.category_id === cat.id &&
                (!search || i.name.includes(search) || i.description?.includes(search)) &&
                (!selectedCat || i.category_id === selectedCat)
              );
              if (catItems.length === 0) return null;
              const collapsed = collapsedCats.has(cat.id);
              const toggleCollapse = () => setCollapsedCats(prev => {
                const next = new Set(prev);
                next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                return next;
              });
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-end gap-2 mb-3">
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">{cat.name}</h3>
                    <span className="bg-orange-100 dark:bg-orange-900/20 text-[#f97316] text-xs font-bold px-2.5 py-0.5 rounded-full border border-orange-200 dark:border-orange-800">{catItems.length}</span>
                    <button
                      onClick={() => openCatEdit(cat)}
                      className="w-7 h-7 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500 active:scale-90 transition-all">
                      <SlidersHorizontal size={14} />
                    </button>
                    <button
                      onClick={toggleCollapse}
                      className="w-7 h-7 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500 active:scale-90 transition-all">
                      <X size={14} />
                    </button>
                  </div>
                  {!collapsed && (
                    <div className="space-y-3">
                      {catItems.map(item => (
                        <div key={item.id} className={`bg-white dark:bg-slate-800 rounded-2xl border ${getItemStatus(item) === 'hidden' ? 'opacity-50 border-gray-200 dark:border-slate-600' : 'border-gray-100 dark:border-slate-700'}`}>
                          <div className="p-4">
                            {/* Item info + image */}
                            <div className="flex items-start gap-3 mb-3">
                              <img
                                src={item.image_url || DEFAULT_IMAGE}
                                alt={item.name}
                                className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-gray-100 dark:bg-slate-700"
                                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_IMAGE; }}
                              />
                              <div className="text-right flex-1">
                                <p className="font-bold text-base text-gray-900 dark:text-slate-100">{item.name}</p>
                                {item.description && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 line-clamp-2">{item.description}</p>}
                                <p className="font-bold text-sm mt-2 text-[#f97316]">{item.price.toLocaleString()} د.ع</p>
                              </div>
                            </div>

                            {/* Status buttons */}
                            <div className="flex gap-1.5 mb-3 flex-row-reverse">
                              {ITEM_STATUSES.map(s => {
                                const active = getItemStatus(item) === s.value;
                                return (
                                  <button
                                    key={s.value}
                                    onClick={() => setItemStatus(item, s.value)}
                                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${active ? s.color : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500'}`}
                                  >
                                    {s.label}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Edit + Delete */}
                            <div className="flex gap-2 pt-3 border-t border-gray-50 dark:border-slate-700">
                              <button onClick={() => openEdit(item)} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-500 py-2 rounded-xl active:scale-90 transition-all text-sm font-bold">
                                <Pencil size={14} /> تعديل
                              </button>
                              <button onClick={() => deleteItem(item.id)} className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-400 py-2 rounded-xl active:scale-90 transition-all text-sm font-bold">
                                <Trash2 size={14} /> حذف
                              </button>
                            </div>
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

      {/* Category edit bottom sheet */}
      {editCatSheet && (() => {
        const editCat = categories.find(c => c.id === editCatSheet.catId);
        if (!editCat) return null;
        return (
          <>
          <div className="fixed inset-0 z-50 flex items-end" onClick={closeCatEdit}>
            <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${editCatAnimateIn ? 'opacity-100' : 'opacity-0'}`} />
            <div
              className={`relative w-full bg-white dark:bg-slate-800 rounded-t-3xl px-5 pt-5 pb-10 overflow-y-auto overscroll-y-contain max-h-[90vh] transition-transform duration-300 ease-out ${editCatAnimateIn ? 'translate-y-0' : 'translate-y-full'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <button onClick={closeCatEdit} className="p-1.5 rounded-xl text-gray-400 active:scale-90 transition-all">
                  <X size={20} />
                </button>
                <p className="font-bold text-gray-900 dark:text-slate-100 text-base">تعديل القسم</p>
                <div className="w-8" />
              </div>

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1.5">اسم القسم</p>
              <div className="flex gap-2 mb-5">
                <button
                  onClick={saveCatName}
                  disabled={saving || !editCatName.trim()}
                  className="px-4 py-3 bg-[#f97316] disabled:opacity-40 text-white font-bold rounded-xl active:scale-95 transition-all text-sm flex-shrink-0">
                  {saving ? '...' : 'حفظ'}
                </button>
                <input
                  value={editCatName}
                  onChange={e => setEditCatName(e.target.value)}
                  placeholder="اسم القسم"
                  dir="rtl"
                  className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]"
                />
              </div>

              {([
                { label: '☀️ الوضع النهاري', fields: [{ key: 'color' as const, name: 'لون الأزرار' }, { key: 'card_color' as const, name: 'لون الكارتات' }] },
                { label: '🌙 الوضع الليلي',  fields: [{ key: 'color_dark' as const, name: 'لون الأزرار' }, { key: 'card_color_dark' as const, name: 'لون الكارتات' }] },
              ] as const).map(section => (
                <div key={section.label} className="bg-gray-50 dark:bg-slate-700/50 rounded-2xl p-3 mb-3">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 text-right pb-2 border-b border-gray-200 dark:border-slate-600 mb-2">{section.label}</p>
                  {section.fields.map(({ key, name }) => (
                    <div key={key} className="flex items-center justify-between gap-3 p-2 rounded-xl">
                      <button
                        onClick={(e) => openColorPicker(key, e)}
                        className={`w-9 h-9 rounded-xl flex-shrink-0 border-2 transition-all active:scale-90 ${activeColorPicker === key ? 'border-[#f97316] scale-110 shadow-md' : 'border-gray-300 dark:border-slate-500'}`}
                        style={{ backgroundColor: editCatColors?.[key] ?? '#e67e22' }}
                      />
                      <span className="text-sm font-bold text-gray-700 dark:text-slate-200">{name}</span>
                    </div>
                  ))}
                </div>
              ))}

              <button
                onClick={saveCatColors}
                disabled={saving}
                className="w-full py-3 mb-5 bg-[#f97316] disabled:opacity-40 text-white font-bold rounded-xl active:scale-95 transition-all">
                {saving ? '...' : 'حفظ الألوان'}
              </button>

              {/* ══ معاينة مباشرة ══ */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setPreviewDark(p => !p)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 active:scale-95 transition-all border border-gray-200 dark:border-slate-600">
                    {previewDark ? '🌙 ليلي' : '☀️ نهاري'}
                  </button>
                  <p className="text-xs font-bold text-gray-500 dark:text-slate-400">معاينة القسم</p>
                </div>

                <div
                  className="rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-600 p-3 transition-all duration-300"
                  style={{ background: previewDark ? '#020617' : '#f8fafc' }}>

                  {/* شريط الفئات */}
                  <div className="flex justify-end gap-2 mb-3 overflow-x-auto pb-1">
                    {(() => {
                      const pColor = previewDark ? (editCatColors?.color_dark ?? '#e67e22') : (editCatColors?.color ?? '#e67e22');
                      const pText = getTextColor(pColor);
                      return (
                        <>
                          <div className="px-4 py-2 rounded-2xl text-xs font-black flex-shrink-0"
                            style={{ backgroundColor: previewDark ? '#1e293b' : '#ffffff', color: previewDark ? '#94a3b8' : '#9ca3af', border: `1px solid ${previewDark ? '#334155' : '#e5e7eb'}` }}>
                            الكل
                          </div>
                          <div className="px-4 py-2 rounded-2xl text-xs font-black flex-shrink-0 shadow-md"
                            style={{ backgroundColor: pColor, color: pText }}>
                            {editCat.name}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* بطاقات وهمية */}
                  <div className="grid grid-cols-2 gap-2">
                    {(['برجر لحم', 'دجاج مشوي'] as const).map((name, i) => {
                      const pCardColor = previewDark ? (editCatColors?.card_color_dark ?? '#1e293b') : (editCatColors?.card_color ?? '#ffffff');
                      const pBtnColor = previewDark ? (editCatColors?.color_dark ?? '#e67e22') : (editCatColors?.color ?? '#e67e22');
                      const pBtnBg = previewDark ? '#ffffff' : pBtnColor;
                      const pBtnText = previewDark ? '#000000' : getTextColor(pBtnColor);
                      return (
                        <div key={i} className="rounded-2xl overflow-hidden" style={{ backgroundColor: pCardColor, border: `1px solid ${previewDark ? '#334155' : '#f3f4f6'}` }}>
                          <div className="h-14 flex items-center justify-center" style={{ backgroundColor: previewDark ? '#0f172a' : '#e5e7eb' }}>
                            <span className="text-xl">🍽️</span>
                          </div>
                          <div className="p-2">
                            <p className="text-[11px] font-black text-right mb-1.5 truncate" style={{ color: previewDark ? '#f1f5f9' : '#111827' }}>{name}</p>
                            <div className="flex items-center justify-between flex-row-reverse">
                              <p className="text-[10px] font-bold" style={{ color: previewDark ? '#64748b' : '#9ca3af' }}>5,000 د.ع</p>
                              <div className="px-2.5 py-1 rounded-full text-[10px] font-black" style={{ backgroundColor: pBtnBg, color: pBtnText }}>
                                إضافة
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                onClick={() => { closeCatEdit(); setTimeout(() => deleteCategory(editCat), 350); }}
                className="w-full py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-500 font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                <Trash2 size={16} /> حذف القسم
              </button>
            </div>
          </div>

          {/* Color picker popover — fixed so it floats above the sheet */}
          {activeColorPicker && editCatColors && (
            <div
              ref={colorPickerRef}
              className="fixed z-[200] shadow-2xl"
              style={{ top: colorPickerPos.top, left: colorPickerPos.left }}
              onPointerDown={e => e.stopPropagation()}
            >
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-gray-200 dark:border-slate-600 w-[220px]">
                <HexColorPicker
                  color={editCatColors[activeColorPicker]}
                  onChange={v => setEditCatColors(p => p ? { ...p, [activeColorPicker]: v } : p)}
                  style={{ width: '100%', height: '160px' }}
                />
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex-shrink-0 border border-gray-200 dark:border-slate-600" style={{ backgroundColor: editCatColors[activeColorPicker] }} />
                  <input
                    type="text"
                    value={editCatColors[activeColorPicker]}
                    onChange={e => {
                      const v = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setEditCatColors(p => p ? { ...p, [activeColorPicker!]: v } : p);
                    }}
                    className="flex-1 min-w-0 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm font-mono text-gray-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#f97316]"
                    maxLength={7}
                    dir="ltr"
                  />
                  <button onClick={() => setActiveColorPicker(null)} className="text-gray-400 active:scale-90 flex-shrink-0">
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
          </>
        );
      })()}

      {!editCatSheet && <AdminBottomNav />}
    </div>
  );
}

