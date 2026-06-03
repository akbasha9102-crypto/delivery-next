'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminBottomNav } from '@/components/BottomNav';
import { Moon, Sun, LogOut, ChevronRight, ChevronLeft } from 'lucide-react';

type OrderItem = { id: string; item_name: string; quantity: number; price: number };
type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; client_note: string | null; total_amount: number; status: 'pending' | 'preparing' | 'ready' | 'completed'; created_at: string; items?: OrderItem[] };

const STATUS = {
  pending:   { label: 'واردة',        next: 'preparing' as const, nextLabel: 'ابدأ التجهيز',  color: '#f59e0b', dot: 'bg-yellow-400', btnColor: '#3b82f6' },
  preparing: { label: 'قيد التجهيز', next: 'ready'     as const, nextLabel: 'جاهز للتسليم', color: '#3b82f6', dot: 'bg-blue-400',   btnColor: '#22c55e' },
  ready:     { label: 'جاهز',        next: 'completed'  as const, nextLabel: 'تم التسليم',   color: '#22c55e', dot: 'bg-green-400',  btnColor: '#6b7280' },
  completed: { label: 'مكتمل',       next: null,                  nextLabel: '',              color: '#9ca3af', dot: 'bg-gray-400',   btnColor: '#9ca3af' },
};

function makeBellWavUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const sr = 22050, dur = 0.9, n = (sr * dur) | 0;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const t = i / sr, hz = t < 0.42 ? 880 : 587;
      const env = t < 0.42 ? Math.exp(-t * 4) : Math.exp(-(t - 0.42) * 4);
      v.setInt16(44 + i * 2, (Math.sin(2 * Math.PI * hz * t) * env * 0.4 * 32767) | 0, true);
    }
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  } catch { return null; }
}

// وقت الانتظار مع لون حسب المدة
function waitInfo(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 10) return { color: '#22c55e', text: `${mins} د` };
  if (mins < 20) return { color: '#f59e0b', text: `${mins} د` };
  return { color: '#ef4444', text: `${mins} د ⚠️` };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(); yest.setDate(yest.getDate() - 1); yest.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return 'اليوم';
  if (d.getTime() === yest.getTime()) return 'أمس';
  return d.toLocaleDateString('ar-IQ', { weekday: 'short', day: 'numeric', month: 'short' });
}

function DashboardPage() {
  const router = useRouter();
  const { dark, toggleDark } = useDarkMode();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'preparing' | 'ready' | 'completed'>('pending');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [, setTick] = useState(0);

  const bellRef = useRef<HTMLAudioElement | null>(null);
  const initialLoadDone = useRef(false);
  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  // إعداد الجرس
  useEffect(() => {
    const url = makeBellWavUrl();
    if (!url) return;
    bellRef.current = new Audio(url);
    bellRef.current.volume = 0.8;
    const unlock = () => {
      bellRef.current?.play().then(() => { bellRef.current!.pause(); bellRef.current!.currentTime = 0; }).catch(() => {});
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => { document.removeEventListener('click', unlock); document.removeEventListener('touchstart', unlock); };
  }, []);

  // تحديث وقت الانتظار كل دقيقة
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const fetchOrders = useCallback(async () => {
    const start = new Date(selectedDate + 'T00:00:00').toISOString();
    const end   = new Date(selectedDate + 'T23:59:59').toISOString();
    const { data } = await supabase
      .from('orders').select('*')
      .gte('created_at', start).lte('created_at', end)
      .order('created_at', { ascending: false }).limit(200);
    if (!data) { setLoading(false); return; }
    const withItems = await Promise.all(data.map(async o => {
      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', o.id);
      return { ...o, items: items || [] };
    }));
    setOrders(withItems);
    setLoading(false);
    initialLoadDone.current = true;
  }, [selectedDate]);

  useEffect(() => { setLoading(true); fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!isToday) return;
    const ch = supabase.channel('dash-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        if (initialLoadDone.current) {
          setNewOrderFlash(true);
          setTimeout(() => setNewOrderFlash(false), 4000);
          if (bellRef.current) { bellRef.current.currentTime = 0; bellRef.current.play().catch(() => {}); }
        }
        fetchOrders();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders, isToday]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as Order['status'] } : o));
  };

  const logout = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    if (d <= new Date()) setSelectedDate(d.toISOString().split('T')[0]);
  };

  const filtered   = orders.filter(o => o.status === filter);
  const counts     = { pending: 0, preparing: 0, ready: 0, completed: 0 };
  orders.forEach(o => counts[o.status]++);
  const todayRevenue  = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 pb-24">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={toggleDark} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 active:scale-90 transition-all">
            {dark ? <Sun size={16} className="text-yellow-400" /> : <Moon size={16} className="text-gray-600" />}
          </button>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-sm font-bold active:scale-90 transition-all border border-red-200 dark:border-red-800">
            <LogOut size={14} /> خروج
          </button>
        </div>
        <p className="font-bold text-gray-900 dark:text-slate-100">اللوحة</p>
        <div className="w-20" />
      </header>

      {/* إشعار طلب جديد */}
      {newOrderFlash && (
        <div className="bg-green-500 px-4 py-3 text-center animate-pulse">
          <p className="text-white font-bold text-base">🔔 طلب جديد وصل!</p>
        </div>
      )}

      {/* إحصاء اليوم */}
      <div className="grid grid-cols-4 gap-2 px-3 pt-3 pb-2">
        {[
          { val: counts.pending,   label: 'جديد',    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)' },
          { val: counts.preparing, label: 'تجهيز',   color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)' },
          { val: counts.ready,     label: 'جاهز',    color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)' },
          { val: counts.completed, label: 'مكتمل',   color: '#9ca3af', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.25)' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-2.5 text-center border" style={{ backgroundColor: s.bg, borderColor: s.border }}>
            <p className="font-bold text-2xl" style={{ color: s.color }}>{s.val}</p>
            <p className="text-xs mt-0.5 opacity-75" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* إجمالي الإيراد */}
      <div className="mx-3 mb-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-2xl px-4 py-2.5 flex justify-between items-center">
        <p className="text-orange-500 font-bold text-lg">{todayRevenue.toLocaleString()} <span className="text-xs font-normal text-orange-400">د.ع</span></p>
        <p className="text-orange-400 text-sm font-bold">إجمالي {isToday ? 'اليوم' : formatDate(selectedDate)}</p>
      </div>

      {/* التنقل بين الأيام */}
      <div className="flex items-center justify-between px-3 mb-3 bg-white dark:bg-slate-800 mx-3 rounded-2xl border border-gray-100 dark:border-slate-700 py-2">
        <button onClick={() => changeDate(+1)} disabled={isToday}
          className="p-2 rounded-xl disabled:opacity-30 text-gray-500 dark:text-slate-400 active:scale-90 transition-all">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <input type="date" value={selectedDate} max={today}
            onChange={e => setSelectedDate(e.target.value)}
            className="opacity-0 absolute w-0 h-0" id="date-picker" />
          <label htmlFor="date-picker" className="cursor-pointer font-bold text-gray-800 dark:text-slate-100 text-base">
            {formatDate(selectedDate)}
          </label>
          {!isToday && (
            <button onClick={() => setSelectedDate(today)}
              className="text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-500 px-2 py-1 rounded-lg font-bold">
              اليوم
            </button>
          )}
        </div>
        <button onClick={() => changeDate(-1)} className="p-2 rounded-xl text-gray-500 dark:text-slate-400 active:scale-90 transition-all">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* تابس الفلتر */}
      <div className="flex gap-2 px-3 pb-3 overflow-x-auto">
        {(['pending', 'preparing', 'ready', 'completed'] as const).map(tab => {
          const active = filter === tab;
          const count  = counts[tab];
          return (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-all active:scale-95 ${active ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
              {STATUS[tab].label}{count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* الطلبات */}
      <div className="px-3">
        {loading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center mt-20"><p className="text-4xl mb-3">📋</p><p className="text-gray-400 dark:text-slate-500">لا توجد طلبات</p></div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const cfg  = STATUS[order.status];
              const wait = order.status !== 'completed' ? waitInfo(order.created_at) : null;
              return (
                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                  <div className="h-1.5" style={{ backgroundColor: cfg.color }} />
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-50 dark:border-slate-700">
                      <div className="flex flex-col gap-1">
                        {/* وقت الانتظار */}
                        {wait && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: wait.color }} />
                            <span className="text-xs font-bold" style={{ color: wait.color }}>{wait.text}</span>
                          </div>
                        )}
                        <p className="text-green-500 font-bold text-lg">{order.total_amount.toLocaleString()} <span className="text-xs text-gray-400 font-normal">د.ع</span></p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-slate-100 text-base">{order.client_name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{order.client_phone}</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 mb-3 space-y-2">
                      {order.items?.map(item => (
                        <div key={item.id} className="flex justify-between items-center">
                          <span className="text-[#f97316] font-bold text-sm">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-800 dark:text-slate-200 text-sm">{item.item_name}</span>
                            <span className="bg-white dark:bg-slate-600 text-gray-600 dark:text-slate-300 text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center">{item.quantity}×</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.delivery_address && <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">📍 {order.delivery_address}</p>}
                    {order.client_note && <p className="text-sm text-amber-600 dark:text-amber-400 text-right">📝 {order.client_note}</p>}
                  </div>

                  {cfg.next ? (
                    <button onClick={() => updateStatus(order.id, cfg.next!)}
                      className="w-full py-4 text-white font-bold text-base transition-all active:opacity-80"
                      style={{ backgroundColor: cfg.btnColor }}>
                      {cfg.nextLabel}
                    </button>
                  ) : (
                    <div className="w-full py-4 bg-gray-100 dark:bg-slate-700 text-center text-gray-400 dark:text-slate-500 font-bold text-sm">
                      ✓ مكتمل
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

export default function DashboardPageGuarded() {
  return <AdminGuard><DashboardPage /></AdminGuard>;
}
