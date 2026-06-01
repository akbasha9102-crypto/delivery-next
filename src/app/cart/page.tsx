'use client';
import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { Trash2 } from 'lucide-react';

const PHONE_KEY = 'deliveryPhone';

export default function CartPage() {
  const { items, removeItem, clearCart, total } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(PHONE_KEY);
    if (saved) setPhone(saved);
  }, []);

  const handleConfirm = () => {
    if (!name.trim() || !phone.trim()) { alert('الرجاء إدخال الاسم ورقم الهاتف'); return; }
    if (items.length === 0) { alert('السلة فارغة'); return; }
    setShowConfirm(true);
  };

  const submitOrder = async () => {
    setLoading(true);
    localStorage.setItem(PHONE_KEY, phone.trim());
    const { data: order, error } = await supabase.from('orders').insert([{
      client_name: name.trim(), client_phone: phone.trim(),
      delivery_address: address.trim() || null, client_note: note.trim() || null,
      total_amount: total, status: 'pending',
    }]).select().single();

    if (error || !order) { alert('حدث خطأ، حاول مجدداً'); setLoading(false); return; }

    await supabase.from('order_items').insert(
      items.map(i => ({ order_id: order.id, item_name: i.name, quantity: i.quantity, price: i.price }))
    );

    localStorage.setItem('lastOrderId', order.id);
    clearCart();
    setShowConfirm(false);
    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center pb-24">
        <div className="text-center stagger-0">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">تم إرسال طلبك!</h2>
          <p className="text-gray-500 dark:text-slate-400 mb-6">سيتم التواصل معك قريباً</p>
          <a href="/track" className="bg-[#e67e22] text-white font-bold px-6 py-3 rounded-xl inline-block">تتبع طلبك</a>
        </div>
        <ClientBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 stagger-0">
        <h1 className="text-xl font-bold text-[#944a00] text-center">سلة المشتريات</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Items */}
        <div className="stagger-1">
          {items.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-slate-500 mt-16">السلة فارغة</p>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 flex items-center justify-between">
                  <button onClick={() => removeItem(item.id)} className="p-2 bg-red-50 dark:bg-red-900/20 rounded-full text-red-400 active:scale-90"><Trash2 size={16} /></button>
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-slate-100">{item.name}</p>
                      <p className="text-[#e67e22] text-sm">{item.price.toLocaleString()} د.ع</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-slate-700 px-3 py-1.5 rounded-xl">
                      <span className="font-bold text-gray-700 dark:text-slate-300">{item.quantity}×</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Info */}
        <div className="stagger-2 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-3">معلومات الطلب</h3>
          {[
            { value: name, set: setName, placeholder: 'الاسم *', type: 'text' },
            { value: phone, set: setPhone, placeholder: 'رقم الهاتف *', type: 'tel' },
            { value: address, set: setAddress, placeholder: 'العنوان', type: 'text' },
            { value: note, set: setNote, placeholder: 'ملاحظات (اختياري)', type: 'text' },
          ].map(({ value, set, placeholder, type }) => (
            <input key={placeholder} type={type} value={value} onChange={e => set(e.target.value)}
              placeholder={placeholder} dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#e67e22] mb-3 last:mb-0"
            />
          ))}
        </div>

        {/* Total + Button */}
        <div className="stagger-3">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 flex justify-between items-center mb-4">
            <span className="text-[#e67e22] font-bold text-xl">{total.toLocaleString()} د.ع</span>
            <span className="font-bold text-gray-900 dark:text-slate-100">الإجمالي</span>
          </div>
          <button onClick={handleConfirm} disabled={items.length === 0}
            className="w-full bg-[#e67e22] hover:bg-[#d35400] disabled:opacity-40 text-white font-bold py-4 rounded-xl text-lg transition-all active:scale-95">
            تأكيد الطلب
          </button>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-center text-[#944a00] mb-2">تأكيد رقم الهاتف</h3>
            <p className="text-gray-500 dark:text-slate-400 text-center text-sm mb-5">تأكد أن رقمك صحيح قبل الإرسال</p>
            <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-[#e67e22] rounded-xl p-4 text-center mb-5">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">رقم هاتفك</p>
              <p className="text-2xl font-bold text-[#e67e22] tracking-widest">{phone}</p>
            </div>
            <button onClick={submitOrder} disabled={loading}
              className="w-full bg-[#e67e22] text-white font-bold py-3.5 rounded-xl mb-3 transition-all active:scale-95 disabled:opacity-60">
              {loading ? 'جاري الإرسال...' : 'نعم، الرقم صحيح — أرسل الطلب'}
            </button>
            <button onClick={() => setShowConfirm(false)}
              className="w-full border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 font-semibold py-3 rounded-xl transition-all active:scale-95">
              تعديل الرقم
            </button>
          </div>
        </div>
      )}

      <ClientBottomNav />
    </div>
  );
}
