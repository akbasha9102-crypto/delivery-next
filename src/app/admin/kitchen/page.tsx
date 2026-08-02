'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChefHat } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/context/RestaurantContext';
import { useDarkMode } from '@/context/ThemeContext';
import { makeKitchenAlertWavUrl } from '@/lib/utils/kitchenAlertSound';

type KitchenOrderItem = { id: string; item_name: string; quantity: number; price: number };
type KitchenOrder = { id: string; created_at: string; order_type: 'delivery' | 'pickup' | 'local' | null; driver_id: string | null; client_name: string; order_items?: KitchenOrderItem[] };

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

/* ─────────────────────────────── الصفحة الرئيسية ─────────────────────────────── */
export default function KitchenDisplayPage() {
  const { restaurantId } = useRestaurant();
  const { dark } = useDarkMode();

  const [unlocked, setUnlocked] = useState(false);
  const [tickets, setTickets] = useState<KitchenOrder[]>([]);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);

  const ticketsRef = useRef<KitchenOrder[]>([]);
  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);

  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
  const alertUrlRef = useRef<string | null>(null);

  const fetchPendingOrders = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('orders')
      .select('id, order_type, total_amount, created_at, driver_id, client_name, order_items(id, item_name, quantity, price)')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'preparing')
      .is('kitchen_ready_at', null)
      .is('archived_at', null)
      .order('created_at', { ascending: true })
      .limit(100);
    setTickets((data as unknown as KitchenOrder[]) || []);
  }, [restaurantId]);

  useEffect(() => {
    if (!unlocked || !restaurantId) return;
    fetchPendingOrders();
  }, [unlocked, restaurantId, fetchPendingOrders]);

  // قناة realtime واحدة: INSERT بتأخير بسيط (order_items تُدرج مباشرة بعد orders
  // بنفس دالة submitOrder، والتأخير يضمن وصولها قبل إعادة الجلب)، وUPDATE فوري
  // (يلتقط تعليم "تم التجهيز" من أي شاشة مطبخ أخرى مفتوحة بنفس الوقت).
  useEffect(() => {
    if (!unlocked || !restaurantId) return;
    const ch = supabase.channel('kitchen-display-' + restaurantId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        setTimeout(fetchPendingOrders, 400);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        fetchPendingOrders();
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') fetchPendingOrders(); });
    return () => { supabase.removeChannel(ch); };
  }, [unlocked, restaurantId, fetchPendingOrders]);

  // عنصر الصوت يُنشأ مرة واحدة فقط عند فتح القفل (وليس بكل تغيّر بعدد الطلبات)
  // لتفادي تراكم Blob URLs غير محرَّرة على شاشة تبقى مفتوحة طوال اليوم.
  useEffect(() => {
    if (!unlocked) return;
    const url = makeKitchenAlertWavUrl();
    if (!url) return;
    alertUrlRef.current = url;
    alertAudioRef.current = new Audio(url);
    alertAudioRef.current.volume = 1;
    return () => { URL.revokeObjectURL(url); alertAudioRef.current = null; alertUrlRef.current = null; };
  }, [unlocked]);

  // صوت التنبيه المتكرر طالما توجد طلبات معلّقة — يعتمد على ticketsRef لتفادي stale closure بداخل setInterval
  useEffect(() => {
    if (!unlocked) return;
    const playAlert = () => {
      if (ticketsRef.current.length === 0) return;
      const a = alertAudioRef.current;
      if (a) { a.currentTime = 0; a.play().catch(() => {}); }
    };
    if (tickets.length > 0) playAlert();
    const interval = setInterval(playAlert, 15000);
    return () => clearInterval(interval);
  }, [unlocked, tickets.length]);

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
        </div>
        <span className={`text-lg font-bold ${dark ? 'text-slate-300' : 'text-gray-500'}`}>{tickets.length} طلب معلّق</span>
      </div>

      {tickets.length === 0 ? (
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <p className={`text-3xl font-bold ${dark ? 'text-slate-500' : 'text-gray-300'}`}>لا طلبات معلّقة حالياً</p>
        </div>
      ) : (
        <div className="p-4 md:p-6 flex flex-col gap-6 max-w-4xl mx-auto">
          {tickets.map(order => {
            const wait = waitInfo(order.created_at);
            const isLate = wait.color === '#ef4444';
            const saving = savingIds.has(order.id);
            const typeInfo = orderTypeInfo(order.order_type);
            return (
              <div
                key={order.id}
                className={`rounded-3xl overflow-hidden shadow-lg border-t-8 ${dark ? 'bg-[#2a2a2a]' : 'bg-white'} ${isLate ? 'animate-pulse' : ''}`}
                style={{ borderTopColor: wait.color }}
              >
                <div className="p-6 md:p-8">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-2xl md:text-3xl font-black px-4 py-1.5 rounded-xl"
                      style={{ color: typeInfo.color, backgroundColor: `${typeInfo.color}20` }}
                    >
                      {typeInfo.label}
                    </span>
                    <span
                      className="text-xl md:text-2xl font-bold px-3 py-1.5 rounded-lg"
                      style={{ color: wait.color, backgroundColor: `${wait.color}20` }}
                    >
                      {wait.text}
                    </span>
                  </div>
                  <p className={`text-sm md:text-base mb-5 ${dark ? 'text-slate-400' : 'text-gray-400'}`}>استُلم {fmtTime(order.created_at)}</p>

                  <ul className="space-y-3 mb-6">
                    {(order.order_items || []).map(it => (
                      <li key={it.id} className={`text-3xl md:text-4xl font-bold flex items-center gap-3 ${dark ? 'text-slate-100' : 'text-gray-800'}`}>
                        <span className="text-[#f97316]">×{it.quantity}</span>
                        <span>{it.item_name}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => markReady(order)}
                    disabled={saving}
                    className="w-full py-6 rounded-2xl bg-green-500 text-white text-2xl md:text-3xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Check size={32} />
                    تم التجهيز
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
