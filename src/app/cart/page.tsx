'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { Trash2, MapPin, ChevronDown } from 'lucide-react';

const PHONE_KEY = 'deliveryPhone';

const BASRA_DISTRICTS = [
  { id: 'ashar',      name: 'العشار',      desc: 'قلب البصرة التجاري والاقتصادي' },
  { id: 'maqal',      name: 'المعقل',      desc: 'حي راقٍ شمال البصرة على ضفاف شط العرب' },
  { id: 'qibla',      name: 'القبلة',      desc: 'الحي التاريخي العريق وسط المدينة' },
  { id: 'jazira',     name: 'الجزيرة',     desc: 'منطقة هادئة بين الأنهار قريبة من المركز' },
  { id: 'asmai',      name: 'الأصمعي',     desc: 'حي سكني شعبي غرب مركز المدينة' },
  { id: 'jazayer',    name: 'الجزائر',     desc: 'حي شعبي بين العشار والمعقل' },
  { id: 'haritha',    name: 'الهارثة',     desc: 'شمال البصرة على ضفاف شط العرب' },
  { id: 'zubayr',     name: 'الزبير',      desc: 'قضاء تاريخي جنوب غرب البصرة' },
  { id: 'abu_khasib', name: 'أبو الخصيب', desc: 'جنوب البصرة، منطقة النخيل والأنهار الجميلة' },
  { id: 'tanuma',     name: 'التنومة',     desc: 'حي شرق البصرة بالقرب من أبو الخصيب' },
  { id: 'qurna',      name: 'القرنة',      desc: 'شمال البصرة عند ملتقى دجلة والفرات' },
  { id: 'faw',        name: 'الفاو',       desc: 'أقصى جنوب البصرة على الخليج العربي' },
  { id: 'madina',     name: 'المدينة',     desc: 'المنطقة الإدارية والمركزية في البصرة' },
  { id: 'khor',       name: 'خور الزبير', desc: 'منطقة صناعية وميناء جنوب الزبير' },
] as const;

export default function CartPage() {
  const { items, removeItem, clearCart, total } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(PHONE_KEY);
    if (saved) setPhone(saved);
  }, []);

  const selectedDistrict = BASRA_DISTRICTS.find(d => d.id === district);

  const fullAddress = selectedDistrict
    ? `${selectedDistrict.name}${address.trim() ? ' — ' + address.trim() : ''}`
    : address.trim() || null;

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
      delivery_address: fullAddress, client_note: note.trim() || null,
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
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">تم إرسال طلبك!</h2>
          <p className="text-gray-500 dark:text-slate-400 mb-6">سيتم التواصل معك قريباً</p>
          <Link href="/track" className="bg-[#e67e22] text-white font-bold px-6 py-3 rounded-xl inline-block">تتبع طلبك</Link>
        </div>
        <ClientBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-[#944a00] text-center">سلة المشتريات</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Items */}
        <div>
          {items.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-slate-500 mt-16">السلة فارغة</p>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 flex items-center justify-between">
                  <button onClick={() => removeItem(item.id)} className="p-2 bg-red-50 dark:bg-red-900/20 rounded-full text-red-400 active:scale-90">
                    <Trash2 size={16}/>
                  </button>
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-3">معلومات الطلب</h3>

          {/* Name */}
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="الاسم *" dir="rtl"
            className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#e67e22] mb-3"
          />

          {/* Phone */}
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="رقم الهاتف *" dir="rtl"
            className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#e67e22] mb-3"
          />

          {/* District picker */}
          <div className="mb-3">
            <div className="relative">
              <select value={district} onChange={e => setDistrict(e.target.value)} dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#e67e22] appearance-none">
                <option value="">اختر منطقة التوصيل</option>
                {BASRA_DISTRICTS.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            </div>

            {selectedDistrict && (
              <div className="mt-2 bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800/40 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
                <MapPin size={14} className="text-[#e67e22] flex-shrink-0"/>
                <p className="text-sm text-gray-600 dark:text-slate-400 text-right flex-1">{selectedDistrict.desc}</p>
              </div>
            )}
          </div>

          {/* Address detail */}
          <input type="text" value={address} onChange={e => setAddress(e.target.value)}
            placeholder="تفاصيل العنوان (شارع، زقاق...)" dir="rtl"
            className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#e67e22] mb-3"
          />

          {/* Note */}
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="ملاحظات (اختياري)" dir="rtl"
            className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#e67e22]"
          />
        </div>

        {/* Total + Button */}
        <div>
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
