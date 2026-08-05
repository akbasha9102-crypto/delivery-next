'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/context/RestaurantContext';
import { useStaff } from '@/context/StaffContext';
import { AdminBottomNav } from '@/components/layout/BottomNav';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { LowStockAlert } from '@/components/shared/LowStockAlert';
import {
  ShoppingCart, Plus, Minus, X, Check, Wallet, LogOut, Clock,
  Percent, Ban, RotateCcw, ChevronLeft, Ticket,
} from 'lucide-react';
import {
  openShift, closeShift, listShifts, voidOrder, refundOrder, discountOrder, applyCoupon, errorMessage,
  type Shift,
} from '@/lib/api/staffApi';
import { useSettings } from '@/context/SettingsContext';
import { useDarkMode } from '@/context/ThemeContext';
import { deductStockForOrder } from '@/lib/utils/deduct-stock';
import { formatTime12h } from '@/lib/utils/formatTime';

type MenuCategory = { id: string; name: string };
type MenuItem = { id: string; category_id: string; name: string; price: number; image_url: string; is_available: boolean; item_status?: string; extras_json?: string };
type MenuExtra = { id: string; name: string; price: number };
type CartEntry = { item: MenuItem; qty: number; unitPrice: number; extraNames: string[] };

type LocalOrder = {
  id: string;
  client_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  order_items?: { id: string; item_name: string; quantity: number; price: number }[];
};

function getExtras(item: MenuItem): MenuExtra[] {
  try { return JSON.parse(item.extras_json || '[]'); } catch { return []; }
}

/* ─────────────────────────── شاشة فتح الوردية ─────────────────────────── */
function OpenShiftScreen({ staffToken, restaurantId, onOpened }: { staffToken: string; restaurantId: string; onOpened: (s: Shift) => void }) {
  const [cash, setCash] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const amount = parseFloat(cash) || 0;
    setSaving(true);
    setError(null);
    const res = await openShift({ opening_cash: amount, restaurant_id: restaurantId }, staffToken);
    setSaving(false);
    if (!res.ok) { setError('error' in res ? res.error : 'تعذّر فتح الوردية'); return; }
    onOpened(res.data as Shift);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#212121] flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="w-16 h-16 rounded-2xl bg-[#f97316]/10 flex items-center justify-center mb-4">
        <Wallet size={28} className="text-[#f97316]" />
      </div>
      <h1 className="text-xl font-black text-gray-900 dark:text-slate-100 mb-1">افتح ورديتك</h1>
      <p className="text-sm text-gray-400 dark:text-slate-500 mb-6 text-center">أدخل مبلغ الكاش الافتتاحي بالصندوق قبل بدء البيع</p>

      <div className="w-full max-w-xs">
        <input
          type="number" value={cash} onChange={e => setCash(e.target.value)} placeholder="0" dir="rtl" autoFocus
          className="w-full text-center text-2xl font-black bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-4 text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-1"
        />
        <p className="text-xs text-gray-400 text-center mb-4">د.ع</p>
        {error && <p className="text-red-500 text-xs font-bold text-center mb-3">{error}</p>}
        <button onClick={submit} disabled={saving || cash === ''}
          className="w-full py-4 rounded-2xl bg-[#f97316] disabled:opacity-40 text-white font-bold text-base active:scale-95 transition-all flex items-center justify-center gap-2">
          {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>فتح الوردية</>}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────── مودال إضافة طلب سريع ─────────────────────────── */
function QuickOrderSheet({ restaurantId, onClose, onCreated }: { restaurantId: string; onClose: () => void; onCreated: () => void }) {
  const { dark } = useDarkMode();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [extrasItem, setExtrasItem] = useState<MenuItem | null>(null);
  const [pickedExtras, setPickedExtras] = useState<Set<string>>(new Set());
  const [showReview, setShowReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [catsRes, itemsRes] = await Promise.all([
        supabase.from('categories').select('id, name').eq('restaurant_id', restaurantId).order('created_at', { ascending: true }),
        supabase.from('items').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }),
      ]);
      setCategories(catsRes.data || []);
      setItems((itemsRes.data || []).filter((i: MenuItem) => {
        const st = i.item_status || (i.is_available ? 'available' : 'hidden');
        return st === 'available';
      }));
      setLoading(false);
    })();
  }, [restaurantId]);

  const addToCart = (item: MenuItem, unitPrice: number, extraNames: string[] = []) =>
    setCart(prev => {
      const found = prev.find(e => e.item.id === item.id);
      // نحدّث السعر/الإضافات لآخر اختيار عند إعادة إضافة نفس الصنف — بدل تجاهله بصمت
      return found ? prev.map(e => e.item.id === item.id ? { ...e, qty: e.qty + 1, unitPrice, extraNames } : e) : [...prev, { item, qty: 1, unitPrice, extraNames }];
    });

  const handleTapAdd = (item: MenuItem) => {
    const extras = getExtras(item);
    if (extras.length > 0) { setExtrasItem(item); setPickedExtras(new Set()); return; }
    addToCart(item, item.price);
  };

  const confirmExtras = () => {
    if (!extrasItem) return;
    const extras = getExtras(extrasItem);
    const chosen = extras.filter(e => pickedExtras.has(e.id));
    const extrasSum = chosen.reduce((s, e) => s + e.price, 0);
    addToCart(extrasItem, extrasItem.price + extrasSum, chosen.map(e => e.name));
    setExtrasItem(null);
  };

  const changeQty = (itemId: string, delta: number) =>
    setCart(prev => prev.map(e => e.item.id === itemId ? { ...e, qty: e.qty + delta } : e).filter(e => e.qty > 0));

  const total = cart.reduce((s, e) => s + e.unitPrice * e.qty, 0);
  const filtered = selectedCat ? items.filter(i => i.category_id === selectedCat) : items;

  const submitOrder = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    const name = customerName.trim() || 'زبون كاشير';

    // طلبات الكاشير المحلي تُدفع فوراً لكن تمر بالمطبخ الآن (status='preparing')
    // وتكتمل فعلياً لما الشيف يضغط 'تم التجهيز' بشاشة المطبخ — راجع markReady
    // بـ admin/kitchen/page.tsx.
    const { data: order, error: orderErr } = await supabase.from('orders').insert([{
      restaurant_id: restaurantId,
      client_name: name,
      client_phone: '0000000000',
      total_amount: total,
      status: 'preparing',
      order_type: 'local',
      created_by_staff: true,
    }]).select().single();

    if (orderErr || !order) { setError('حدث خطأ أثناء حفظ الطلب'); setSubmitting(false); return; }

    const { error: itemsErr } = await supabase.from('order_items').insert(
      cart.map(e => ({
        order_id: order.id,
        item_id: e.item.id,
        item_name: e.extraNames.length > 0 ? `${e.item.name} (${e.extraNames.join('، ')})` : e.item.name,
        quantity: e.qty,
        price: e.unitPrice,
      }))
    );

    if (itemsErr) {
      await supabase.from('orders').delete().eq('id', order.id);
      setError('حدث خطأ في حفظ عناصر الطلب، حاول مجدداً');
      setSubmitting(false);
      return;
    }

    deductStockForOrder(restaurantId, order.id, name, cart.map(e => ({ id: e.item.id, item_id: e.item.id, item_name: e.item.name, quantity: e.qty, price: e.unitPrice })))
      .catch(err => console.error('تعذّر خصم المخزون:', err));

    setSubmitting(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-[#212121] flex flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 active:scale-90 transition-all">
          <X size={18} className="text-gray-600 dark:text-slate-300" />
        </button>
        <p className="font-bold text-gray-900 dark:text-white">طلب كاشير جديد</p>
        <div className="w-9" />
      </header>

      {loading ? (
        <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-40">
          <div className="flex gap-2 px-4 pt-4 pb-3 overflow-x-auto">
            <button onClick={() => setSelectedCat(null)} className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border active:scale-95 transition-all"
              style={{ backgroundColor: !selectedCat ? (dark?'var(--admin-accent-dark)':'var(--admin-accent-light-bg)') : '#fff', borderColor: !selectedCat ? (dark?'var(--admin-accent-dark)':'var(--admin-accent-light-border)') : '#e2e8f0', color: !selectedCat ? '#fff' : '#64748b' }}>
              الكل
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border active:scale-95 transition-all"
                style={{ backgroundColor: selectedCat === cat.id ? (dark?'var(--admin-accent-dark)':'var(--admin-accent-light-bg)') : '#fff', borderColor: selectedCat === cat.id ? (dark?'var(--admin-accent-dark)':'var(--admin-accent-light-border)') : '#e2e8f0', color: selectedCat === cat.id ? '#fff' : '#64748b' }}>
                {cat.name}
              </button>
            ))}
          </div>

          <div className="px-4 grid grid-cols-2 gap-3">
            {filtered.map(item => {
              const entry = cart.find(e => e.item.id === item.id);
              const hasExtras = getExtras(item).length > 0;
              return (
                <div key={item.id} className="rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="relative">
                    <img src={item.image_url} alt={item.name} className="w-full h-24 object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x200.png?text=Food'; }} />
                    {entry && <span className="absolute top-2 right-2 bg-[#f97316] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md">{entry.qty}</span>}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-sm text-right mb-1 leading-tight text-gray-900 dark:text-white">{item.name}</p>
                    <p className="font-bold text-xs text-right mb-2" style={{ color: '#f97316' }}>{item.price.toLocaleString()} د.ع</p>
                    {entry ? (
                      <div className="flex items-center justify-between">
                        <button onClick={() => changeQty(item.id, +1)} className="w-8 h-8 rounded-xl bg-[#f97316] text-white flex items-center justify-center active:scale-90 transition-all"><Plus size={15} /></button>
                        <span className="font-bold text-base text-gray-900 dark:text-white">{entry.qty}</span>
                        <button onClick={() => changeQty(item.id, -1)} className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-all bg-gray-100 dark:bg-slate-700"><Minus size={15} className="text-gray-500 dark:text-slate-300" /></button>
                      </div>
                    ) : (
                      <button onClick={() => handleTapAdd(item)} className="w-full py-2 rounded-xl bg-[#f97316] text-white text-xs font-bold active:scale-95 transition-all">
                        {hasExtras ? 'اختر إضافات +' : 'إضافة +'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pt-3 pb-5 space-y-3">
          <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="اسم الزبون (اختياري)" dir="rtl"
            className="w-full rounded-2xl px-4 py-2.5 text-right border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-[#f97316] text-gray-900 dark:text-white" />
          <button onClick={() => setShowReview(true)} className="w-full py-3.5 rounded-2xl bg-[#f97316] text-white font-bold text-base active:scale-95 transition-all">
            التالي — {total.toLocaleString()} د.ع
          </button>
        </div>
      )}

      {showReview && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/50" onClick={() => setShowReview(false)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-white dark:bg-[#212121] max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
              <button onClick={() => setShowReview(false)} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 active:scale-90 transition-all"><X size={18} className="text-gray-600 dark:text-slate-300" /></button>
              <p className="font-bold text-gray-900 dark:text-white">مراجعة الطلب</p>
              <div className="w-9" />
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {cart.map(e => (
                <div key={e.item.id} className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-3 flex items-center justify-between">
                  <span className="font-bold text-sm" style={{ color: '#f97316' }}>{(e.unitPrice * e.qty).toLocaleString()} د.ع</span>
                  <span className="font-bold text-sm text-gray-900 dark:text-white text-right">{e.item.name} <span className="text-gray-400 font-normal">×{e.qty}</span></span>
                </div>
              ))}
            </div>
            <div className="flex-shrink-0 px-5 pt-3 pb-6 border-t border-gray-100 dark:border-slate-700 space-y-3">
              {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-500 dark:text-slate-400 text-sm">السعر النهائي</span>
                <span className="font-black text-xl" style={{ color: '#f97316' }}>{total.toLocaleString()} <span className="text-sm font-normal">د.ع</span></span>
              </div>
              <button onClick={submitOrder} disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-[#f97316] text-white font-bold text-base active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={18} /> إتمام البيع</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {extrasItem && (() => {
        const extras = getExtras(extrasItem);
        const extrasSum = extras.filter(e => pickedExtras.has(e.id)).reduce((s, e) => s + e.price, 0);
        return (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50" onClick={() => setExtrasItem(null)}>
            <div className="w-full max-w-lg rounded-t-3xl pb-6 bg-white dark:bg-[#212121]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700">
                <button onClick={() => setExtrasItem(null)} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 active:scale-90 transition-all"><X size={18} className="text-gray-600 dark:text-slate-300" /></button>
                <p className="font-bold text-gray-900 dark:text-white">{extrasItem.name}</p>
                <div className="w-9" />
              </div>
              <div className="px-5 py-4 space-y-2">
                {extras.map(e => {
                  const on = pickedExtras.has(e.id);
                  return (
                    <button key={e.id} onClick={() => setPickedExtras(prev => { const next = new Set(prev); on ? next.delete(e.id) : next.add(e.id); return next; })}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-right transition-all"
                      style={on ? (dark ? { backgroundColor: 'var(--admin-accent-dark-soft)', borderColor: 'var(--admin-accent-dark)' } : { backgroundColor: 'var(--admin-accent-light-bg-soft)', borderColor: 'var(--admin-accent-light-border)' }) : { backgroundColor: 'transparent', borderColor: '#e2e8f0' }}>
                      <span className="flex items-center gap-2">
                        {on ? <Check size={16} className={dark ? 'text-[var(--admin-accent-dark)]' : 'text-[var(--admin-accent-light-bg)]'} strokeWidth={3} /> : <Plus size={16} className="text-gray-400" />}
                        {e.price > 0 && <span className="text-xs font-bold text-gray-400">+{e.price.toLocaleString()}</span>}
                      </span>
                      <span className="font-bold text-sm text-gray-900 dark:text-white">{e.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="px-5 pt-2">
                <button onClick={confirmExtras} className="w-full py-3.5 rounded-2xl bg-[#f97316] text-white font-bold text-base active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Check size={18} /> إضافة للسلة — {(extrasItem.price + extrasSum).toLocaleString()} د.ع
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ─────────────────────────── مودال إجراء حساس (خصم/إلغاء/استرجاع) ─────────────────────────── */
function OrderActionSheet({ order, staffToken, maxDiscountPct, maxVoidAmount, canCoupon, onClose, onDone }: {
  order: LocalOrder; staffToken: string; maxDiscountPct: number; maxVoidAmount: number; canCoupon: boolean;
  onClose: () => void; onDone: (msg: string, pending: boolean) => void;
}) {
  const [mode, setMode] = useState<'menu' | 'discount' | 'void' | 'refund' | 'coupon'>('menu');
  const [discountPct, setDiscountPct] = useState('');
  const [reason, setReason] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setSaving(true);
    setError(null);
    if (mode === 'discount') {
      const pct = parseFloat(discountPct) || 0;
      const res = await discountOrder(order.id, pct, staffToken);
      setSaving(false);
      if ('pending' in res && res.pending) { onDone('تم إرسال طلب الخصم — بانتظار موافقة المالك', true); return; }
      if (!res.ok) { setError(errorMessage(res, 'تعذّر تنفيذ الخصم')); return; }
      onDone('✓ تم تطبيق الخصم', false);
    } else if (mode === 'coupon') {
      if (!couponCode.trim()) { setError('كود الكوبون إلزامي'); setSaving(false); return; }
      const res = await applyCoupon(order.id, couponCode.trim(), staffToken);
      setSaving(false);
      if ('pending' in res && res.pending) { onDone('تم إرسال طلب الكوبون — بانتظار موافقة المالك', true); return; }
      if (!res.ok) { setError(errorMessage(res, 'تعذّر تطبيق الكوبون')); return; }
      onDone('✓ تم تطبيق الكوبون', false);
    } else if (mode === 'void') {
      if (!reason.trim()) { setError('السبب إلزامي'); setSaving(false); return; }
      const res = await voidOrder(order.id, reason.trim(), staffToken);
      setSaving(false);
      if ('pending' in res && res.pending) { onDone('تم إرسال طلب الإلغاء — بانتظار موافقة المالك', true); return; }
      if (!res.ok) { setError(errorMessage(res, 'تعذّر تنفيذ الإلغاء')); return; }
      onDone('✓ تم إلغاء الطلب', false);
    } else if (mode === 'refund') {
      if (!reason.trim()) { setError('السبب إلزامي'); setSaving(false); return; }
      const res = await refundOrder(order.id, reason.trim(), staffToken);
      setSaving(false);
      if ('pending' in res && res.pending) { onDone('تم إرسال طلب الاسترجاع — بانتظار موافقة المالك دائماً', true); return; }
      if (!res.ok) { setError(errorMessage(res, 'تعذّر تنفيذ الاسترجاع')); return; }
      onDone('✓ تم الاسترجاع', false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl pb-6" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="w-10 h-1 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mt-3 mb-4" />
        <div className="px-5">
          <p className="font-bold text-gray-900 dark:text-slate-100 text-base mb-1">{order.client_name}</p>
          <p className="text-sm text-[#f97316] font-bold mb-4">{order.total_amount.toLocaleString()} د.ع</p>

          {mode === 'menu' && (
            <div className="space-y-2">
              <button onClick={() => setMode('discount')} className="w-full flex items-center gap-3 bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 text-right active:scale-[0.98] transition-all">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500"><Percent size={18} /></div>
                <div className="flex-1"><p className="font-bold text-sm text-gray-900 dark:text-slate-100">خصم</p><p className="text-xs text-gray-400">حدك المسموح بدون موافقة: {maxDiscountPct}%</p></div>
              </button>
              <button onClick={() => setMode('void')} className="w-full flex items-center gap-3 bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 text-right active:scale-[0.98] transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500"><Ban size={18} /></div>
                <div className="flex-1"><p className="font-bold text-sm text-gray-900 dark:text-slate-100">إلغاء الطلب</p><p className="text-xs text-gray-400">حدك المسموح بدون موافقة: {maxVoidAmount.toLocaleString()} د.ع</p></div>
              </button>
              <button onClick={() => setMode('refund')} className="w-full flex items-center gap-3 bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 text-right active:scale-[0.98] transition-all">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500"><RotateCcw size={18} /></div>
                <div className="flex-1"><p className="font-bold text-sm text-gray-900 dark:text-slate-100">استرجاع مبلغ</p><p className="text-xs text-gray-400">يتطلب موافقة المالك دائماً</p></div>
              </button>
              {canCoupon && (
                <button onClick={() => setMode('coupon')} className="w-full flex items-center gap-3 bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 text-right active:scale-[0.98] transition-all">
                  <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-500"><Ticket size={18} /></div>
                  <div className="flex-1"><p className="font-bold text-sm text-gray-900 dark:text-slate-100">تطبيق كوبون</p><p className="text-xs text-gray-400">تطبيق كوبون الخصم على طلب مكتمل</p></div>
                </button>
              )}
            </div>
          )}

          {mode === 'discount' && (
            <div>
              <p className="text-xs text-gray-400 mb-1">نسبة الخصم (%)</p>
              <input type="number" value={discountPct} onChange={e => setDiscountPct(e.target.value)} placeholder="0"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-3" />
              {error && <p className="text-red-500 text-xs font-bold mb-3">{error}</p>}
              <button onClick={run} disabled={saving || !discountPct} className="w-full py-3.5 rounded-2xl bg-[#f97316] disabled:opacity-40 text-white font-bold active:scale-95 transition-all">
                {saving ? 'جاري التنفيذ...' : 'تأكيد الخصم'}
              </button>
            </div>
          )}

          {mode === 'coupon' && (
            <div>
              <p className="text-xs text-gray-400 mb-1">كود الكوبون</p>
              <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="مثال: SAVE10" dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-3" />
              {error && <p className="text-red-500 text-xs font-bold mb-3">{error}</p>}
              <button onClick={run} disabled={saving || !couponCode.trim()} className="w-full py-3.5 rounded-2xl bg-green-500 disabled:opacity-40 text-white font-bold active:scale-95 transition-all">
                {saving ? 'جاري التنفيذ...' : 'تأكيد الكوبون'}
              </button>
            </div>
          )}

          {(mode === 'void' || mode === 'refund') && (
            <div>
              <p className="text-xs text-gray-400 mb-1">السبب (إلزامي)</p>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="اكتب السبب..." dir="rtl" rows={3}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-3" />
              {error && <p className="text-red-500 text-xs font-bold mb-3">{error}</p>}
              <button onClick={run} disabled={saving || !reason.trim()}
                className={`w-full py-3.5 rounded-2xl disabled:opacity-40 text-white font-bold active:scale-95 transition-all ${mode === 'void' ? 'bg-red-500' : 'bg-purple-500'}`}>
                {saving ? 'جاري التنفيذ...' : mode === 'void' ? 'تأكيد الإلغاء' : 'تأكيد الاسترجاع'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── الصفحة الرئيسية ─────────────────────────── */
export default function LocalCashierPage() {
  const { restaurantId } = useRestaurant();
  const { activeStaff } = useStaff();
  const { coupon_enabled, coupon_allow_retroactive } = useSettings();
  const staffId = activeStaff?.staffId ?? null;
  const staffToken = activeStaff?.staffToken ?? null;

  const [checkingShift, setCheckingShift] = useState(true);
  const [shift, setShift] = useState<Shift | null>(null);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [actionOrder, setActionOrder] = useState<LocalOrder | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [closeCash, setCloseCash] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState<{ expected: number; variance: number } | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const fetchShift = useCallback(async () => {
    if (!restaurantId || !staffToken) { setCheckingShift(false); return; }
    setCheckingShift(true);
    const res = await listShifts(restaurantId, staffToken);
    if (res.ok) {
      const list = Array.isArray(res.data) ? res.data : ((res.data as { shifts?: Shift[] })?.shifts ?? []);
      const open = (list as Shift[]).find(s => s.status === 'open') ?? null;
      setShift(open);
    } else {
      setShift(null);
    }
    setCheckingShift(false);
  }, [restaurantId, staffToken]);

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    // أفضل تقريب متاح حالياً لـ "طلبات وردية الكاشير": طلبات order_type='local' لهذا المطعم منذ فتح ورديته —
    // العقد الحالي لا يربط orders بجدول cashier_shifts أو restaurant_staff مباشرة (فجوة بيانات معروفة، انظر ملاحظات الملخص).
    const since = shift?.opened_at ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data } = await supabase
      .from('orders')
      .select('id, client_name, total_amount, status, created_at, order_items(id, item_name, quantity, price)')
      .eq('restaurant_id', restaurantId)
      .eq('order_type', 'local')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);
    setOrders((data as unknown as LocalOrder[]) || []);
  }, [restaurantId, shift?.opened_at]);

  useEffect(() => { fetchShift(); }, [fetchShift]);
  useEffect(() => { if (shift) fetchOrders(); }, [shift, fetchOrders]);

  useEffect(() => {
    if (!restaurantId || !shift) return;
    const ch = supabase.channel('local-pos-' + restaurantId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, shift, fetchOrders]);

  const submitCloseShift = async () => {
    if (!shift || !staffToken) return;
    setClosing(true);
    const res = await closeShift(shift.id, parseFloat(closeCash) || 0, staffToken);
    setClosing(false);
    if (!res.ok) { showToast('error' in res ? res.error : 'تعذّر إغلاق الوردية', false); return; }
    const data = res.data as { expected_closing_cash: number; variance: number };

    // أرشفة تلقائية لطلبات "المحل" (order_type='local') عند إغلاق الوردية —
    // قرار المستخدم صراحة: بلا زر يدوي وبلا تركها كما هي. لكن نؤرشف فقط
    // الطلبات اللي وصلت لحالة نهائية فعلاً (completed/voided/refunded)؛ أي
    // طلب لسه 'preparing' (المطبخ ما خلّص تجهيزه) يبقى ظاهر بشاشة المطبخ
    // ولا يُؤرشف الآن — يُفترض يُؤرشف لاحقاً (مسح دوري/يدوي مستقبلاً إن
    // احتجنا) بعد ما يكتمل فعلياً. لا نعطّل إغلاق الوردية إن فشلت الأرشفة
    // (الوردية أُغلقت فعلياً بالفعل عبر closeShift أعلاه).
    if (restaurantId) {
      await supabase.from('orders')
        .update({ archived_at: new Date().toISOString() })
        .eq('restaurant_id', restaurantId)
        .eq('order_type', 'local')
        .is('archived_at', null)
        .in('status', ['completed', 'voided', 'refunded'])
        .gte('created_at', shift.opened_at);
    }

    setCloseResult({ expected: data.expected_closing_cash, variance: data.variance });
  };

  const finishClosing = () => {
    setShowClose(false);
    setCloseResult(null);
    setCloseCash('');
    setShift(null);
    setOrders([]);
  };

  const totalToday = orders.reduce((s, o) => s + o.total_amount, 0);

  if (!activeStaff) return null; // StaffGate يتكفّل بعرض شاشة "من أنت؟" أعلى هذه الصفحة

  if (checkingShift) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#212121] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!shift) {
    return staffId && staffToken && restaurantId && activeStaff.role !== 'owner'
      ? <OpenShiftScreen staffToken={staffToken} restaurantId={restaurantId} onOpened={setShift} />
      : (
        <div className="min-h-screen bg-gray-50 dark:bg-[#212121] flex items-center justify-center p-6 text-center" dir="rtl">
          <p className="text-gray-500 dark:text-slate-400">تعذّر تحديد هويتك الحالية لفتح وردية — أعد تسجيل الدخول</p>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#212121] pb-24 md:pb-0 md:mr-[70px]" dir="rtl">
      <AdminHeader
        title="الكاشير"
        icon={<ShoppingCart size={18} className="text-[#f97316]" />}
        right={
          <button onClick={() => setShowClose(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-bold active:scale-95 transition-all">
            <LogOut size={14} /> إغلاق الوردية
          </button>
        }
        left={
          <div className="flex items-center gap-1 text-xs font-bold text-gray-400 dark:text-slate-500">
            <Clock size={12} /> وردية مفتوحة
          </div>
        }
      />

      <LowStockAlert />

      {toast && (
        <div className={`mx-4 mt-3 px-4 py-3 rounded-xl border text-center font-bold text-sm ${toast.ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 text-center">
            <p className="text-2xl font-black text-gray-900 dark:text-slate-100">{orders.length}</p>
            <p className="text-xs text-gray-400 mt-1">طلب هذه الوردية</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 text-center">
            <p className="text-2xl font-black text-green-500">{totalToday.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">إجمالي المبيعات (د.ع)</p>
          </div>
        </div>

        <button onClick={() => setShowQuickAdd(true)}
          className="w-full py-4 rounded-2xl bg-[#f97316] text-white font-bold text-base active:scale-95 transition-all flex items-center justify-center gap-2 mb-5">
          <Plus size={20} /> طلب جديد
        </button>

        <p className="font-bold text-gray-900 dark:text-slate-100 text-sm mb-2">طلبات هذه الوردية</p>
        {orders.length === 0 ? (
          <div className="text-center mt-10">
            <p className="text-4xl mb-2">🧾</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm">لا توجد مبيعات بعد بهذه الوردية</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map(o => (
              <button key={o.id} onClick={() => setActionOrder(o)}
                className="w-full flex items-center justify-between bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 text-right active:scale-[0.98] transition-all">
                <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
                <div className="flex-1 px-2">
                  <p className="font-bold text-sm text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                    {o.client_name}
                    {o.status === 'preparing' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">قيد التجهيز</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{o.order_items?.length ?? 0} صنف · {formatTime12h(o.created_at)}</p>
                </div>
                <span className="font-bold text-sm text-[#f97316]">{o.total_amount.toLocaleString()} د.ع</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showQuickAdd && restaurantId && (
        <QuickOrderSheet restaurantId={restaurantId} onClose={() => setShowQuickAdd(false)} onCreated={() => { setShowQuickAdd(false); fetchOrders(); showToast('✓ تم إتمام البيع'); }} />
      )}

      {actionOrder && staffToken && activeStaff && (
        <OrderActionSheet
          order={actionOrder}
          staffToken={staffToken}
          maxDiscountPct={activeStaff.maxDiscountPct}
          maxVoidAmount={activeStaff.maxVoidAmount}
          canCoupon={!!coupon_enabled && !!coupon_allow_retroactive}
          onClose={() => setActionOrder(null)}
          onDone={(msg, pending) => { setActionOrder(null); showToast(msg, !pending); fetchOrders(); }}
        />
      )}

      {showClose && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !closing && setShowClose(false)}>
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-5" onClick={e => e.stopPropagation()}>
            {!closeResult ? (
              <>
                <p className="font-bold text-gray-900 dark:text-slate-100 text-center mb-1">إغلاق الوردية</p>
                <p className="text-xs text-gray-400 text-center mb-4">أدخل مبلغ الكاش الفعلي بالصندوق الآن</p>
                <input type="number" value={closeCash} onChange={e => setCloseCash(e.target.value)} placeholder="0" autoFocus
                  className="w-full text-center text-2xl font-black bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-4 text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-4" />
                <div className="flex gap-2">
                  <button onClick={() => setShowClose(false)} disabled={closing} className="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-bold active:scale-95 transition-all">إلغاء</button>
                  <button onClick={submitCloseShift} disabled={closing || closeCash === ''} className="flex-1 py-3 rounded-2xl bg-red-500 disabled:opacity-40 text-white font-bold active:scale-95 transition-all">
                    {closing ? '...' : 'تأكيد الإغلاق'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="font-bold text-gray-900 dark:text-slate-100 text-center mb-3">تقرير إغلاق الوردية</p>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-2xl p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-400">المتوقع بالصندوق</span><span className="font-bold text-gray-900 dark:text-slate-100">{closeResult.expected.toLocaleString()} د.ع</span></div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">الفرق (Variance)</span>
                    <span className={`font-bold ${closeResult.variance === 0 ? 'text-green-500' : 'text-red-500'}`}>{closeResult.variance > 0 ? '+' : ''}{closeResult.variance.toLocaleString()} د.ع</span>
                  </div>
                </div>
                <button onClick={finishClosing} className="w-full py-3 rounded-2xl bg-[#f97316] text-white font-bold active:scale-95 transition-all">تم</button>
              </>
            )}
          </div>
        </div>
      )}

      <AdminBottomNav />
    </div>
  );
}
