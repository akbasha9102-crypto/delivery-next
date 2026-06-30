'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminBottomNav } from '@/components/BottomNav';
import { X, Plus, Pencil, Trash2, Search, ArrowUp, ArrowDown, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { useRestaurant } from '@/context/RestaurantContext';

type Category = { id: string; name: string; color?: string; card_color?: string; color_dark?: string; card_color_dark?: string; sort_order?: number | null };
type Extra = { id: string; name: string; price: number };
type Item = { id: string; category_id: string; name: string; description: string; price: number; image_url: string; is_available: boolean; item_status?: string; extras_json?: string };

const ITEM_STATUSES = [
  { value: 'available',   label: 'متوفر',            color: 'bg-green-500 text-white border-green-500' },
  { value: 'unavailable', label: 'غير متوفر حاليا', color: 'bg-amber-500 text-white border-amber-500' },
  { value: 'hidden',      label: 'انتهى',            color: 'bg-red-500 text-white border-red-500' },
] as const;

function getItemStatus(item: Item) {
  return item.item_status || (item.is_available ? 'available' : 'hidden');
}

const DEFAULT_IMAGE = 'https://via.placeholder.com/300x200.png?text=Food';

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
  const [form, setForm] = useState({ category_id: '', name: '', description: '', price: '', image_url: '' });
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editForm, setEditForm] = useState({ category_id: '', name: '', description: '', price: '', image_url: '' });
  const [extras, setExtras] = useState<Extra[]>([]);
  const [extraName, setExtraName] = useState('');
  const [extraPrice, setExtraPrice] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [showReorder, setShowReorder] = useState(false);
  const [reorderCats, setReorderCats] = useState<Category[]>([]);
  const [editCatSheet, setEditCatSheet] = useState<{ catId: string } | null>(null);
  const [editCatAnimateIn, setEditCatAnimateIn] = useState(false);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColors, setEditCatColors] = useState<{ color: string; card_color: string; color_dark: string; card_color_dark: string } | null>(null);
  const [previewDark, setPreviewDark] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

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

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('categories').insert([{
      name: newCat.trim(),
      color: newCatColor,
      restaurant_id: restaurantId,
    }]);
    error ? showToast('تعذّر إضافة القسم', false) : (setNewCat(''), fetchMenu(), showToast('✓ تم إضافة القسم'));
    setSaving(false);
  };

  const saveCatColors = async () => {
    if (!editCatSheet || !editCatColors) return;
    const id = editCatSheet.catId;
    setSaving(true);
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...editCatColors } : c));
    await supabase.from('categories').update(editCatColors).eq('id', id);
    setSaving(false);
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
    const { error } = await supabase.from('items').insert([{
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      image_url: form.image_url.trim() || DEFAULT_IMAGE,
      is_available: true,
      restaurant_id: restaurantId,
    }]);
    error ? showToast('تعذّر إضافة الطبق', false) : (setForm({ category_id: '', name: '', description: '', price: '', image_url: '' }), fetchMenu(), showToast('✓ تم إضافة الطبق'));
    setSaving(false);
  };

  const openEdit = (item: Item) => {
    setEditItem(item);
    setEditForm({ category_id: item.category_id, name: item.name, description: item.description || '', price: String(item.price), image_url: item.image_url || '' });
    try { setExtras(JSON.parse(item.extras_json || '[]')); } catch { setExtras([]); }
    setExtraName(''); setExtraPrice('');
  };

  const saveEdit = async () => {
    if (!editItem || !editForm.name.trim() || !editForm.price.trim()) return;
    const price = parseFloat(editForm.price.replace(',', '.'));
    if (isNaN(price) || price <= 0) return alert('سعر غير صالح');
    setSaving(true);
    const { error } = await supabase.from('items').update({ ...editForm, name: editForm.name.trim(), description: editForm.description.trim(), price, image_url: editForm.image_url.trim() || DEFAULT_IMAGE }).eq('id', editItem.id);
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
      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-700">
              <button onClick={saveEdit} disabled={saving} className="bg-black text-white font-bold px-4 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-60">
                {saving ? '...' : 'حفظ'}
              </button>
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">✏️ تعديل الطبق</h3>
              <button onClick={() => setEditItem(null)} className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold px-4 py-2 rounded-xl active:scale-95 transition-all">إلغاء</button>
            </div>
            <div className="overflow-y-auto p-5">
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
                { label: 'رابط الصورة', key: 'image_url', placeholder: 'رابط الصورة' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <p className="text-gray-400 dark:text-slate-500 text-xs text-right mb-1">{label}</p>
                  <input type={type || 'text'} value={(editForm as any)[key]} onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} dir="rtl" className={input} />
                </div>
              ))}

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
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 flex items-center justify-center stagger-0">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">تعديل المنيو</h1>
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
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-3">➕ قسم جديد</h3>
              <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="اسم القسم" dir="rtl" className={input} />
              <div className="flex items-center justify-end gap-3 mb-3">
                <span className="text-sm text-gray-400 dark:text-slate-500">لون القسم</span>
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                  className="w-9 h-9 rounded-xl cursor-pointer border border-gray-200 dark:border-slate-600" />
              </div>
              <button onClick={addCategory} disabled={saving || !newCat.trim()} className="w-full bg-[#f97316] disabled:opacity-40 text-white font-bold py-3 rounded-xl active:scale-95 transition-all">
                {saving ? 'جاري الحفظ...' : 'إضافة القسم'}
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-4">🍽️ طبق جديد</h3>
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
                { key: 'image_url', placeholder: 'رابط الصورة (اختياري)' },
              ].map(({ key, placeholder, type }) => (
                <input key={key} type={type || 'text'} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} dir="rtl" className={input} />
              ))}
              <button onClick={addItem} disabled={saving} className="w-full bg-[#f97316] disabled:opacity-40 text-white font-bold py-3.5 rounded-xl text-base active:scale-95 transition-all">
                {saving ? 'جاري الحفظ...' : 'إضافة الطبق'}
              </button>
            </div>
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

              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-2xl p-3 mb-3">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 text-right pb-2 border-b border-gray-200 dark:border-slate-600 mb-2">☀️ الوضع النهاري</p>
                <label className="flex items-center justify-between gap-3 p-2 rounded-xl cursor-pointer">
                  <input type="color" value={editCatColors?.color ?? '#e67e22'} onChange={e => setEditCatColors(p => p ? { ...p, color: e.target.value } : p)}
                    className="w-9 h-9 rounded-xl cursor-pointer border border-gray-200 dark:border-slate-600 flex-shrink-0" />
                  <span className="text-sm font-bold text-gray-700 dark:text-slate-200">لون الأزرار</span>
                </label>
                <label className="flex items-center justify-between gap-3 p-2 rounded-xl cursor-pointer">
                  <input type="color" value={editCatColors?.card_color ?? '#ffffff'} onChange={e => setEditCatColors(p => p ? { ...p, card_color: e.target.value } : p)}
                    className="w-9 h-9 rounded-xl cursor-pointer border border-gray-200 dark:border-slate-600 flex-shrink-0" />
                  <span className="text-sm font-bold text-gray-700 dark:text-slate-200">لون الكارتات</span>
                </label>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-2xl p-3 mb-4">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 text-right pb-2 border-b border-gray-200 dark:border-slate-600 mb-2">🌙 الوضع الليلي</p>
                <label className="flex items-center justify-between gap-3 p-2 rounded-xl cursor-pointer">
                  <input type="color" value={editCatColors?.color_dark ?? '#e67e22'} onChange={e => setEditCatColors(p => p ? { ...p, color_dark: e.target.value } : p)}
                    className="w-9 h-9 rounded-xl cursor-pointer border border-gray-200 dark:border-slate-600 flex-shrink-0" />
                  <span className="text-sm font-bold text-gray-700 dark:text-slate-200">لون الأزرار</span>
                </label>
                <label className="flex items-center justify-between gap-3 p-2 rounded-xl cursor-pointer">
                  <input type="color" value={editCatColors?.card_color_dark ?? '#1e293b'} onChange={e => setEditCatColors(p => p ? { ...p, card_color_dark: e.target.value } : p)}
                    className="w-9 h-9 rounded-xl cursor-pointer border border-gray-200 dark:border-slate-600 flex-shrink-0" />
                  <span className="text-sm font-bold text-gray-700 dark:text-slate-200">لون الكارتات</span>
                </label>
              </div>

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
        );
      })()}

      {!editCatSheet && <AdminBottomNav />}
    </div>
  );
}

