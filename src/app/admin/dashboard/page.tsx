'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminBottomNav } from '@/components/BottomNav';
import { Moon, Sun, LogOut } from 'lucide-react';

type OrderItem = { id: string; item_name: string; quantity: number; price: number };
type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; client_note: string | null; total_amount: number; status: 'pending' | 'preparing' | 'ready' | 'completed'; created_at: string; items?: OrderItem[] };

const STATUS = {
  pending:   { label: 'جديد',        next: 'preparing' as const, nextLabel: 'ابدأ التجهيز',  color: '#eab308', dot: 'bg-yellow-400' },
  preparing: { label: 'قيد التجهيز', next: 'ready'    as const, nextLabel: 'جاهز للتسليم', color: '#3b82f6', dot: 'bg-blue-400' },
  ready:     { label: 'جاهز',        next: 'completed' as const, nextLabel: 'تم التسليم',    color: '#22c55e', dot: 'bg-green-400' },
  completed: { label: 'مكتمل',       next: null,                 nextLabel: '',              color: '#9ca3af', dot: 'bg-gray-400' },
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `منذ ${s} ث`;
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  return `منذ ${Math.floor(s / 3600)} س`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { dark, toggleDark } = useDarkMode();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'preparing' | 'ready' | 'completed'>('all');

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
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
    const ch = supabase.channel('dash-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as Order['status'] } : o));
  };

  const logout = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const pending = orders.filter(o => o.status === 'pending').length;
  const preparing = orders.filter(o => o.status === 'preparing').length;
  const ready = orders.filter(o => o.status === 'ready').length;
  const todayTotal = orders.filter(o => o.status === 'completed' && new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-3 flex items-center justify-between stagger-0">
        <div className="flex items-center gap-2">
          <button onClick={toggleDark} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 active:scale-90 transition-all">
            {dark ? <Sun size={16} className="text-yellow-400" /> : <Moon size={16} className="text-gray-600" />}
          </button>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-sm font-bold active:scale-90 transition-all border border-red-200 dark:border-red-800">
            <LogOut size={14} /> خروج
          </button>
        </div>
        <div className="text-center">
          <p className="font-bold text-gray-900 dark:text-slate-100">🍽️ لوحة الكاشير</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">تحديث فوري</p>
        </div>
        <a href="/admin/menu" className="px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-[#f97316] text-sm font-bold border border-orange-200 dark:border-orange-800 active:scale-90 transition-all">المنيو</a>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 px-3 py-3 stagger-1">
        {[
          { val: pending,   label: 'جديدة',      color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800' },
          { val: preparing, label: 'تجهيز',      color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' },
          { val: ready,     label: 'جاهزة',      color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' },
          { val: todayTotal, label: 'الإيراد',   color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800', small: true },
        ].map(({ val, label, color, bg, small }) => (
          <div key={label} className={`${bg} border rounded-2xl p-2.5 text-center`}>
            <p className={`${color} font-bold ${small ? 'text-sm' : 'text-2xl'}`}>{typeof val === 'number' && small ? val.toLocaleString() : val}</p>
            <p className={`${color} text-xs mt-0.5 opacity-70`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-3 pb-3 overflow-x-auto stagger-2">
        {(['all', 'pending', 'preparing', 'ready', 'completed'] as const).map(tab => {
          const active = filter === tab;
          const count = tab !== 'all' && tab !== 'completed' ? orders.filter(o => o.status === tab).length : 0;
          return (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-all active:scale-95 ${active ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
              {tab === 'all' ? 'الكل' : STATUS[tab].label}{count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Orders */}
      <div className="px-3 stagger-3">
        {loading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center mt-20"><p className="text-4xl mb-3">📋</p><p className="text-gray-400 dark:text-slate-500">لا توجد طلبات</p></div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const cfg = STATUS[order.status];
              return (
                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                  <div className="h-1" style={{ backgroundColor: cfg.color }} />
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-50 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                        <span className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">{timeAgo(order.created_at)}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-slate-100">{order.client_name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{order.client_phone}</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      {order.items?.map(item => (
                        <div key={item.id} className="flex justify-between items-center py-1.5 border-b border-gray-50 dark:border-slate-700/50 last:border-0">
                          <span className="text-[#f97316] font-bold text-sm">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-800 dark:text-slate-200 text-sm">{item.item_name}</span>
                            <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 text-xs font-bold px-2 py-0.5 rounded-lg">{item.quantity}×</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.delivery_address && <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">📍 {order.delivery_address}</p>}
                    {order.client_note && <p className="text-xs text-yellow-600 dark:text-yellow-400 text-right mb-3">📝 {order.client_note}</p>}

                    <div className="flex justify-between items-center pt-2 border-t border-gray-50 dark:border-slate-700">
                      {cfg.next ? (
                        <button onClick={() => updateStatus(order.id, cfg.next!)}
                          className="bg-[#f97316] hover:bg-[#ea6c00] text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all active:scale-95">
                          {cfg.nextLabel}
                        </button>
                      ) : (
                        <span className="bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 font-bold px-4 py-2.5 rounded-xl text-sm">✓ مكتمل</span>
                      )}
                      <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">{order.total_amount.toLocaleString()} <span className="text-xs text-gray-400 dark:text-slate-500">د.ع</span></p>
                    </div>
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
