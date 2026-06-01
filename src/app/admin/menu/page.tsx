'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminBottomNav } from '@/components/BottomNav';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';

type Category = { id: string; name: string };
type Extra = { id: string; name: string; price: number };
type Item = { id: string; category_id: string; name: string; description: string; price: number; image_url: string; is_available: boolean; extras_json?: string };

const DEFAULT_IMAGE = 'https://via.placeholder.com/300x200.png?text=Food';

export default function MenuPage() {
  const { dark } = useDarkMode();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('add');
  const [newCat, setNewCat] = useState('');
  const [form, setForm] = useState({ category_id: '', name: '', description: '', price: '', image_url: '' });
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editForm, setEditForm] = useState({ category_id: '', name: '', description: '', price: '', image_url: '' });
  const [extras, setExtras] = useState<Extra[]>([]);
  const [extraName, setExtraName] = useState('');
  const [extraPrice, setExtraPrice] = useState('');

  const fetchMenu = async () => {
    setLoading(true);
    const { data: cats } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
    if (!cats?.length) {
      await supabase.from('categories').insert([{ name: 'وجبات سريعة' }, { name: 'مشروبات' }, { name: 'حلويات' }]);
      return fetchMenu();
    }
    setCategories(cats);
    const { data: its } = await supabase.from('items').select('*').order('created_at', { ascending: false });
    setItems(its || []);
    setLoading(false);
  };

  useEffect(() => { fetchMenu(); }, []);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('categories').insert([{ name: newCat.trim() }]);
    error ? showToast('تعذّر إضافة القسم', false) : (setNewCat(''), fetchMenu(), showToast('✓ تم إضافة القسم'));
    setSaving(false);
  };

  const addItem = async () => {
    if (!form.category_id || !form.name.trim() || !form.price.trim()) return alert('الرجاء ملء الحقول المطلوبة');
    const price = parseFloat(form.price.replace(',', '.'));
    if (isNaN(price) || price <= 0) return alert('سعر غير صالح');
    setSaving(true);
    const { error } = await supabase.from('items').insert([{ ...form, name: form.name.trim(), description: form.description.trim(), price, image_url: form.image_url.trim() || DEFAULT_IMAGE, is_available: true }]);
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

  const toggleAvailable = async (item: Item) => {
    await supabase.from('items').update({ is_available: !item.is_available }).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i));
  };

  const deleteItem = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    await supabase.from('items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
    showToast('✓ تم الحذف');
  };

  const input = `w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316] mb-3`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24">
      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-700">
              <button onClick={saveEdit} disabled={saving} className="bg-[#f97316] text-white font-bold px-4 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-60">
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

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 flex items-center justify-between stagger-0">
        <a href="/admin/dashboard" className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 font-bold px-4 py-2 rounded-xl text-sm active:scale-95 transition-all border border-gray-200 dark:border-slate-600">← رجوع</a>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">🍴 تعديل المنيو</h1>
        <div className="w-20" />
      </header>

      {toast && (
        <div className={`mx-4 mt-3 px-4 py-3 rounded-xl border text-center font-bold text-sm ${toast.ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex mx-4 mt-4 mb-4 bg-gray-100 dark:bg-slate-800 rounded-2xl p-1 stagger-1">
        <button onClick={() => setActiveTab('add')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${activeTab === 'add' ? 'bg-[#f97316] text-white' : 'text-gray-500 dark:text-slate-400'}`}>إضافة</button>
        <button onClick={() => setActiveTab('list')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${activeTab === 'list' ? 'bg-[#f97316] text-white' : 'text-gray-500 dark:text-slate-400'}`}>القائمة ({items.length})</button>
      </div>

      <div className="px-4 stagger-2">
        {loading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
        ) : activeTab === 'add' ? (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-3">➕ قسم جديد</h3>
              <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="اسم القسم" dir="rtl" className={input} />
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
            {categories.map(cat => {
              const catItems = items.filter(i => i.category_id === cat.id);
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-end gap-2 mb-3">
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">{cat.name}</h3>
                    <span className="bg-orange-100 dark:bg-orange-900/20 text-[#f97316] text-xs font-bold px-2.5 py-0.5 rounded-full border border-orange-200 dark:border-orange-800">{catItems.length}</span>
                  </div>
                  {catItems.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-dashed border-gray-200 dark:border-slate-600 text-center text-gray-400 dark:text-slate-500 text-sm">لا توجد أطباق</div>
                  ) : (
                    <div className="space-y-3">
                      {catItems.map(item => (
                        <div key={item.id} className={`bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden ${item.is_available ? 'border-gray-100 dark:border-slate-700' : 'border-gray-200 dark:border-slate-600 opacity-70'}`}>
                          <div className="flex justify-between items-center p-4">
                            <div className="flex gap-2">
                              <button onClick={() => deleteItem(item.id)} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-400 px-3 py-1.5 rounded-xl text-xs font-bold active:scale-90 transition-all">حذف</button>
                              <button onClick={() => openEdit(item)} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-400 px-3 py-1.5 rounded-xl text-xs font-bold active:scale-90 transition-all flex items-center gap-1"><Pencil size={12} />تعديل</button>
                            </div>
                            <div className="text-right flex-1 mr-3">
                              <p className={`font-bold ${item.is_available ? 'text-gray-900 dark:text-slate-100' : 'text-gray-400 dark:text-slate-500'}`}>{item.name}</p>
                              {item.description && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">{item.description}</p>}
                              <p className={`font-bold mt-1 text-sm ${item.is_available ? 'text-[#f97316]' : 'text-gray-400 dark:text-slate-500'}`}>{item.price.toLocaleString()} د.ع</p>
                            </div>
                          </div>
                          <button onClick={() => toggleAvailable(item)}
                            className={`w-full mx-4 mb-4 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95 ${item.is_available ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-500' : 'bg-gray-100 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500'}`}
                            style={{ width: 'calc(100% - 2rem)' }}>
                            {item.is_available ? '● متاح للزبائن — اضغط للإخفاء' : '○ مخفي — اضغط للإتاحة'}
                          </button>
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

      <AdminBottomNav />
    </div>
  );
}
