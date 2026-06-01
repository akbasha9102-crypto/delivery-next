'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useDarkMode } from '@/context/ThemeContext';
import { ClientBottomNav } from '@/components/BottomNav';
import { Moon, Sun, ShoppingCart, Plus, Minus, X } from 'lucide-react';
import AsyncStorage from '@/lib/storage';

const PHONE_KEY = 'deliveryPhone';

type Category = { id: string; name: string };
type Extra = { id: string; name: string; price: number };
type Item = { id: string; name: string; price: number; description: string; image_url: string | null; category_id: string; is_available: boolean; extras_json?: string };

export default function HomePage() {
  const { dark, toggleDark } = useDarkMode();
  const { items: cartItems, addItem, decrementItem, removeItem, total } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showCartPanel, setShowCartPanel] = useState(false);

  // Extras modal
  const [extrasItem, setExtrasItem] = useState<Item | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
      const { data: its } = await supabase.from('items').select('*').order('name');
      setCategories(cats || []);
      setItems(its || []);
      setLoading(false);
    };
    fetchData();

    const ch = supabase.channel('menu-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    setShowCartPanel(cartItems.length > 0);
  }, [cartItems.length]);

  const filtered = activeCategory === 'all' ? items : items.filter(i => i.category_id === activeCategory);

  const getExtras = (item: Item): Extra[] => {
    try { return JSON.parse(item.extras_json || '[]'); } catch { return []; }
  };

  const handleAdd = (item: Item) => {
    if (!item.is_available) return;
    const extras = getExtras(item);
    if (extras.length > 0) {
      setExtrasItem(item);
      setSelectedExtras(new Set());
    } else {
      addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url });
    }
  };

  const confirmExtras = () => {
    if (!extrasItem) return;
    const extras = getExtras(extrasItem);
    const extraCost = extras.filter(e => selectedExtras.has(e.id)).reduce((s, e) => s + e.price, 0);
    const extraNames = extras.filter(e => selectedExtras.has(e.id)).map(e => e.name).join('، ');
    addItem({
      id: extrasItem.id,
      name: extraNames ? `${extrasItem.name} (${extraNames})` : extrasItem.name,
      price: extrasItem.price + extraCost,
      image_url: extrasItem.image_url,
    });
    setExtrasItem(null);
  };

  const qty = (id: string) => cartItems.find(i => i.id === id)?.quantity || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-3 flex items-center justify-between stagger-0">
        <div className="flex items-center gap-2">
          <button onClick={toggleDark} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 transition-all active:scale-90">
            {dark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-gray-600" />}
          </button>
          {cartItems.length > 0 && (
            <span className="bg-[#e67e22] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {cartItems.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-[#944a00]">CulinaShare</h1>
      </header>

      <div className="px-4 pt-5">
        {/* Title + Categories */}
        <div className="stagger-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">استكشف النكهات</h2>
          <div className="flex gap-2 overflow-x-auto pb-1 mb-5 flex-row-reverse scrollbar-hide">
            {[{ id: 'all', name: 'الكل' }, ...categories].map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all active:scale-95 border ${
                  activeCategory === cat.id
                    ? 'bg-[#e67e22] border-[#e67e22] text-white'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Items Grid */}
        <div className="stagger-2">
          {loading ? (
            <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#e67e22] border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 mt-20">لا توجد وجبات</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(item => {
                const count = qty(item.id);
                return (
                  <div key={item.id} className={`bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm ${!item.is_available ? 'opacity-50' : ''}`}>
                    <div className="relative">
                      <Image
                        src={item.image_url || 'https://via.placeholder.com/150'}
                        alt={item.name}
                        width={200} height={120}
                        className="w-full h-28 object-cover"
                        unoptimized
                      />
                      {!item.is_available && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white text-xs font-bold bg-black/60 px-2 py-1 rounded-lg">غير متوفر</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-sm text-gray-900 dark:text-slate-100 text-right mb-1">{item.name}</p>
                      {item.description && <p className="text-xs text-gray-500 dark:text-slate-400 text-right mb-2 line-clamp-1">{item.description}</p>}
                      <p className="text-[#e67e22] font-bold text-sm text-right mb-3">{item.price.toLocaleString()} د.ع</p>

                      {count > 0 ? (
                        <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 rounded-xl px-2 py-1">
                          <button onClick={() => addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url })} className="w-7 h-7 rounded-full bg-[#e67e22] text-white flex items-center justify-center active:scale-90"><Plus size={14} /></button>
                          <span className="font-bold text-[#e67e22]">{count}</span>
                          <button onClick={() => decrementItem(item.id)} className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 flex items-center justify-center active:scale-90"><Minus size={14} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAdd(item)}
                          disabled={!item.is_available}
                          className="w-full border border-[#e67e22] text-[#e67e22] font-bold text-sm py-2 rounded-xl transition-all active:scale-95 disabled:opacity-40"
                        >
                          + أضف للسلة
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel */}
      {showCartPanel && (
        <div className="fixed bottom-16 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-2xl rounded-t-2xl px-4 pt-3 pb-4 z-40 animate-[fadeSlideUp_0.3s_ease-out]">
          <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mb-3" />
          <div className="max-h-28 overflow-y-auto mb-3">
            {cartItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1.5">
                <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>
                <span className="flex-1 text-right text-sm text-gray-700 dark:text-slate-300 mx-2">{item.quantity}× {item.name}</span>
                <span className="text-[#e67e22] text-sm font-bold">{(item.price * item.quantity).toLocaleString()} د.ع</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-700 pt-3">
            <Link href="/cart" className="bg-[#e67e22] hover:bg-[#d35400] text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95">
              تأكيد الطلب
            </Link>
            <div className="text-right">
              <p className="text-xs text-gray-400 dark:text-slate-500">الإجمالي</p>
              <p className="text-[#e67e22] font-bold text-lg">{total.toLocaleString()} د.ع</p>
            </div>
          </div>
        </div>
      )}

      {/* Extras Modal */}
      {extrasItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setExtrasItem(null)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 dark:text-slate-500 text-sm">اختياري</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">أضف للطلب 🧂</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 text-right mb-4">اختر الإضافات التي تريدها</p>
            <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {getExtras(extrasItem).map(e => (
                <button
                  key={e.id}
                  onClick={() => setSelectedExtras(prev => { const n = new Set(prev); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n; })}
                  className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border transition-all ${selectedExtras.has(e.id) ? 'bg-orange-50 dark:bg-orange-900/20 border-[#e67e22]' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600'}`}
                >
                  <span className={`font-bold text-sm ${selectedExtras.has(e.id) ? 'text-[#e67e22]' : 'text-gray-400 dark:text-slate-500'}`}>
                    {selectedExtras.has(e.id) ? '✓' : '○'}
                  </span>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{e.name}</p>
                    {e.price > 0 && <p className="text-[#e67e22] text-xs">+{e.price.toLocaleString()} د.ع</p>}
                    {e.price === 0 && <p className="text-gray-400 text-xs">مجاني</p>}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={confirmExtras} className="w-full bg-[#e67e22] hover:bg-[#d35400] text-white font-bold py-3.5 rounded-xl transition-all active:scale-95">
              إضافة للسلة
            </button>
          </div>
        </div>
      )}

      <ClientBottomNav />
    </div>
  );
}
