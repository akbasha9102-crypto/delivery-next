'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { Search } from 'lucide-react';

const STEPS = [
  { key: 'pending',   label: 'استلام',   icon: '📋', desc: 'تم استلام طلبك وسيبدأ التجهيز' },
  { key: 'preparing', label: 'تجهيز',    icon: '👨‍🍳', desc: 'طلبك قيد التجهيز الآن' },
  { key: 'ready',     label: 'جاهز',     icon: '✅', desc: 'طلبك جاهز وفي طريقه إليك' },
  { key: 'completed', label: 'تم',       icon: '🎉', desc: 'تم توصيل طلبك بنجاح' },
];

type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; total_amount: number; status: string; created_at: string };

export default function TrackPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [inputPhone, setInputPhone] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async (phone: string) => {
    if (!phone) { setLoading(false); setNotFound(true); return; }
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('client_phone', phone)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) { setOrder(data); setNotFound(false); }
    else { setOrder(null); setNotFound(true); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('deliveryPhone') || localStorage.getItem('lastOrderPhone') || '';
    setInputPhone(saved);
    fetchOrder(saved);
  }, [fetchOrder]);

  useEffect(() => {
    if (!order) return;
    const channel = supabase.channel('track-order')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        payload => setOrder(payload.new as Order))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [order?.id]);

  const stepIndex = (status: string) => STEPS.findIndex(s => s.key === status);
  const current = order ? stepIndex(order.status) : -1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 stagger-0">
        <h1 className="text-xl font-bold text-[#944a00] text-center">تتبع طلبك</h1>
      </header>

      <div className="px-4 pt-5">
        {loading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#e67e22] border-t-transparent rounded-full animate-spin" /></div>
        ) : notFound ? (
          <div className="text-center mt-16 stagger-1">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">لا يوجد طلب حالي</h2>
            <p className="text-gray-500 dark:text-slate-400 mb-6 text-sm">ابحث عن طلبك برقم هاتفك</p>
            <div className="flex gap-2 max-w-sm mx-auto">
              <button onClick={() => fetchOrder(inputPhone)} className="bg-[#e67e22] text-white px-4 py-3 rounded-xl font-bold active:scale-95 transition-all">
                <Search size={18} />
              </button>
              <input value={inputPhone} onChange={e => setInputPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchOrder(inputPhone)}
                placeholder="ادخل رقم هاتفك" dir="rtl"
                className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#e67e22]"
              />
            </div>
          </div>
        ) : order && (
          <div className="space-y-4 max-w-lg mx-auto">
            {/* Timeline */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 stagger-1">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-6">حالة الطلب</h3>
              <div className="flex items-center mb-3">
                {STEPS.map((step, idx) => (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all ${
                        idx <= current ? 'bg-[#e67e22] shadow-lg shadow-orange-200 dark:shadow-orange-900/50' : 'bg-gray-100 dark:bg-slate-700'
                      } ${idx === current ? 'ring-2 ring-[#944a00] ring-offset-2 dark:ring-offset-slate-800' : ''}`}>
                        {step.icon}
                      </div>
                      <span className={`text-xs mt-1 font-medium ${idx <= current ? 'text-[#e67e22]' : 'text-gray-400 dark:text-slate-500'}`}>{step.label}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`flex-1 h-1 rounded mx-1 ${idx < current ? 'bg-[#e67e22]' : 'bg-gray-100 dark:bg-slate-700'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-orange-50 dark:bg-orange-900/10 border-2 border-[#e67e22] rounded-2xl p-5 text-center stagger-2">
              <div className="text-4xl mb-2">{STEPS[current]?.icon}</div>
              <p className="text-[#e67e22] font-bold text-lg mb-1">{STEPS[current]?.label}</p>
              <p className="text-gray-500 dark:text-slate-400 text-sm">{STEPS[current]?.desc}</p>
            </div>

            {/* Order Details */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 stagger-3">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-4">تفاصيل الطلب</h3>
              {[
                { label: 'الاسم', value: order.client_name },
                { label: 'العنوان', value: order.delivery_address || '—' },
                { label: 'الإجمالي', value: `${order.total_amount.toLocaleString()} د.ع` },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-3 border-b border-gray-50 dark:border-slate-700 last:border-0">
                  <span className="text-[#e67e22] font-semibold">{row.value}</span>
                  <span className="text-gray-500 dark:text-slate-400 text-sm">{row.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ClientBottomNav />
    </div>
  );
}
