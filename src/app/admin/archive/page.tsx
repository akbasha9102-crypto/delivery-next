'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AdminBottomNav } from '@/components/layout/BottomNav';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { useDarkMode } from '@/context/ThemeContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { MessageSquare, AlertCircle, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, MapPin, Car, Search, Calendar, X } from 'lucide-react';

type Feedback = {
  id: string;
  order_id: string;
  client_name: string;
  client_phone: string;
  type: 'feedback' | 'complaint';
  message: string;
  created_at: string;
  total_amount?: number;
  delivery_address?: string | null;
};

type TripItem = { id: string; item_name: string; quantity: number; price: number };

type RejectedOrder = {
  id: string;
  client_name: string;
  client_phone: string;
  total_amount: number;
  delivery_address: string | null;
  created_at: string;
  client_note: string | null;
  items: TripItem[];
};

type DriverTrip = {
  id: string;
  client_name: string;
  client_phone: string;
  delivery_address: string | null;
  client_lat: number | null;
  client_lng: number | null;
  total_amount: number;
  created_at: string;
  driver_name: string;
  driver_phone: string | null;
  driver_id: string;
  items: TripItem[];
};

type DriverGroup = {
  driver_id: string;
  driver_name: string;
  driver_phone: string | null;
  trips: DriverTrip[];
  total: number;
};

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return localDate(d);
}
function dayLabel(dateStr: string) {
  const today = localDate();
  const yesterday = addDays(today, -1);
  if (dateStr === today) return 'اليوم';
  if (dateStr === yesterday) return 'أمس';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'short' });
}
function periodLabel(dateStr: string) {
  const today = localDate();
  const yesterday = addDays(today, -1);
  if (dateStr === today) return 'اليوم';
  if (dateStr === yesterday) return 'أمس';
  return `في ${dayLabel(dateStr)}`;
}

function RejectedOrderModal({ order, onClose }: { order: RejectedOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mt-3 mb-3" />
        <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100 dark:border-slate-700">
          <button onClick={onClose} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">✕</button>
          <div className="text-right">
            <p className="font-bold text-gray-900 dark:text-white text-lg">{order.client_name}</p>
            {order.client_phone && <p className="text-xs text-gray-400 dark:text-slate-500" dir="ltr">{order.client_phone}</p>}
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="text-center py-2 rounded-xl text-sm font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
            ✕ طلب مرفوض — {new Date(order.created_at).toLocaleString('ar-IQ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
          {order.items.length > 0 && (
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 space-y-2">
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between items-center">
                  <span className="text-[#f97316] font-bold text-sm">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-slate-300 text-sm">{item.item_name}</span>
                    <span className="bg-white dark:bg-slate-600 text-gray-500 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{item.quantity}×</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-green-500 font-black text-2xl">{order.total_amount.toLocaleString()} <span className="text-sm text-gray-400 font-normal">د.ع</span></span>
            {order.delivery_address && <p className="text-xs text-gray-400 text-right max-w-[55%]">📍 {order.delivery_address}</p>}
          </div>
          {order.client_note && (
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2 text-right">📝 {order.client_note}</p>
          )}
        </div>
        <div className="pb-6" />
      </div>
    </div>
  );
}

export default function ArchivePage() {
  const router = useRouter();
  useDarkMode();
  const { restaurantId, restaurantName } = useRestaurant();
  const [feedbacks, setFeedbacks]     = useState<Feedback[]>([]);
  const [rejected,  setRejected]      = useState<RejectedOrder[]>([]);
  const [driverGroups, setDriverGroups] = useState<DriverGroup[]>([]);
  const [loading,   setLoading]       = useState(true);
  const [filterType, setFilterType]   = useState<'feedback' | 'complaint' | null>(null);
  const [section,   setSection]       = useState<'feedback' | 'rejected' | 'drivers'>('feedback');
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [expandedTrip,   setExpandedTrip]   = useState<string | null>(null);
  const [searchTerm, setSearchTerm]         = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate]     = useState('');
  const [selectedRejectedOrder, setSelectedRejectedOrder] = useState<RejectedOrder | null>(null);

  const currentDate = selectedDate || localDate();
  const last14Days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(localDate(), -i)), []);

  const fetchAll = useCallback(async () => {
    if (!restaurantId) {
      setFeedbacks([]); setRejected([]); setDriverGroups([]); setLoading(false);
      return;
    }
    const day   = selectedDate || localDate();
    const start = new Date(day + 'T00:00:00').toISOString();
    const end   = new Date(day + 'T23:59:59').toISOString();

    const [fbRes, rejRes, tripsRes] = await Promise.all([
      supabase.from('order_feedback').select('*, orders(total_amount, delivery_address)').eq('restaurant_id', restaurantId).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }).limit(200),
      supabase.from('orders').select('id, client_name, client_phone, total_amount, delivery_address, created_at, client_note').eq('restaurant_id', restaurantId).eq('status', 'rejected').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }),
      supabase.from('orders').select('id, client_name, client_phone, delivery_address, client_lat, client_lng, total_amount, created_at, driver_name, driver_phone, driver_id').eq('restaurant_id', restaurantId).eq('status', 'completed').not('driver_id', 'is', null).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }),
    ]);

    const enriched: Feedback[] = (fbRes.data || []).map((f: any) => ({
      ...f,
      total_amount:     f.orders?.total_amount,
      delivery_address: f.orders?.delivery_address,
    }));
    setFeedbacks(enriched);

    // جلب عناصر كل طلب مرفوض — batch واحد بدلاً من N+1
    const rawRejected = (rejRes.data || []) as Omit<RejectedOrder, 'items'>[];
    const rejectedIds = rawRejected.map(o => o.id);
    const allRejItems = rejectedIds.length
      ? ((await supabase.from('order_items').select('id, item_name, quantity, price, order_id').in('order_id', rejectedIds)).data || []) as (TripItem & { order_id: string })[]
      : [];
    const itemsByRejOrder = new Map<string, TripItem[]>();
    allRejItems.forEach(it => {
      const arr = itemsByRejOrder.get(it.order_id) ?? [];
      arr.push(it);
      itemsByRejOrder.set(it.order_id, arr);
    });
    setRejected(rawRejected.map(o => ({ ...o, items: itemsByRejOrder.get(o.id) ?? [] })));

    // جلب عناصر كل رحلة — batch واحد بدلاً من N+1
    const rawTrips = (tripsRes.data || []) as Omit<DriverTrip, 'items'>[];
    const tripIds = rawTrips.map(t => t.id);
    const allTripItems = tripIds.length
      ? ((await supabase.from('order_items').select('id, item_name, quantity, price, order_id').in('order_id', tripIds)).data || []) as (TripItem & { order_id: string })[]
      : [];
    const itemsByTrip = new Map<string, TripItem[]>();
    allTripItems.forEach(it => {
      const arr = itemsByTrip.get(it.order_id) ?? [];
      arr.push(it);
      itemsByTrip.set(it.order_id, arr);
    });
    const tripsWithItems: DriverTrip[] = rawTrips.map(trip => ({ ...trip, items: itemsByTrip.get(trip.id) ?? [] }));

    // تجميع حسب السائق
    const map = new Map<string, DriverGroup>();
    tripsWithItems.forEach(trip => {
      const key = trip.driver_id;
      if (!map.has(key)) {
        map.set(key, {
          driver_id:    trip.driver_id,
          driver_name:  trip.driver_name,
          driver_phone: trip.driver_phone,
          trips: [],
          total: 0,
        });
      }
      const g = map.get(key)!;
      g.trips.push(trip);
      g.total += trip.total_amount;
    });
    setDriverGroups(Array.from(map.values()));
    setLoading(false);
  }, [restaurantId, selectedDate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!restaurantId) return;
    // فلترة بمعرّف المطعم إلزامية — بدونها يُعاد جلب كامل الأرشيف عند أي تغيير
    // بطلب أو تقييم لأي مطعم آخر بالمنصة بأكملها (خطأ #25 بتقرير الفحص)
    const ch = supabase.channel('archive-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_feedback', filter: `restaurant_id=eq.${restaurantId}` }, fetchAll)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll, restaurantId]);

  const q = searchTerm.trim();
  const filtered = feedbacks.filter(f =>
    (filterType === null || f.type === filterType) &&
    (!q || f.client_name.includes(q) || f.client_phone.includes(q) || f.message.includes(q))
  );
  const visibleRejected = !q ? rejected : rejected.filter(o =>
    o.client_name.includes(q) || o.client_phone.includes(q) || (o.delivery_address ?? '').includes(q)
  );
  const visibleDriverGroups = !q ? driverGroups : driverGroups
    .map(g => ({
      ...g,
      trips: g.trips.filter(t =>
        g.driver_name.includes(q) ||
        (g.driver_phone ?? '').includes(q) ||
        t.client_name.includes(q) ||
        t.client_phone.includes(q) ||
        (t.delivery_address ?? '').includes(q)
      ),
    }))
    .filter(g => g.trips.length > 0);
  const complaints = feedbacks.filter(f => f.type === 'complaint').length;
  const notes      = feedbacks.filter(f => f.type === 'feedback').length;
  const totalDriverTrips = driverGroups.reduce((s, g) => s + g.trips.length, 0);
  const totalDriverRevenue = driverGroups.reduce((s, g) => s + g.total, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#212121] pb-28 md:pb-0 md:mr-[70px]">
      <AdminHeader
        title="الأرشيف"
        right={
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-700 active:scale-90 transition-all">
            <ChevronRight size={20} className="text-gray-500 dark:text-slate-400" />
          </button>
        }
      />

      {/* شريط البحث + زر التاريخ */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            dir="rtl"
            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl py-2.5 pr-10 pl-9 text-sm text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316]"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowDatePicker(v => !v)}
          className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-2xl border transition-all active:scale-95 ${showDatePicker || selectedDate ? 'bg-[var(--admin-accent-light-bg)] border-[var(--admin-accent-light-border)] text-white dark:bg-[var(--admin-accent-dark)] dark:border-[var(--admin-accent-dark)]' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}
          aria-label="فلترة حسب التاريخ"
        >
          <Calendar size={18} />
        </button>
      </div>

      {showDatePicker && (
        <div className="px-3 pt-2 space-y-2">
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl px-2 py-2">
            <button onClick={() => setSelectedDate(addDays(currentDate, -1))} className="w-9 h-9 flex items-center justify-center rounded-xl active:bg-gray-100 dark:active:bg-slate-700" aria-label="اليوم السابق">
              <ChevronLeft size={18} className="text-gray-500 dark:text-slate-400" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{dayLabel(currentDate)}</p>
              <p className="text-[11px] text-gray-400">{currentDate}</p>
            </div>
            <button onClick={() => setSelectedDate(addDays(currentDate, 1))} disabled={currentDate >= localDate()} className="w-9 h-9 flex items-center justify-center rounded-xl active:bg-gray-100 dark:active:bg-slate-700 disabled:opacity-30" aria-label="اليوم التالي">
              <ChevronRight size={18} className="text-gray-500 dark:text-slate-400" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {last14Days.map(d => (
              <button key={d} onClick={() => setSelectedDate(d === localDate() ? '' : d)} className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${currentDate === d ? 'bg-[var(--admin-accent-light-bg)] border-[var(--admin-accent-light-border)] text-white dark:bg-[var(--admin-accent-dark)] dark:border-[var(--admin-accent-dark)]' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                {dayLabel(d)}
              </button>
            ))}
          </div>
          <details className="text-center">
            <summary className="text-xs text-gray-400 cursor-pointer select-none">تاريخ أبعد 📅</summary>
            <input type="date" value={currentDate} max={localDate()} onChange={e => setSelectedDate(e.target.value)} className="mt-2 w-full rounded-xl px-3 py-2 text-sm text-center border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 outline-none" />
          </details>
        </div>
      )}

      {/* التابات الرئيسية */}
      <div className="flex gap-2 px-3 pt-3 pb-2">
        <button onClick={() => setSection('feedback')}
          className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border transition-all ${section === 'feedback' ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
          💬 ملاحظة/شكوى{feedbacks.length > 0 ? ` (${feedbacks.length})` : ''}
        </button>
        <button onClick={() => setSection('drivers')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-bold border transition-all ${section === 'drivers' ? 'bg-[#2563eb] border-[#2563eb] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
          <span aria-hidden="true">🏍️</span>
          <span>السائقين{totalDriverTrips > 0 ? ` (${totalDriverTrips})` : ''}</span>
        </button>
        <button onClick={() => setSection('rejected')}
          className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border transition-all ${section === 'rejected' ? 'bg-[#EF4444] border-[#EF4444] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
          ✕ مرفوضة{rejected.length > 0 ? ` (${rejected.length})` : ''}
        </button>
      </div>

      {/* ═══ قسم الملاحظات ═══ */}
      {section === 'feedback' && (
        <>
          {!loading && feedbacks.length > 0 && (
            <div className="grid grid-cols-2 gap-2 px-3 pb-2">
              <div className="rounded-2xl p-3 text-center border bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                <p className="font-bold text-2xl text-blue-500">{notes}</p>
                <p className="text-xs mt-0.5 text-blue-400 font-bold">ملاحظات</p>
              </div>
              <div className="rounded-2xl p-3 text-center border bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
                <p className="font-bold text-2xl text-red-500">{complaints}</p>
                <p className="text-xs mt-0.5 text-red-400 font-bold">شكاوى</p>
              </div>
            </div>
          )}
          <div className="flex gap-2 px-3 pb-3 overflow-x-auto">
            {(['feedback', 'complaint'] as const).map(t => {
              const labels = { feedback: '💡 ملاحظات', complaint: '⚠️ شكاوى' };
              return (
                <button key={t} onClick={() => setFilterType(filterType === t ? null : t)}
                  className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-all active:scale-95 ${filterType === t ? 'bg-black border-black text-white dark:bg-white dark:border-white dark:text-black' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
                  {labels[t]}
                </button>
              );
            })}
          </div>
          <div className="px-3">
            {loading ? (
              <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center mt-24"><p className="text-5xl mb-3">📭</p><p className="text-gray-400 dark:text-slate-500 font-medium">{q ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد ملاحظات بعد'}</p></div>
            ) : (
              <div className="space-y-3 max-w-lg mx-auto">
                {filtered.map(fb => (
                  <div key={fb.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                    <div className={`h-1.5 ${fb.type === 'complaint' ? 'bg-red-400' : 'bg-blue-400'}`} />
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          {fb.type === 'complaint' ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full"><AlertCircle size={11} /> شكوى</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full"><MessageSquare size={11} /> ملاحظة</span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 dark:text-slate-100">{fb.client_name}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500" dir="ltr">{fb.client_phone}</p>
                        </div>
                      </div>
                      <p className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed text-right mb-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5">{fb.message}</p>
                      <div className="flex justify-between items-center text-xs text-gray-400 dark:text-slate-500">
                        <span>{new Date(fb.created_at).toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {fb.total_amount != null && <span className="text-green-500 font-bold">{fb.total_amount.toLocaleString()} د.ع</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ قسم المرفوضة ═══ */}
      {section === 'rejected' && (
        <div className="px-3 pt-1">
          {loading ? (
            <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : rejected.length === 0 ? (
            <div className="text-center mt-24"><p className="text-5xl mb-3">✅</p><p className="text-gray-400 dark:text-slate-500 font-medium">لا توجد طلبات مرفوضة {periodLabel(currentDate)}</p></div>
          ) : visibleRejected.length === 0 ? (
            <div className="text-center mt-24"><p className="text-gray-400 dark:text-slate-500 font-medium">لا توجد نتائج مطابقة للبحث</p></div>
          ) : (
            <div className="space-y-3 max-w-lg mx-auto">
              {visibleRejected.map(order => (
                <button key={order.id} onClick={() => setSelectedRejectedOrder(order)} className="w-full text-right active:scale-[0.98] transition-all bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                  <div className="h-1.5 bg-red-400" />
                  <div className="p-4 flex justify-between items-start">
                    <div>
                      <p className="text-red-500 font-bold">{order.total_amount.toLocaleString()} <span className="text-xs text-gray-400 font-normal">د.ع</span></p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5" dir="ltr">{order.client_phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-slate-100">{order.client_name}</p>
                      {order.delivery_address && <p className="text-xs text-gray-400 mt-0.5">📍 {order.delivery_address}</p>}
                      <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">
                        {new Date(order.created_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ قسم أرشيف السائقين ═══ */}
      {section === 'drivers' && (
        <div className="px-3 pt-1">
          {loading ? (
            <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : driverGroups.length === 0 ? (
            <div className="text-center mt-24">
              <p className="text-5xl mb-3">🏍️</p>
              <p className="text-gray-400 dark:text-slate-500 font-medium">لا توجد رحلات مكتملة {periodLabel(currentDate)}</p>
            </div>
          ) : (
            <>
              {/* إحصاء عام */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-2xl p-3 text-center border bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                  <p className="font-bold text-xl text-blue-500">{driverGroups.length}</p>
                  <p className="text-xs mt-0.5 text-blue-400 font-bold">سائقين</p>
                </div>
                <div className="rounded-2xl p-3 text-center border bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
                  <p className="font-bold text-xl text-purple-500">{totalDriverTrips}</p>
                  <p className="text-xs mt-0.5 text-purple-400 font-bold">رحلة</p>
                </div>
                <div className="rounded-2xl p-3 text-center border bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
                  <p className="font-bold text-lg text-green-500">{totalDriverRevenue.toLocaleString()}</p>
                  <p className="text-xs mt-0.5 text-green-400 font-bold">د.ع</p>
                </div>
              </div>

              {/* قائمة السائقين */}
              {visibleDriverGroups.length === 0 ? (
                <div className="text-center mt-10"><p className="text-gray-400 dark:text-slate-500 font-medium text-sm">لا توجد نتائج مطابقة للبحث</p></div>
              ) : (
              <div className="space-y-3 max-w-lg mx-auto">
                {visibleDriverGroups.map(group => (
                  <div key={group.driver_id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                    {/* هيدر السائق */}
                    <button
                      onClick={() => setExpandedDriver(expandedDriver === group.driver_id ? null : group.driver_id)}
                      className="w-full p-4 flex items-center justify-between active:bg-gray-50 dark:active:bg-slate-700/50 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        {expandedDriver === group.driver_id
                          ? <ChevronUp size={16} className="text-gray-400" />
                          : <ChevronDown size={16} className="text-gray-400" />
                        }
                        <div className="text-left">
                          <p className="text-green-500 font-bold text-sm">{group.total.toLocaleString()} <span className="text-xs text-gray-400 font-normal">د.ع</span></p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">{group.trips.length} رحلة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-gray-900 dark:text-slate-100">{group.driver_name}</p>
                          {group.driver_phone && <p className="text-xs text-gray-400 dark:text-slate-500" dir="ltr">{group.driver_phone}</p>}
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                          <Car size={18} className="text-blue-500" />
                        </div>
                      </div>
                    </button>

                    {/* رحلات السائق */}
                    {expandedDriver === group.driver_id && (
                      <div className="border-t border-gray-100 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-700/50">
                        {group.trips.map((trip, idx) => (
                          <div key={trip.id} className="p-3">
                            {/* سطر الرحلة */}
                            <button
                              onClick={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                              className="w-full flex items-start justify-between active:opacity-70 transition-all"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="text-left">
                                  <p className="text-green-500 font-bold text-sm">{trip.total_amount.toLocaleString()} <span className="text-xs text-gray-400 font-normal">د.ع</span></p>
                                  <p className="text-xs text-gray-400 dark:text-slate-500">
                                    {new Date(trip.created_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{trip.client_name}</p>
                                {trip.delivery_address && (
                                  <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1 justify-end mt-0.5">
                                    <MapPin size={10} /> {trip.delivery_address}
                                  </p>
                                )}
                              </div>
                            </button>

                            {/* تفاصيل الرحلة */}
                            {expandedTrip === trip.id && (
                              <div className="mt-3 space-y-2">
                                {/* معلومات الزبون */}
                                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5 space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-400 dark:text-slate-500">{restaurantName || 'المطعم'}</p>
                                    <p className="text-xs font-bold text-gray-600 dark:text-slate-300">من</p>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-400 dark:text-slate-500" dir="ltr">{trip.client_phone}</p>
                                    <p className="text-xs font-bold text-gray-600 dark:text-slate-300">رقم الزبون</p>
                                  </div>
                                  {trip.delivery_address && (
                                    <div className="flex justify-between items-start gap-2">
                                      <p className="text-xs text-gray-500 dark:text-slate-400 text-right flex-1">{trip.delivery_address}</p>
                                      <p className="text-xs font-bold text-gray-600 dark:text-slate-300 flex-shrink-0">إلى</p>
                                    </div>
                                  )}
                                  {trip.client_lat && trip.client_lng && (
                                    <a
                                      href={`https://www.google.com/maps?q=${trip.client_lat},${trip.client_lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-end gap-1.5 text-xs text-blue-500 font-bold active:opacity-70"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <MapPin size={12} /> عرض على الخريطة
                                    </a>
                                  )}
                                </div>

                                {/* عناصر الطلب */}
                                {trip.items.length > 0 && (
                                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5 space-y-2">
                                    <p className="text-xs font-bold text-gray-500 dark:text-slate-400 text-right mb-1.5">محتوى الطلب</p>
                                    {trip.items.map(item => (
                                      <div key={item.id} className="flex justify-between items-center">
                                        <span className="text-[#f97316] font-bold text-xs">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-gray-700 dark:text-slate-300 text-sm">{item.item_name}</span>
                                          <span className="bg-white dark:bg-slate-600 text-gray-500 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{item.quantity}×</span>
                                        </div>
                                      </div>
                                    ))}
                                    <div className="pt-1 border-t border-gray-200 dark:border-slate-600 flex justify-between items-center">
                                      <span className="text-green-500 font-black text-sm">{trip.total_amount.toLocaleString()} د.ع</span>
                                      <span className="text-xs font-bold text-gray-400 dark:text-slate-500">الإجمالي</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}
            </>
          )}
        </div>
      )}

      <AdminBottomNav />

      {selectedRejectedOrder && (
        <RejectedOrderModal order={selectedRejectedOrder} onClose={() => setSelectedRejectedOrder(null)} />
      )}
    </div>
  );
}

