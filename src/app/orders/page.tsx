'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { useSettings } from '@/context/SettingsContext';
import { useDarkMode } from '@/context/ThemeContext';
import { ShoppingBag, RefreshCw, X, CheckCircle2, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type OrderItem = { id: string; order_id: string; item_name: string; quantity: number; price: number };
type Order = {
  id: string; client_name: string; client_phone: string;
  delivery_address: string | null; total_amount: number;
  status: string; created_at: string;
  client_lat?: number | null; client_lng?: number | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'قيد الانتظار', color: '#f59e0b' },
  preparing: { label: 'جاري التجهيز', color: '#3b82f6' },
  ready:     { label: 'في الطريق',    color: '#8b5cf6' },
  completed: { label: 'تم التوصيل',   color: '#10b981' },
  rejected:  { label: 'مرفوض',        color: '#ef4444' },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  const day   = d.getDate();
  const month = d.getMonth() + 1;
  const h     = d.getHours();
  const m     = d.getMinutes().toString().padStart(2, '0');
  const ampm  = h >= 12 ? 'م' : 'ص';
  const h12   = h % 12 || 12;
  return `${day}/${month} - ${h12}:${m} ${ampm}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const { primary_color } = useSettings();
  const { dark } = useDarkMode();

  const rawColor   = primary_color || '#e67e22';
  const isTooDark  = rawColor === '#000000' || rawColor.toLowerCase() === '#121212';
  const brandColor = dark && isTooDark ? '#ffffff' : rawColor;

  const [phone,      setPhone]      = useState('');
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [itemsMap,   setItemsMap]   = useState<Record<string, OrderItem[]>>({});
  const [loading,    setLoading]    = useState(true);

  const [reorderTarget, setReorderTarget] = useState<Order | null>(null);
  const [reorderItems,  setReorderItems]  = useState<OrderItem[]>([]);
  const [submitting,    setSubmitting]    = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('deliveryPhone') || '';
    setPhone(saved);
    if (saved) fetchOrders(saved);
    else setLoading(false);
  }, []);

  const fetchOrders = async (ph: string) => {
    setLoading(true);
    const { data: rows } = await supabase
      .from('orders')
      .select('*')
      .eq('client_phone', ph)
      .order('created_at', { ascending: false })
      .limit(30);

    if (rows && rows.length > 0) {
      setOrders(rows);
      const ids = rows.map((o: Order) => o.id);
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', ids);
      if (items) {
        const grouped: Record<string, OrderItem[]> = {};
        for (const item of items as OrderItem[]) {
          if (!grouped[item.order_id]) grouped[item.order_id] = [];
          grouped[item.order_id].push(item);
        }
        setItemsMap(grouped);
      }
    } else {
      setOrders([]);
    }
    setLoading(false);
  };

  const openReorder = (order: Order) => {
    setReorderTarget(order);
    setReorderItems(itemsMap[order.id] || []);
  };

  const confirmReorder = async () => {
    if (!reorderTarget) return;
    setSubmitting(true);

    const name = localStorage.getItem('deliveryName') || reorderTarget.client_name;
    const nick = localStorage.getItem('deliveryNickname') || '';
    const ph   = localStorage.getItem('deliveryPhone')   || reorderTarget.client_phone;
    const addr = localStorage.getItem('deliveryAddressDetails') || reorderTarget.delivery_address || '';
    const lat  = reorderTarget.client_lat  ?? null;
    const lng  = reorderTarget.client_lng  ?? null;

    const clientName = nick ? `${name} (${nick})` : name;
    const total      = reorderItems.reduce((s, i) => s + i.price * i.quantity, 0);

    const { data: order, error } = await supabase.from('orders').insert([{
      client_name:      clientName,
      client_phone:     ph,
      delivery_address: addr || null,
      total_amount:     total,
      status:           'pending',
      ...(lat && lng ? { client_lat: lat, client_lng: lng } : {}),
    }]).select().single();

    if (error || !order) {
      alert('حدث خطأ، حاول مجدداً');
      setSubmitting(false);
      return;
    }

    await supabase.from('order_items').insert(
      reorderItems.map(i => ({
        order_id:  order.id,
        item_name: i.item_name,
        quantity:  i.quantity,
        price:     i.price,
      }))
    );

    localStorage.setItem('lastOrderId', order.id);
    setSubmitting(false);
    setReorderTarget(null);
    router.push('/track');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-center text-gray-900 dark:text-white">طلباتي</h1>
      </header>

      <div className="px-4 pt-5">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: brandColor, borderTopColor: 'transparent' }}/>
          </div>
        ) : !phone || orders.length === 0 ? (
          <div className="text-center mt-20">
            <div className="text-5xl mb-4">🛍️</div>
            <p className="text-gray-500 dark:text-slate-400 font-semibold">لا توجد طلبات سابقة</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">طلباتك ستظهر هنا بعد أول طلب</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const items = itemsMap[order.id] || [];
              const st    = STATUS_LABELS[order.status] || { label: order.status, color: '#9ca3af' };
              return (
                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">

                  {/* Header: date + status + total */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50 dark:border-slate-700">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: `${st.color}18`, color: st.color }}>
                      {st.label}
                    </span>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white text-sm">
                        {order.total_amount.toLocaleString()} د.ع
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{fmtDate(order.created_at)}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="px-4 py-3 space-y-1.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm" dir="rtl">
                        <span className="text-gray-400 dark:text-slate-500">
                          {(item.price * item.quantity).toLocaleString()} د.ع
                        </span>
                        <span className="text-gray-900 dark:text-slate-100 font-medium">
                          {item.item_name} <span className="text-gray-400 font-normal">×{item.quantity}</span>
                        </span>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 text-right">—</p>
                    )}
                  </div>

                  {/* Reorder button */}
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => openReorder(order)}
                      className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                      style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 12px #ef444435' }}>
                      <RefreshCw size={15}/>
                      اطلب مجددا
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Reorder confirmation sheet ── */}
      <AnimatePresence>
      {reorderTarget && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="w-full bg-white dark:bg-slate-900 rounded-t-3xl overflow-hidden">

            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700"/>
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-slate-700">
              <button
                onClick={() => setReorderTarget(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 active:scale-90 transition-all">
                <X size={17}/>
              </button>
              <p className="font-bold text-gray-900 dark:text-white">تأكيد الطلب</p>
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ef444418' }}>
                <ShoppingBag size={17} style={{ color: '#ef4444' }}/>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Items */}
              <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-end gap-1.5 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                  <p className="text-xs font-bold text-gray-500 dark:text-slate-400">الأصناف</p>
                  <ShoppingBag size={13} className="text-gray-400"/>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                  {reorderItems.map((item, idx) => (
                    <div key={idx} className="px-4 py-2.5 flex items-center justify-between" dir="rtl">
                      <span className="font-bold text-sm" style={{ color: '#ef4444' }}>
                        {(item.price * item.quantity).toLocaleString()} د.ع
                      </span>
                      <span className="text-gray-900 dark:text-slate-100 text-sm">
                        {item.item_name} <span className="text-gray-400">×{item.quantity}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800" dir="rtl">
                  <span className="font-black text-lg" style={{ color: '#ef4444' }}>
                    {reorderItems.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()} د.ع
                  </span>
                  <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">المجموع</span>
                </div>
              </div>

              {/* Customer info */}
              <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 space-y-2 text-right">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{reorderTarget.client_name}</span>
                  <span className="text-gray-400 dark:text-slate-500 text-xs">الاسم</span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-100 dark:border-slate-700 pt-2">
                  <span className="font-bold text-sm" style={{ color: '#ef4444' }}>{reorderTarget.client_phone}</span>
                  <span className="text-gray-400 dark:text-slate-500 text-xs">الهاتف</span>
                </div>
                {reorderTarget.delivery_address && (
                  <div className="flex justify-between items-center border-t border-gray-100 dark:border-slate-700 pt-2">
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{reorderTarget.delivery_address}</span>
                    <span className="text-gray-400 dark:text-slate-500 text-xs">العنوان</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pt-2 pb-8 space-y-3">
              <button
                onClick={confirmReorder}
                disabled={submitting}
                className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', boxShadow: '0 8px 24px #ef444450' }}>
                {submitting
                  ? <><Loader2 size={20} className="animate-spin"/> جاري الإرسال...</>
                  : <><CheckCircle2 size={20}/> تأكيد وإرسال الطلب</>
                }
              </button>
              <button
                onClick={() => setReorderTarget(null)}
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 active:scale-95 transition-all">
                إلغاء
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <ClientBottomNav />
    </div>
  );
}
