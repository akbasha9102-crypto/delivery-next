'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminBottomNav } from '@/components/BottomNav';
import { Moon, Sun, LogOut, X, Clock } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';

type OrderItem = { id: string; item_name: string; quantity: number; price: number };
type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; client_note: string | null; total_amount: number; status: 'pending' | 'preparing' | 'ready' | 'completed'; created_at: string; items?: OrderItem[]; driver_name?: string | null; driver_phone?: string | null };
type Driver = { id: string; name: string; phone: string; status: string };

const STATUS = {
  pending:   { label: 'واردة',        next: 'preparing' as const, nextLabel: 'ابدأ التجهيز',  color: '#f59e0b', dot: 'bg-yellow-400', btnColor: '#3b82f6' },
  preparing: { label: 'قيد التجهيز', next: 'ready'     as const, nextLabel: 'جاهز للتسليم', color: '#3b82f6', dot: 'bg-blue-400',   btnColor: '#22c55e' },
  ready:     { label: 'جاهز',        next: 'completed'  as const, nextLabel: 'تم التسليم',   color: '#22c55e', dot: 'bg-green-400',  btnColor: '#6b7280' },
  completed: { label: 'مكتمل',       next: null,                  nextLabel: '',              color: '#9ca3af', dot: 'bg-gray-400',   btnColor: '#9ca3af' },
};

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function waitInfo(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 10) return { color: '#22c55e', text: `${mins} د` };
  if (mins < 20) return { color: '#f59e0b', text: `${mins} د` };
  return { color: '#ef4444', text: `${mins} د ⚠️` };
}

function formatDateLabel(dateStr: string) {
  const d    = new Date(dateStr + 'T00:00:00');
  const now  = new Date(); now.setHours(0,0,0,0);
  const yest = new Date(); yest.setDate(yest.getDate()-1); yest.setHours(0,0,0,0);
  if (d.getTime() === now.getTime())  return 'اليوم';
  if (d.getTime() === yest.getTime()) return 'أمس';
  return d.toLocaleDateString('ar-IQ', { weekday:'short', day:'numeric', month:'short' });
}

function DriverPickerModal({ drivers, onPick, onClose }: {
  drivers: Driver[];
  onPick: (driver: Driver) => void;
  onClose: () => void;
}) {
  const available = drivers.filter(d => d.status === 'available');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-lg p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all">
            <X size={18} />
          </button>
          <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">اختر السائق</p>
          <div className="w-9" />
        </div>

        {available.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🏍️</p>
            <p className="text-gray-500 dark:text-slate-400 font-medium">لا يوجد سواقون متاحون</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">أضف سواقين من صفحة السواقون</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {available.map(d => (
              <button key={d.id} onClick={() => onPick(d)}
                className="w-full flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-4 py-3.5 active:scale-95 transition-all">
                <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">تعيين</span>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-slate-100">{d.name}</p>
                  <p className="text-sm text-gray-400 dark:text-slate-500 mt-0.5" dir="ltr">{d.phone}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardPage() {
  const router = useRouter();
  const { dark, toggleDark } = useDarkMode();
  const { is_closed, opens_at, id: settingsId, refreshSettings } = useSettings();
  const [orders,    setOrders]    = useState<Order[]>([]);
  const [imageMap,  setImageMap]  = useState<Map<string, string>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<'pending'|'preparing'|'ready'|'completed'>('pending');
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [pickerOrderId, setPickerOrderId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [opensAtInput,    setOpensAtInput]    = useState('');

  const handleToggleClosed = async () => {
    if (is_closed) {
      await supabase.from('restaurant_settings').update({ is_closed: false, opens_at: null }).eq('id', settingsId);
      await refreshSettings();
    } else {
      setOpensAtInput('');
      setShowClosedModal(true);
    }
  };

  const confirmClose = async () => {
    await supabase.from('restaurant_settings').update({
      is_closed: true,
      opens_at: opensAtInput || null,
    }).eq('id', settingsId);
    setShowClosedModal(false);
    await refreshSettings();
  };

  const initialLoadDone  = useRef(false);
  const today = localDate();

  useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 60000);
    return () => clearInterval(id);
  }, []);

  const fetchDrivers = useCallback(async () => {
    const { data } = await supabase.from('drivers').select('*').order('name');
    setDrivers(data || []);
  }, []);

  useEffect(() => {
    fetchDrivers();
    const ch = supabase.channel('drivers-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, fetchDrivers)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchDrivers]);

  const fetchOrders = useCallback(async () => {
    const start = new Date(today + 'T00:00:00').toISOString();
    const end   = new Date(today + 'T23:59:59').toISOString();

    const [ordersRes, itemsRes] = await Promise.all([
      supabase.from('orders').select('*').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }).limit(200),
      supabase.from('items').select('name, image_url'),
    ]);

    const imgMap = new Map<string, string>();
    (itemsRes.data || []).forEach(i => imgMap.set(i.name, i.image_url));
    setImageMap(imgMap);

    const withItems = await Promise.all((ordersRes.data || []).map(async o => {
      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', o.id);
      return { ...o, items: items || [] };
    }));
    setOrders(withItems);
    setLoading(false);
    initialLoadDone.current = true;
  }, [today]);

  useEffect(() => { setLoading(true); fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const ch = supabase.channel('dash-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        if (initialLoadDone.current) {
          setNewOrderFlash(true);
          setTimeout(() => setNewOrderFlash(false), 4000);
        }
        fetchOrders();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as Order['status'] } : o));
  };

  const assignDriverAndStart = async (orderId: string, driver: Driver) => {
    await supabase.from('orders').update({
      status: 'preparing',
      driver_name: driver.name,
      driver_phone: driver.phone,
    }).eq('id', orderId);
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: 'preparing', driver_name: driver.name, driver_phone: driver.phone } : o
    ));
    setPickerOrderId(null);
  };

  const handleAction = (order: Order) => {
    const next = STATUS[order.status].next;
    if (!next) return;
    if (order.status === 'pending') {
      fetchDrivers().then(() => setPickerOrderId(order.id));
    } else {
      updateStatus(order.id, next);
    }
  };

  const logout = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  const counts       = { pending:0, preparing:0, ready:0, completed:0 } as Record<string,number>;
  orders.forEach(o => counts[o.status]++);
  const todayRevenue = orders.filter(o=>o.status==='completed').reduce((s,o)=>s+o.total_amount,0);
  const filtered     = orders.filter(o => o.status === filter);

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
        <div className="bg-green-500 py-3 text-center animate-pulse">
          <p className="text-white font-bold">🔔 طلب جديد وصل!</p>
        </div>
      )}

      {/* إحصاء */}
      <div className="grid grid-cols-2 gap-2 px-3 pt-3 pb-2">
        <div className="rounded-2xl p-2.5 text-center border" style={{ backgroundColor: 'rgba(156,163,175,0.08)', borderColor: 'rgba(156,163,175,0.25)' }}>
          <p className="font-bold text-2xl" style={{ color: '#9ca3af' }}>{counts.completed}</p>
          <p className="text-xs mt-0.5 opacity-75" style={{ color: '#9ca3af' }}>مكتمل</p>
        </div>
        <div className="rounded-2xl px-4 py-2.5 text-center border bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800">
          <p className="text-orange-500 font-bold text-xl">{todayRevenue.toLocaleString()} <span className="text-xs font-normal text-orange-400">د.ع</span></p>
          <p className="text-orange-400 text-xs mt-0.5 font-bold">إجمالي اليوم</p>
        </div>
      </div>

      {/* حالة المطعم */}
      <div className="px-3 pb-2">
        <button onClick={handleToggleClosed}
          className={`w-full rounded-2xl px-4 py-3 border flex items-center justify-between transition-all active:scale-[0.98] ${is_closed ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'}`}>
          <div dir="ltr"
            className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${is_closed ? 'bg-red-500' : 'bg-green-400'}`}>
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${is_closed ? 'translate-x-0' : 'translate-x-6'}`} />
          </div>
          <div className="text-right">
            <p className={`font-bold text-sm ${is_closed ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {is_closed ? '🔒 المطعم مغلق حاليًا' : '✅ المطعم مفتوح'}
            </p>
            {is_closed && opens_at && (
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                سيفتح الساعة {opens_at}
              </p>
            )}
          </div>
        </button>
      </div>

      {/* تابس الفلتر */}
      <div className="flex gap-2 px-3 pb-3 overflow-x-auto">
        {(['pending','preparing','ready','completed'] as const).map(tab => {
          const active = filter === tab;
          const count  = counts[tab] || 0;
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
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-50 dark:border-slate-700">
                      <div className="flex flex-col gap-1">
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

                    {/* Items with images */}
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 mb-3 space-y-2">
                      {order.items?.map(item => {
                        const img = imageMap.get(item.item_name);
                        return (
                          <div key={item.id} className="flex justify-between items-center">
                            <span className="text-[#f97316] font-bold text-sm">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                            <div className="flex items-center gap-2">
                              {img && (
                                <img src={img} alt={item.item_name} className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                                  onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                              )}
                              <span className="text-gray-800 dark:text-slate-200 text-sm">{item.item_name}</span>
                              <span className="bg-white dark:bg-slate-600 text-gray-600 dark:text-slate-300 text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">{item.quantity}×</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {order.delivery_address && <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">📍 {order.delivery_address}</p>}
                    {order.client_note && <p className="text-sm text-amber-600 dark:text-amber-400 text-right">📝 {order.client_note}</p>}

                    {/* Driver info (shown when assigned) */}
                    {order.driver_name && (
                      <div className="mt-2 flex items-center justify-end gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2">
                        <div className="text-right">
                          <p className="text-blue-700 dark:text-blue-300 font-bold text-sm">{order.driver_name}</p>
                          <p className="text-blue-500 text-xs" dir="ltr">{order.driver_phone}</p>
                        </div>
                        <span className="text-xl">🏍️</span>
                      </div>
                    )}
                  </div>

                  {cfg.next ? (
                    <button onClick={() => handleAction(order)}
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

      {/* Driver picker modal */}
      {pickerOrderId && (
        <DriverPickerModal
          drivers={drivers}
          onPick={driver => assignDriverAndStart(pickerOrderId, driver)}
          onClose={() => setPickerOrderId(null)}
        />
      )}

      {/* Closed modal */}
      {showClosedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" onClick={() => setShowClosedModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <p className="text-4xl mb-2">🔒</p>
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">إغلاق المطعم</h3>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">حدد وقت الفتح (اختياري)</p>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700 rounded-2xl px-4 py-3 mb-5">
              <Clock size={18} className="text-gray-400 flex-shrink-0" />
              <input
                type="time"
                value={opensAtInput}
                onChange={e => setOpensAtInput(e.target.value)}
                className="flex-1 bg-transparent text-lg font-bold text-gray-900 dark:text-slate-100 outline-none text-center"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowClosedModal(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-slate-600 font-bold text-gray-600 dark:text-slate-400 active:scale-95 transition-all">
                إلغاء
              </button>
              <button onClick={confirmClose}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold active:scale-95 transition-all">
                تأكيد الإغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminBottomNav />
    </div>
  );
}

export default function DashboardPageGuarded() {
  return <AdminGuard><DashboardPage /></AdminGuard>;
}
