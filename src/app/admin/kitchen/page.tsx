'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChefHat } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/context/RestaurantContext';
import { useDarkMode } from '@/context/ThemeContext';
import { makeKitchenAlertWavUrl, makeKitchenEditWavUrl, makeKitchenCancelWavUrl } from '@/lib/utils/kitchenAlertSound';

type KitchenOrderItem = { id: string; item_name: string; quantity: number; price: number };
type KitchenOrder = { id: string; created_at: string; order_type: 'delivery' | 'pickup' | 'local' | null; driver_id: string | null; client_name: string; order_items?: KitchenOrderItem[]; last_edit_id: string | null };
type CancelledTicket = KitchenOrder & { cancelledAt: number };
type LogEntry = { id: string; created_at: string; client_name: string; items: string[] };
type OrdersRealtimeRow = { id: string; status: string; last_edit_id: string | null };

// لقطة عنصر سابق بجدول order_edits (previous_items JSONB) — تُعرض مشطوبة
// بأعلى التذكرة عند وجود last_edit_id، لتنبيه المطبخ بأن الطلب عُدِّل.
type EditPreviousItem = { item_name: string; quantity: number };

// رؤوس تحقق مسارات /api/push/* — جلسة Supabase الحقيقية للمستخدم الحالي
// (نفس النمط المستخدم بـ admin/dashboard/page.tsx)
async function pushAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

// نفس منطق waitInfo بـ admin/dashboard/page.tsx — يُستخدم هنا كحد علوي ملوّن بكل بطاقة
function waitInfo(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 10) return { color: '#22c55e', text: `${mins} د` };
  if (mins < 20) return { color: '#f59e0b', text: `${mins} د` };
  return { color: '#ef4444', text: `${mins} د ⚠️` };
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function orderTypeInfo(orderType: KitchenOrder['order_type']) {
  return orderType === 'delivery'
    ? { label: 'توصيل', color: '#f97316' }
    : { label: 'طلب داخلي', color: '#64748b' };
}

// تصنيف حدث realtime واحد بمقارنته بآخر حالة معروفة محلياً (knownOrderStateRef)
// بدل الاعتماد على payload.old غير الموثوق بهذا الجدول (بدون REPLICA IDENTITY FULL).
function classifyOrderEvent(
  cache: Map<string, { status: string; last_edit_id: string | null }>,
  eventType: 'INSERT' | 'UPDATE',
  row: OrdersRealtimeRow
): 'new' | 'edited' | 'cancelled' | 'ignore' {
  const prev = cache.get(row.id);
  if (eventType === 'INSERT') return row.status === 'preparing' ? 'new' : 'ignore';
  if (!prev) return row.status === 'preparing' ? 'new' : 'ignore';
  if (prev.status === 'preparing' && row.status === 'rejected') return 'cancelled';
  if (prev.status === 'preparing' && row.status === 'preparing' && row.last_edit_id && row.last_edit_id !== prev.last_edit_id) return 'edited';
  return 'ignore';
}

function playOnce(ref: React.RefObject<HTMLAudioElement | null>) {
  const a = ref.current;
  if (!a) return;
  a.currentTime = 0;
  a.play().catch(() => {});
}

/* ─────────────────────── شاشة "اضغط لبدء المراقبة" ─────────────────────── */
// تظهر بكل تحميل/refresh عمداً (بدون تذكّر بـ localStorage) لضمان أن الصوت
// يعمل 100% من المرات — متصفحات التابلت تمنع autoplay بدون تفاعل مستخدم أولاً.
function UnlockScreen({ dark, onUnlock }: { dark: boolean; onUnlock: () => void }) {
  const handleClick = () => {
    const url = makeKitchenAlertWavUrl();
    if (url) {
      const a = new Audio(url);
      a.volume = 1;
      a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
    }
    onUnlock();
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center gap-6 ${dark ? 'bg-[#212121]' : 'bg-gray-50'}`} dir="rtl">
      <ChefHat size={64} className="text-[#f97316]" />
      <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>شاشة عرض المطبخ</h1>
      <button
        onClick={handleClick}
        className="px-10 py-6 rounded-2xl bg-[#f97316] text-white text-2xl font-bold shadow-lg active:scale-95 transition-all"
      >
        اضغط لبدء المراقبة
      </button>
      <p className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-400'}`}>يلزم الضغط لتفعيل صوت التنبيه بهذا المتصفح</p>
    </div>
  );
}

/* ─────────────────────── بطاقة تذكرة واحدة (معلّقة أو ملغاة) ─────────────────────── */
function TicketCard({ order, dark, editPreviousItems, onMarkReady, saving, variant }: {
  order: KitchenOrder; dark: boolean; editPreviousItems: Map<string, EditPreviousItem[]>;
  onMarkReady: (order: KitchenOrder) => void; saving: boolean; variant: 'pending' | 'cancelled';
}) {
  const wait = waitInfo(order.created_at);
  const isLate = variant === 'pending' && wait.color === '#ef4444';
  const typeInfo = orderTypeInfo(order.order_type);
  const isCancelled = variant === 'cancelled';

  return (
    <div
      className={`rounded-3xl overflow-hidden shadow-lg border-t-8 ${dark ? 'bg-[#2a2a2a]' : 'bg-white'} ${isLate ? 'animate-pulse' : ''} ${isCancelled ? 'bg-red-50 dark:bg-red-950/30' : ''}`}
      style={{ borderTopColor: isCancelled ? '#ef4444' : wait.color }}
    >
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-2xl md:text-3xl font-black px-4 py-1.5 rounded-xl"
            style={{ color: typeInfo.color, backgroundColor: `${typeInfo.color}20` }}
          >
            {typeInfo.label}
          </span>
          {!isCancelled && (
            <span
              className="text-xl md:text-2xl font-bold px-3 py-1.5 rounded-lg"
              style={{ color: wait.color, backgroundColor: `${wait.color}20` }}
            >
              {wait.text}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-5">
          <p className={`text-sm md:text-base ${dark ? 'text-slate-400' : 'text-gray-400'}`}>استُلم {fmtTime(order.created_at)}</p>
          {order.last_edit_id && editPreviousItems.has(order.last_edit_id) && (
            <span className="text-xs md:text-sm font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              ✏️ معدّل
            </span>
          )}
        </div>

        {/* العناصر القديمة قبل التعديل — مشطوبة وباهتة، تظهر فوق القائمة الحالية */}
        {order.last_edit_id && editPreviousItems.has(order.last_edit_id) && (
          <ul className="space-y-1.5 mb-3 opacity-50">
            {(editPreviousItems.get(order.last_edit_id) || []).map((it, idx) => (
              <li key={idx} className={`text-lg md:text-xl font-bold flex items-center gap-3 line-through ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                <span>×{it.quantity}</span>
                <span>{it.item_name}</span>
              </li>
            ))}
          </ul>
        )}

        <ul className="space-y-3 mb-6">
          {(order.order_items || []).map(it => (
            <li key={it.id} className={`text-3xl md:text-4xl font-bold flex items-center gap-3 ${dark ? 'text-slate-100' : 'text-gray-800'}`}>
              <span className="text-[#f97316]">×{it.quantity}</span>
              <span>{it.item_name}</span>
            </li>
          ))}
        </ul>

        {isCancelled ? (
          <div className="w-full py-6 rounded-2xl bg-red-500 text-white text-2xl md:text-3xl font-bold flex items-center justify-center gap-3">
            تم الإلغاء
          </div>
        ) : (
          <button
            onClick={() => onMarkReady(order)}
            disabled={saving}
            className="w-full py-6 rounded-2xl bg-green-500 text-white text-2xl md:text-3xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
          >
            <Check size={32} />
            تم التجهيز
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────── الصفحة الرئيسية ─────────────────────────────── */
export default function KitchenDisplayPage() {
  const { restaurantId } = useRestaurant();
  const { dark } = useDarkMode();

  const [unlocked, setUnlocked] = useState(false);
  const [tickets, setTickets] = useState<KitchenOrder[]>([]);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  // خريطة order_edits.id → previous_items، لتذاكر لها last_edit_id — تُعرض
  // كعناصر قديمة مشطوبة فوق قائمة عناصر التذكرة الحالية.
  const [editPreviousItems, setEditPreviousItems] = useState<Map<string, EditPreviousItem[]>>(new Map());
  const [cancelledTickets, setCancelledTickets] = useState<CancelledTicket[]>([]);
  const [activeView, setActiveView] = useState<'pending' | 'log'>('pending');
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  const ticketsRef = useRef<KitchenOrder[]>([]);
  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);

  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
  const alertUrlRef = useRef<string | null>(null);
  const editAudioRef = useRef<HTMLAudioElement | null>(null);
  const editUrlRef = useRef<string | null>(null);
  const cancelAudioRef = useRef<HTMLAudioElement | null>(null);
  const cancelUrlRef = useRef<string | null>(null);

  // آخر حالة معروفة لكل طلب (status + last_edit_id)، تُستخدم لتصنيف أحداث
  // realtime (جديد/معدَّل/ملغى) دون الاعتماد على payload.old غير الموثوق.
  const knownOrderStateRef = useRef<Map<string, { status: string; last_edit_id: string | null }>>(new Map());
  const cancelTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const fetchPendingOrders = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('orders')
      .select('id, order_type, total_amount, created_at, driver_id, client_name, last_edit_id, order_items(id, item_name, quantity, price)')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'preparing')
      .is('kitchen_ready_at', null)
      .is('archived_at', null)
      .order('created_at', { ascending: true })
      .limit(100);
    const rows = (data as unknown as KitchenOrder[]) || [];
    setTickets(rows);

    // بذر الكاش المحلي بحالة "قيد التجهيز" لكل الصفوف المُستلَمة — آمن لأن
    // شرط WHERE بهذا الاستعلام يضمن status='preparing' لكل صف مُعاد.
    rows.forEach(row => knownOrderStateRef.current.set(row.id, { status: 'preparing', last_edit_id: row.last_edit_id }));

    // جلب previous_items للتذاكر المعدَّلة فقط — استعلام ثانٍ IN(...) واحد
    // بدل جلب order_edits لكل تذكرة على حدة.
    const editIds = [...new Set(rows.map(r => r.last_edit_id).filter((id): id is string => !!id))];
    if (editIds.length === 0) {
      setEditPreviousItems(new Map());
      return;
    }
    const { data: edits } = await supabase
      .from('order_edits')
      .select('id, previous_items')
      .in('id', editIds);
    const map = new Map<string, EditPreviousItem[]>();
    (edits || []).forEach((e: { id: string; previous_items: EditPreviousItem[] }) => map.set(e.id, e.previous_items || []));
    setEditPreviousItems(map);
  }, [restaurantId]);

  // سجل زمني لكل الطلبات الواردة (بلا فلترة حسب الحالة) — الأحدث أولاً، بحد
  // أقصى 50 صفاً، مستقل عن مسار المطبخ الحالي (pending/ready/...).
  const fetchOrdersLog = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('orders')
      .select('id, created_at, client_name, order_items(item_name)')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(50);
    setLogEntries(((data as unknown as { id: string; created_at: string; client_name: string; order_items?: { item_name: string }[] }[]) || []).map(o => ({
      id: o.id, created_at: o.created_at, client_name: o.client_name,
      items: (o.order_items || []).map(it => it.item_name),
    })));
  }, [restaurantId]);

  useEffect(() => {
    if (!unlocked || !restaurantId) return;
    fetchPendingOrders();
  }, [unlocked, restaurantId, fetchPendingOrders]);

  // جلب سجل الطلبات كسولاً عند فتح تبويب "قسم الطلبات" فقط أول مرة يُفتح.
  useEffect(() => {
    if (activeView === 'log' && restaurantId) fetchOrdersLog();
  }, [activeView, restaurantId, fetchOrdersLog]);

  // بدء دورة حياة بطاقة الإلغاء الحمراء: تظهر فوراً بلقطة آخر حالة معروفة
  // للطلب، وتختفي تلقائياً بعد 5 ثوانٍ.
  const beginCancelledCardLifecycle = useCallback((orderId: string) => {
    const snapshot = ticketsRef.current.find(t => t.id === orderId);
    if (!snapshot) return;
    setCancelledTickets(prev => [...prev.filter(t => t.id !== orderId), { ...snapshot, cancelledAt: Date.now() }]);

    const existing = cancelTimersRef.current.get(orderId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setCancelledTickets(prev => prev.filter(t => t.id !== orderId));
      cancelTimersRef.current.delete(orderId);
    }, 5000);
    cancelTimersRef.current.set(orderId, timer);
  }, []);

  // نقطة الدخول الوحيدة لكل حدث realtime واحد (INSERT أو UPDATE) على orders:
  // تصنّفه (جديد/معدَّل/ملغى/تجاهل) بمقارنته بـknownOrderStateRef، تُشغّل الصوت
  // المناسب مرة واحدة بالضبط، ثم تُحدّث الكاش والقوائم المعروضة.
  const handleOrderEvent = useCallback((eventType: 'INSERT' | 'UPDATE', row: OrdersRealtimeRow) => {
    const kind = classifyOrderEvent(knownOrderStateRef.current, eventType, row);

    if (row.status === 'preparing') {
      knownOrderStateRef.current.set(row.id, { status: row.status, last_edit_id: row.last_edit_id });
    } else {
      knownOrderStateRef.current.delete(row.id);
    }

    if (kind === 'new') playOnce(alertAudioRef);
    if (kind === 'edited') playOnce(editAudioRef);
    if (kind === 'cancelled') {
      playOnce(cancelAudioRef);
      beginCancelledCardLifecycle(row.id);
    }

    if (eventType === 'INSERT') { setTimeout(fetchPendingOrders, 400); setTimeout(fetchOrdersLog, 400); }
    else { fetchPendingOrders(); fetchOrdersLog(); }
  }, [fetchPendingOrders, fetchOrdersLog, beginCancelledCardLifecycle]);

  // قناة realtime واحدة: INSERT بتأخير بسيط (order_items تُدرج مباشرة بعد orders
  // بنفس دالة submitOrder، والتأخير يضمن وصولها قبل إعادة الجلب)، وUPDATE فوري
  // (يلتقط تعليم "تم التجهيز" من أي شاشة مطبخ أخرى مفتوحة بنفس الوقت).
  useEffect(() => {
    if (!unlocked || !restaurantId) return;
    const ch = supabase.channel('kitchen-display-' + restaurantId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, (payload) => {
        handleOrderEvent('INSERT', payload.new as OrdersRealtimeRow);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, (payload) => {
        handleOrderEvent('UPDATE', payload.new as OrdersRealtimeRow);
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') { fetchPendingOrders(); fetchOrdersLog(); } });
    return () => { supabase.removeChannel(ch); };
  }, [unlocked, restaurantId, fetchPendingOrders, fetchOrdersLog, handleOrderEvent]);

  // تنظيف مؤقتات بطاقات الإلغاء عند إلغاء تركيب الصفحة، لتفادي setState بعد unmount.
  useEffect(() => {
    return () => {
      cancelTimersRef.current.forEach(t => clearTimeout(t));
      cancelTimersRef.current.clear();
    };
  }, []);

  // عناصر الصوت الثلاثة تُنشأ مرة واحدة فقط عند فتح القفل (وليس بكل تغيّر بعدد
  // الطلبات) لتفادي تراكم Blob URLs غير محرَّرة على شاشة تبقى مفتوحة طوال اليوم.
  useEffect(() => {
    if (!unlocked) return;
    const url = makeKitchenAlertWavUrl();
    if (!url) return;
    alertUrlRef.current = url;
    alertAudioRef.current = new Audio(url);
    alertAudioRef.current.volume = 1;
    return () => { URL.revokeObjectURL(url); alertAudioRef.current = null; alertUrlRef.current = null; };
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    const url = makeKitchenEditWavUrl();
    if (!url) return;
    editUrlRef.current = url;
    editAudioRef.current = new Audio(url);
    editAudioRef.current.volume = 1;
    return () => { URL.revokeObjectURL(url); editAudioRef.current = null; editUrlRef.current = null; };
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    const url = makeKitchenCancelWavUrl();
    if (!url) return;
    cancelUrlRef.current = url;
    cancelAudioRef.current = new Audio(url);
    cancelAudioRef.current.volume = 1;
    return () => { URL.revokeObjectURL(url); cancelAudioRef.current = null; cancelUrlRef.current = null; };
  }, [unlocked]);

  // Tick دوري لتحديث "منذ كم دقيقة" (waitInfo) بكل البطاقات دون إعادة جلب من DB
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const markReady = async (order: KitchenOrder) => {
    setSavingIds(prev => new Set(prev).add(order.id));
    const update: { kitchen_ready_at: string; status?: 'completed' | 'pickup' } = {
      kitchen_ready_at: new Date().toISOString(),
    };

    // صالة/محلي واستلام كاونتر: ما فيها أي خطوة بعد التجهيز — تكتمل فوراً.
    // توصيل: تبقى قيد التجهيز لحد ما سائق يوافق (يظهر بقائمة السواق)، وإذا
    // كان سائق موافق أصلاً تنتقل لـ"انتظار السائق" فوراً مع إشعاره.
    if (order.order_type === 'local' || order.order_type === 'pickup') {
      update.status = 'completed';
    } else if (order.driver_id) {
      update.status = 'pickup';
    }

    const { error } = await supabase.from('orders')
      .update(update)
      .eq('id', order.id)
      .eq('status', 'preparing')
      .is('kitchen_ready_at', null);

    if (!error && update.status === 'pickup' && order.driver_id) {
      fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await pushAuthHeaders()) },
        body: JSON.stringify({
          driver_id: order.driver_id,
          title: '🍔 الطلب جاهز!',
          body: `طلب ${order.client_name} جاهز — تعال استلمه من المطعم`,
          url: `/delivery/${order.id}`,
          tag: `ready-${order.id}`,
        }),
      }).catch(() => {});
    }

    // لا نُحدّث tickets يدوياً — قناة UPDATE الحية تُعيد fetchPendingOrders()
    // وهي مصدر الحقيقة الوحيد لضمان تزامن كل الشاشات المفتوحة بدون تعارض.
    setSavingIds(prev => { const next = new Set(prev); next.delete(order.id); return next; });
  };

  if (!unlocked) return <UnlockScreen dark={dark} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className={`min-h-screen ${dark ? 'bg-[#212121]' : 'bg-gray-50'}`} dir="rtl">
      <div className={`sticky top-0 z-10 px-6 py-4 flex items-center justify-between border-b ${dark ? 'bg-[#2a2a2a] border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <ChefHat size={28} className="text-[#f97316]" />
          <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>شاشة المطبخ</h1>
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={() => setActiveView('pending')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                activeView === 'pending'
                  ? 'bg-[#f97316] text-white'
                  : dark ? 'bg-[#333] text-slate-300' : 'bg-gray-100 text-gray-600'
              }`}
            >
              قيد التجهيز
            </button>
            <button
              onClick={() => setActiveView('log')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                activeView === 'log'
                  ? 'bg-[#f97316] text-white'
                  : dark ? 'bg-[#333] text-slate-300' : 'bg-gray-100 text-gray-600'
              }`}
            >
              قسم الطلبات
            </button>
          </div>
        </div>
        <span className={`text-lg font-bold ${dark ? 'text-slate-300' : 'text-gray-500'}`}>{tickets.length} طلب معلّق</span>
      </div>

      {activeView === 'log' ? (
        logEntries.length === 0 ? (
          <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
            <p className={`text-3xl font-bold ${dark ? 'text-slate-500' : 'text-gray-300'}`}>لا يوجد سجل طلبات</p>
          </div>
        ) : (
          <div className="p-4 md:p-6 flex flex-col gap-2 max-w-4xl mx-auto">
            {logEntries.map(entry => (
              <div
                key={entry.id}
                className={`px-5 py-3 rounded-xl flex items-center justify-between gap-4 ${dark ? 'bg-[#2a2a2a]' : 'bg-white'}`}
              >
                <span className={`flex-1 text-sm md:text-base font-medium truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>
                  {entry.items.length ? entry.items.join('، ') : '—'}
                </span>
                <span className={`text-sm md:text-base ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {entry.client_name || '— بدون اسم —'}
                </span>
                <span className={`text-sm md:text-base font-bold ${dark ? 'text-slate-400' : 'text-gray-400'}`}>
                  {fmtTime(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        )
      ) : tickets.length === 0 && cancelledTickets.length === 0 ? (
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <p className={`text-3xl font-bold ${dark ? 'text-slate-500' : 'text-gray-300'}`}>لا طلبات معلّقة حالياً</p>
        </div>
      ) : (
        <div className="p-4 md:p-6 flex flex-col gap-6 max-w-4xl mx-auto">
          <AnimatePresence>
            {cancelledTickets.map(order => (
              <motion.div
                key={order.id}
                initial={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <TicketCard order={order} dark={dark} editPreviousItems={editPreviousItems} onMarkReady={markReady} saving={false} variant="cancelled" />
              </motion.div>
            ))}
          </AnimatePresence>
          {tickets.map(order => (
            <TicketCard
              key={order.id}
              order={order}
              dark={dark}
              editPreviousItems={editPreviousItems}
              onMarkReady={markReady}
              saving={savingIds.has(order.id)}
              variant="pending"
            />
          ))}
        </div>
      )}
    </div>
  );
}
