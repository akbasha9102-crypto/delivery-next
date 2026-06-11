'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/context/ThemeContext';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminBottomNav } from '@/components/BottomNav';
import { Moon, Sun, LogOut, X, Clock, Calendar } from 'lucide-react';
import { useSettings, type DaySchedule, type WeekSchedule } from '@/context/SettingsContext';
import { useNewOrders } from '@/context/NewOrdersContext';

type OrderItem = { id: string; item_name: string; quantity: number; price: number };
type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; client_note: string | null; total_amount: number; status: 'pending' | 'preparing' | 'ready' | 'completed'; created_at: string; items?: OrderItem[]; driver_name?: string | null; driver_phone?: string | null; driver_id?: string | null; client_lat?: number | null; client_lng?: number | null };
type Driver = { id: string; name: string; phone: string; status: string };

const STATUS = {
  pending:   { label: 'واردة',        next: 'preparing' as const, nextLabel: 'ابدأ التجهيز',  color: '#f59e0b', dot: 'bg-yellow-400', btnColor: '#3b82f6' },
  preparing: { label: 'قيد التجهيز', next: 'ready'     as const, nextLabel: 'جاهز للتسليم', color: '#3b82f6', dot: 'bg-blue-400',   btnColor: '#22c55e' },
  ready:     { label: 'جاهز',        next: 'completed'  as const, nextLabel: 'تم التسليم',   color: '#22c55e', dot: 'bg-green-400',  btnColor: '#6b7280' },
  completed: { label: 'مكتمل',       next: null,                  nextLabel: '',              color: '#9ca3af', dot: 'bg-gray-400',   btnColor: '#9ca3af' },
};

function formatPhoneForWA(phone: string) {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('964')) return clean;
  if (clean.startsWith('0')) return '964' + clean.slice(1);
  return '964' + clean;
}

function buildWAMessage(order: Order) {
  const items = order.items?.map(i => `• ${i.item_name} × ${i.quantity}`).join('\n') ?? '';
  const locationLine = order.client_lat && order.client_lng
    ? `🗺️ الموقع: https://maps.google.com/?q=${order.client_lat},${order.client_lng}`
    : null;
  const deliveryLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/delivery/${order.id}`;
  return [
    '🛵 طلب جديد',
    '',
    `👤 ${order.client_name}`,
    `📞 ${order.client_phone}`,
    order.delivery_address ? `📍 ${order.delivery_address}` : null,
    locationLine,
    '',
    '🧾 الطلب:',
    items,
    '',
    `💰 ${order.total_amount.toLocaleString()} د.ع`,
    order.client_note ? `📝 ${order.client_note}` : null,
    '',
    `✅ رابط إتمام التوصيل:`,
    deliveryLink,
  ].filter(l => l !== null).join('\n');
}

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg p-5 pb-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all">
            <X size={18} />
          </button>
          <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">اختر السائق</p>
          <div className="w-9" />
        </div>

        {drivers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🏍️</p>
            <p className="text-gray-500 dark:text-slate-400 font-medium">لا يوجد سواقون</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">أضف سواقين من صفحة السواقون</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {drivers.map(d => {
              const available = d.status === 'available';
              return (
                <button key={d.id} onClick={() => available && onPick(d)} disabled={!available}
                  className={`w-full flex items-center justify-between rounded-2xl px-4 py-3.5 transition-all ${
                    available
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 active:scale-95'
                      : 'bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 opacity-60 cursor-not-allowed'
                  }`}>
                  <div className="flex items-center gap-2">
                    {available ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                    <span className={`font-bold text-sm ${available ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}`}>
                      {available ? 'تعيين' : 'مشغول'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-slate-100">{d.name}</p>
                    <p className="text-sm text-gray-400 dark:text-slate-500 mt-0.5" dir="ltr">{d.phone}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DEFAULT_WEEK: WeekSchedule = {
  auto: false,
  days: Object.fromEntries([0,1,2,3,4,5,6].map(d => [String(d), { enabled: d < 5, open: '10:00', close: '23:00' } as DaySchedule])),
};

function ScheduleModal({ schedule: initSchedule, settingsId, onSaved, onClose }: {
  schedule: WeekSchedule | null;
  settingsId: string;
  onSaved: (s: WeekSchedule) => void;
  onClose: () => void;
}) {
  const [sched,  setSched]  = useState<WeekSchedule>(initSchedule ?? DEFAULT_WEEK);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSched(initSchedule ?? DEFAULT_WEEK); }, [initSchedule]);

  const updateDay = (key: string, field: keyof DaySchedule, val: boolean | string) =>
    setSched(prev => ({ ...prev, days: { ...prev.days, [key]: { ...prev.days[key], [field]: val } } }));

  const handleSave = async () => {
    if (!settingsId) return;
    setSaving(true);
    await supabase.from('restaurant_settings').update({ schedule: sched }).eq('id', settingsId);
    onSaved(sched);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg pb-6 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all">
            <X size={18} />
          </button>
          <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">جدولة الدوام</p>
          <div className="w-9" />
        </div>

        <div className="overflow-y-auto flex-1 px-5 pt-4">

          {/* Auto-apply */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-2xl px-4 py-3 mb-5">
            <button
              onClick={() => setSched(prev => ({ ...prev, auto: !prev.auto }))}
              dir="ltr"
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${sched.auto ? 'bg-green-400' : 'bg-gray-300 dark:bg-slate-500'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${sched.auto ? 'translate-x-6' : ''}`} />
            </button>
            <div className="text-right">
              <p className="font-bold text-sm text-gray-800 dark:text-slate-200">تطبيق تلقائي</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">يفتح ويغلق المطعم حسب الجدول</p>
            </div>
          </div>

          {/* Days */}
          <div className="space-y-3 pb-4">
            {[0,1,2,3,4,5,6].map(d => {
              const key = String(d);
              const day: DaySchedule = sched.days[key] ?? { enabled: false, open: '10:00', close: '23:00' };
              return (
                <div key={d} className={`bg-gray-50 dark:bg-slate-700/50 rounded-2xl px-4 py-3 transition-opacity ${!day.enabled ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => updateDay(key, 'enabled', !day.enabled)}
                      dir="ltr"
                      className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${day.enabled ? 'bg-[#f97316]' : 'bg-gray-300 dark:bg-slate-500'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${day.enabled ? 'translate-x-5' : ''}`} />
                    </button>
                    <p className="font-bold text-sm text-gray-800 dark:text-slate-200">{DAY_NAMES[d]}</p>
                  </div>
                  {day.enabled && (
                    <div className="flex items-center gap-2">
                      <input type="time" value={day.close} onChange={e => updateDay(key, 'close', e.target.value)}
                        className="flex-1 text-sm text-center bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-xl py-2 outline-none text-gray-700 dark:text-slate-200" />
                      <span className="text-gray-300 dark:text-slate-500 text-sm font-bold">—</span>
                      <input type="time" value={day.open} onChange={e => updateDay(key, 'open', e.target.value)}
                        className="flex-1 text-sm text-center bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-xl py-2 outline-none text-gray-700 dark:text-slate-200" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 pt-3 flex-shrink-0">
          <button onClick={handleSave} disabled={saving}
            className="w-full py-4 rounded-2xl bg-black text-white font-bold text-base active:scale-95 transition-all disabled:opacity-60">
            {saving ? 'جاري الحفظ...' : 'حفظ الجدولة'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const router = useRouter();
  const { dark, toggleDark } = useDarkMode();
  const { markSeen } = useNewOrders();
  useEffect(() => { markSeen(); }, [markSeen]);
  const { is_closed, opens_at, id: settingsId, refreshSettings, schedule: ctxSchedule, loaded } = useSettings();
  const [scheduleLocal, setScheduleLocal] = useState<WeekSchedule | null>(null);
  const isClosedRef = useRef(is_closed);
  useEffect(() => { isClosedRef.current = is_closed; }, [is_closed]);
  useEffect(() => { setScheduleLocal(ctxSchedule); }, [ctxSchedule]);
  const [orders,    setOrders]    = useState<Order[]>([]);
  const [imageMap,  setImageMap]  = useState<Map<string, string>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<'pending'|'preparing'|'ready'|'completed'>('pending');
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [pickerOrderId, setPickerOrderId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showClosedModal,  setShowClosedModal]  = useState(false);
  const [opensAtInput,     setOpensAtInput]     = useState('');
  const [showSchedule,     setShowSchedule]     = useState(false);

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

  useEffect(() => {
    if (!scheduleLocal?.auto || !settingsId || !loaded) return;
    const now = new Date();
    const dayKey = String(now.getDay());
    const day = scheduleLocal.days?.[dayKey];

    let shouldBeOpen: boolean;
    if (!day?.enabled) {
      shouldBeOpen = false;
    } else {
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const [oh = 0, om = 0] = (day.open  || '00:00').split(':').map(Number);
      const [ch = 23, cm = 59] = (day.close || '23:59').split(':').map(Number);
      shouldBeOpen = nowMins >= oh * 60 + om && nowMins < ch * 60 + cm;
    }

    const currentlyClosed = isClosedRef.current;
    if (shouldBeOpen && currentlyClosed) {
      supabase.from('restaurant_settings').update({ is_closed: false, opens_at: null }).eq('id', settingsId).then(() => refreshSettings());
    } else if (!shouldBeOpen && !currentlyClosed) {
      const nextOpen = scheduleLocal.days?.[dayKey]?.open ?? null;
      supabase.from('restaurant_settings').update({ is_closed: true, opens_at: nextOpen }).eq('id', settingsId).then(() => refreshSettings());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, scheduleLocal, settingsId, loaded]);

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
    await Promise.all([
      supabase.from('orders').update({
        status: 'preparing',
        driver_name: driver.name,
        driver_phone: driver.phone,
        driver_id: driver.id,
      }).eq('id', orderId),
      supabase.from('drivers').update({ status: 'unavailable' }).eq('id', driver.id),
    ]);
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: 'preparing', driver_name: driver.name, driver_phone: driver.phone, driver_id: driver.id } : o
    ));
    setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, status: 'unavailable' } : d));
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
      <div className="px-3 pb-2 flex gap-2 items-stretch">
        <button onClick={handleToggleClosed}
          className={`flex-1 rounded-2xl px-4 py-3 border flex items-center justify-between transition-all active:scale-[0.98] ${is_closed ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'}`}>
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

        {/* زر جدولة الدوام */}
        <button onClick={() => setShowSchedule(true)}
          className="relative flex flex-col items-center justify-center gap-1 px-3 rounded-2xl border bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 active:scale-95 transition-all">
          <Calendar size={18} className="text-gray-500 dark:text-slate-400" />
          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 whitespace-nowrap">جدولة</span>
          {scheduleLocal?.auto && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-400" />
          )}
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
                      <div className="mt-2 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2">
                        <button
                          onClick={() => {
                            const phone = formatPhoneForWA(order.driver_phone ?? '');
                            const msg   = buildWAMessage(order);
                            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                          }}
                          className="flex items-center gap-1.5 bg-green-500 active:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-all"
                        >
                          <span>📤</span>
                          <span>إرسال</span>
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-blue-700 dark:text-blue-300 font-bold text-sm">{order.driver_name}</p>
                            <p className="text-blue-500 text-xs" dir="ltr">{order.driver_phone}</p>
                          </div>
                          <span className="text-xl">🏍️</span>
                        </div>
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

      {/* Schedule modal */}
      {showSchedule && (
        <ScheduleModal
          schedule={scheduleLocal}
          settingsId={settingsId}
          onSaved={setScheduleLocal}
          onClose={() => setShowSchedule(false)}
        />
      )}

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
