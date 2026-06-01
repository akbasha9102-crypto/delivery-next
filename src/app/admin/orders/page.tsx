'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminBottomNav } from '@/components/BottomNav';
import { AdminGuard } from '@/components/AdminGuard';

type OrderItem = { id: string; item_name: string; quantity: number; price: number };
type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; client_note: string | null; total_amount: number; status: 'pending' | 'preparing' | 'ready' | 'completed'; created_at: string; items?: OrderItem[] };

const STATUS = {
  pending:   { label: 'واردة',        bg: 'bg-yellow-500',  next: 'preparing' as const, nextLabel: 'ابدأ التجهيز' },
  preparing: { label: 'قيد التجهيز', bg: 'bg-blue-500',    next: 'ready'    as const, nextLabel: 'جاهز للتسليم' },
  ready:     { label: 'جاهز',         bg: 'bg-green-500',   next: 'completed' as const, nextLabel: 'تم التسليم' },
  completed: { label: 'مكتمل',        bg: 'bg-gray-400',    next: null,                 nextLabel: '' },
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `منذ ${s} ث`;
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  return `منذ ${Math.floor(s / 3600)} س`;
}

const TABS = [
  { id: 'pending'   as const, name: 'واردة' },
  { id: 'preparing' as const, name: 'تجهيز' },
  { id: 'ready'     as const, name: 'جاهز' },
  { id: 'completed' as const, name: 'مكتمل' },
];

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'preparing' | 'ready' | 'completed'>('pending');

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
    if (!data) { setLoading(false); return; }
    const withItems = await Promise.all(data.map(async o => {
      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', o.id);
      return { ...o, items: items || [] };
    }));
    setOrders(withItems);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const ch = supabase.channel('orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  const advance = async (order: Order) => {
    const next = STATUS[order.status].next;
    if (!next) return;
    await supabase.from('orders').update({ status: next }).eq('id', order.id);
    fetchOrders();
  };

  const filtered = orders.filter(o => o.status === tab);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 stagger-0">
        <div className="px-4 py-4 text-center">
          <h1 className="text-xl font-bold text-[#2563eb]">الطلبات الحية</h1>
        </div>
        <div className="flex border-b border-gray-100 dark:border-slate-700">
          {TABS.map(t => {
            const count = orders.filter(o => o.status === t.id).length;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-3 text-center transition-all border-b-2 ${tab === t.id ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-gray-400 dark:text-slate-500'}`}>
                <span className="text-sm font-bold">{t.name}</span>
                {count > 0 && (
                  <span className={`ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${t.id === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400'}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <div className="px-4 pt-4 stagger-1">
        {loading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-slate-500 mt-20">لا توجد طلبات</p>
        ) : (
          <div className="space-y-4">
            {filtered.map(order => {
              const cfg = STATUS[order.status];
              return (
                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
                  <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-50 dark:border-slate-700">
                    <span className={`${cfg.bg} text-white text-xs font-bold px-3 py-1 rounded-full`}>{cfg.label}</span>
                    <span className="text-gray-400 dark:text-slate-500 text-sm">{timeAgo(order.created_at)}</span>
                  </div>
                  <p className="font-bold text-lg text-right text-gray-900 dark:text-slate-100">{order.client_name}</p>
                  <p className="text-gray-500 dark:text-slate-400 text-right text-sm mb-2">{order.client_phone}{order.delivery_address ? ` — ${order.delivery_address}` : ''}</p>
                  {order.client_note && <p className="text-orange-500 text-right text-sm mb-2">📝 {order.client_note}</p>}
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3 mb-3 space-y-1">
                    {order.items?.map(i => (
                      <p key={i.id} className="text-right text-sm text-gray-700 dark:text-slate-300">{i.quantity}× {i.item_name}</p>
                    ))}
                  </div>
                  <div className="flex justify-between items-center">
                    {cfg.next ? (
                      <button onClick={() => advance(order)} className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-4 py-2 rounded-xl text-sm transition-all active:scale-95">{cfg.nextLabel}</button>
                    ) : <div />}
                    <p className="font-bold text-green-600 dark:text-green-400 text-lg">{order.total_amount.toLocaleString()} د.ع</p>
                  </div>
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

export default function OrdersPageGuarded() {
  return <AdminGuard><OrdersPage /></AdminGuard>;
}
