'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminBottomNav } from '@/components/BottomNav';
import { Minus, Plus, X, ShoppingBag, Check } from 'lucide-react';

type Category = { id: string; name: string; color?: string };
type Item = { id: string; category_id: string; name: string; price: number; image_url: string; is_available: boolean; item_status?: string };
type CartEntry = { item: Item; qty: number };

export default function LocalPOSPage() {
  const { dark } = useDarkMode();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items,      setItems]      = useState<Item[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [cart,       setCart]       = useState<CartEntry[]>([]);
  const [showCart,   setShowCart]   = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);

  const fetchMenu = useCallback(async () => {
    const [catsRes, itemsRes] = await Promise.all([
      supabase.from('categories').select('*').order('created_at', { ascending: true }),
      supabase.from('items').select('*').order('created_at', { ascending: false }),
    ]);
    setCategories(catsRes.data || []);
    setItems(
      (itemsRes.data || []).filter(i => {
        const st = i.item_status || (i.is_available ? 'available' : 'hidden');
        return st === 'available';
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  const addToCart = (item: Item) =>
    setCart(prev => {
      const found = prev.find(e => e.item.id === item.id);
      return found
        ? prev.map(e => e.item.id === item.id ? { ...e, qty: e.qty + 1 } : e)
        : [...prev, { item, qty: 1 }];
    });

  const changeQty = (itemId: string, delta: number) =>
    setCart(prev =>
      prev.map(e => e.item.id === itemId ? { ...e, qty: e.qty + delta } : e)
          .filter(e => e.qty > 0)
    );

  const total     = cart.reduce((s, e) => s + e.item.price * e.qty, 0);
  const cartCount = cart.reduce((s, e) => s + e.qty, 0);
  const filtered  = selectedCat ? items.filter(i => i.category_id === selectedCat) : items;

  const submitOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    const name = customerName.trim() || 'زبون محلي';

    const { data: order, error } = await supabase.from('orders').insert([{
      client_name:      name,
      client_phone:     '0000000000',
      delivery_address: null,
      client_note:      null,
      total_amount:     total,
      status:           'completed',
      order_type:       'local',
    }]).select().single();

    if (error || !order) {
      alert('حدث خطأ أثناء حفظ الطلب. تأكد من إضافة عمود order_type للجدول.');
      setSubmitting(false);
      return;
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      cart.map(e => ({ order_id: order.id, item_name: e.item.name, quantity: e.qty, price: e.item.price }))
    );

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      alert('حدث خطأ في حفظ عناصر الطلب، حاول مجدداً');
      setSubmitting(false);
      return;
    }

    setCart([]);
    setCustomerName('');
    setShowCart(false);
    setDone(true);
    setSubmitting(false);
    setTimeout(() => setDone(false), 3000);
  };

  const s = {
    bg:      dark ? '#0f172a' : '#f8fafc',
    surface: dark ? '#1e293b' : '#fff',
    border:  dark ? '#334155' : '#e2e8f0',
    text:    dark ? '#f1f5f9' : '#0f172a',
    sub:     dark ? '#94a3b8' : '#64748b',
    muted:   dark ? '#334155' : '#f1f5f9',
  };

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: s.bg }}>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: s.surface, borderColor: s.border }}>
        <div className="w-10" />
        <h1 className="font-bold text-lg" style={{ color: s.text }}>كاشير المحل</h1>
        <button
          onClick={() => setShowCart(true)}
          className="relative p-2.5 rounded-xl active:scale-90 transition-all"
          style={{ backgroundColor: cartCount > 0 ? 'rgba(249,115,22,0.12)' : s.muted }}>
          <ShoppingBag size={20} style={{ color: cartCount > 0 ? '#f97316' : s.sub }} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#f97316] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none">
              {cartCount}
            </span>
          )}
        </button>
      </header>

      {/* Success flash */}
      {done && (
        <div className="bg-green-500 py-3 text-center animate-pulse">
          <p className="text-white font-bold">✓ تم تسجيل الطلب بنجاح!</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Category filter */}
          <div className="flex gap-2 px-4 pt-4 pb-3 overflow-x-auto">
            <button
              onClick={() => setSelectedCat(null)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border active:scale-95 transition-all"
              style={{ backgroundColor: !selectedCat ? '#f97316' : s.surface, borderColor: !selectedCat ? '#f97316' : s.border, color: !selectedCat ? '#fff' : s.sub }}>
              الكل
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border active:scale-95 transition-all"
                style={{ backgroundColor: selectedCat === cat.id ? '#f97316' : s.surface, borderColor: selectedCat === cat.id ? '#f97316' : s.border, color: selectedCat === cat.id ? '#fff' : s.sub }}>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Items grid */}
          <div className="px-4 grid grid-cols-2 gap-3">
            {filtered.map(item => {
              const entry = cart.find(e => e.item.id === item.id);
              return (
                <div key={item.id} className="rounded-2xl overflow-hidden border"
                  style={{ backgroundColor: s.surface, borderColor: s.border }}>
                  <div className="relative">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-28 object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x200.png?text=Food'; }}
                    />
                    {entry && (
                      <span className="absolute top-2 right-2 bg-[#f97316] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                        {entry.qty}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-sm text-right mb-1 leading-tight" style={{ color: s.text }}>{item.name}</p>
                    <p className="font-bold text-xs text-right mb-2" style={{ color: '#f97316' }}>{item.price.toLocaleString()} د.ع</p>
                    {entry ? (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => changeQty(item.id, +1)}
                          className="w-8 h-8 rounded-xl bg-[#f97316] text-white flex items-center justify-center active:scale-90 transition-all">
                          <Plus size={15} />
                        </button>
                        <span className="font-bold text-base" style={{ color: s.text }}>{entry.qty}</span>
                        <button
                          onClick={() => changeQty(item.id, -1)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-all"
                          style={{ backgroundColor: s.muted }}>
                          <Minus size={15} style={{ color: s.sub }} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="w-full py-2 rounded-xl bg-[#f97316] text-white text-xs font-bold active:scale-95 transition-all">
                        إضافة +
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Floating cart bar */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-20 left-4 right-4 z-40">
          <button
            onClick={() => setShowCart(true)}
            className="w-full py-4 rounded-2xl bg-[#f97316] text-white font-bold text-base shadow-lg flex items-center justify-between px-5 active:scale-[0.98] transition-all">
            <span className="font-bold text-lg">{total.toLocaleString()} د.ع</span>
            <span>عرض الطلب ({cartCount})</span>
          </button>
        </div>
      )}

      {/* Cart bottom sheet */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowCart(false)}>
          <div
            className="w-full max-w-lg rounded-t-3xl pb-8 max-h-[88vh] flex flex-col"
            style={{ backgroundColor: s.surface }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b flex-shrink-0" style={{ borderColor: s.border }}>
              <button onClick={() => setShowCart(false)} className="p-2 rounded-full active:scale-90 transition-all" style={{ backgroundColor: s.muted }}>
                <X size={18} style={{ color: s.sub }} />
              </button>
              <p className="font-bold text-lg" style={{ color: s.text }}>الطلب المحلي</p>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs font-bold text-red-400 px-2 py-1 active:scale-90 transition-all">
                  مسح
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-5xl mb-3">🛒</p>
                  <p style={{ color: s.sub }}>لا يوجد عناصر</p>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {cart.map(({ item, qty }) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl px-4 py-3 border"
                      style={{ backgroundColor: s.muted, borderColor: s.border }}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => changeQty(item.id, +1)}
                          className="w-8 h-8 rounded-xl bg-[#f97316] text-white flex items-center justify-center active:scale-90">
                          <Plus size={14} />
                        </button>
                        <span className="font-bold w-5 text-center" style={{ color: s.text }}>{qty}</span>
                        <button onClick={() => changeQty(item.id, -1)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90"
                          style={{ backgroundColor: s.surface }}>
                          <Minus size={14} style={{ color: s.sub }} />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm" style={{ color: s.text }}>{item.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#f97316' }}>{(item.price * qty).toLocaleString()} د.ع</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="اسم الزبون (اختياري)"
                  dir="rtl"
                  className="w-full rounded-2xl px-4 py-3 text-right border outline-none focus:ring-2 focus:ring-[#f97316] mb-4"
                  style={{ backgroundColor: s.muted, borderColor: s.border, color: s.text }}
                />
              )}
            </div>

            {cart.length > 0 && (
              <div className="px-5 pt-2 flex-shrink-0 space-y-3 border-t" style={{ borderColor: s.border }}>
                <div className="flex justify-between items-center pt-3">
                  <span className="font-bold text-2xl" style={{ color: '#f97316' }}>{total.toLocaleString()} <span className="text-sm font-normal" style={{ color: s.sub }}>د.ع</span></span>
                  <span className="font-bold" style={{ color: s.sub }}>المجموع</span>
                </div>
                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl bg-[#f97316] text-white font-bold text-lg active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Check size={20} /> تأكيد الطلب</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <AdminBottomNav />
    </div>
  );
}

