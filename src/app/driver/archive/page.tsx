'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ChevronRight, MessageCircle, MapPin, Loader2, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import DriverHeader from '../_components/DriverHeader';
import MapSheet from '../_components/MapSheet';

type ArchiveItem = { id: string; item_name: string; quantity: number; price: number };

type ArchiveOrder = {
  id: string;
  client_name: string;
  client_phone: string;
  delivery_address: string | null;
  total_amount: number | null;
  created_at: string;
  client_note: string | null;
  items: ArchiveItem[];
};

type Session = { id: string; name: string; phone: string };

const PAGE_SIZE = 20;

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return localDate(d);
}
function dayKey(dateStr: string) {
  return localDate(new Date(dateStr));
}
function dayLabel(dateStr: string) {
  const today = localDate();
  const yesterday = addDays(today, -1);
  if (dateStr === today) return 'اليوم';
  if (dateStr === yesterday) return 'أمس';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'short' });
}
function timeLabel(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
}

export default function DriverArchive() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<ArchiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mapAddress, setMapAddress] = useState<string | null>(null);

  // حارس المصادقة — نفس نمط لوحة السائق
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) { router.replace('/driver'); return; }

      const { data: driver } = await supabase
        .from('drivers')
        .select('id, name, phone')
        .eq('user_id', authSession.user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!driver) { await supabase.auth.signOut(); router.replace('/driver'); return; }

      setSession({ id: driver.id, name: driver.name, phone: driver.phone });
    })();
    return () => { cancelled = true; };
  }, [router]);

  // جلب صفحة من الأرشيف + عناصرها (batch لتفادي N+1)
  const fetchPage = useCallback(async (driverId: string, offset: number): Promise<{ rows: ArchiveOrder[]; more: boolean }> => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, client_name, client_phone, delivery_address, total_amount, created_at, client_note')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const rawOrders = (data || []) as Omit<ArchiveOrder, 'items'>[];
    const ids = rawOrders.map(o => o.id);
    const allItems = ids.length
      ? ((await supabase.from('order_items').select('id, item_name, quantity, price, order_id').in('order_id', ids)).data || []) as (ArchiveItem & { order_id: string })[]
      : [];
    const itemsByOrder = new Map<string, ArchiveItem[]>();
    allItems.forEach(it => {
      const arr = itemsByOrder.get(it.order_id) ?? [];
      arr.push(it);
      itemsByOrder.set(it.order_id, arr);
    });
    const rows: ArchiveOrder[] = rawOrders.map(o => ({ ...o, items: itemsByOrder.get(o.id) ?? [] }));
    return { rows, more: rawOrders.length === PAGE_SIZE };
  }, []);

  const loadFirst = useCallback(async (driverId: string) => {
    setLoading(true);
    setLoadError(false);
    try {
      const { rows, more } = await fetchPage(driverId, 0);
      setOrders(rows);
      setHasMore(more);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    if (!session) return;
    loadFirst(session.id);
  }, [session, loadFirst]);

  const loadMore = async () => {
    if (!session || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const { rows, more } = await fetchPage(session.id, orders.length);
      setOrders(prev => [...prev, ...rows]);
      setHasMore(more);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">

      {/* هيدر */}
      <DriverHeader
        right={
          <button onClick={() => router.push('/driver/dashboard')}
            className="p-2.5 rounded-xl bg-slate-800 active:scale-90 transition-all">
            <ChevronRight size={20} className="text-slate-300" />
          </button>
        }
        center={<h1 className="text-lg font-extrabold text-white">الأرشيف</h1>}
      />

      <div className="px-4 pt-4 space-y-3 max-w-lg mx-auto">

        {loading ? (
          <div className="flex justify-center mt-20">
            <Loader2 size={36} className="animate-spin text-blue-400" />
          </div>
        ) : loadError ? (
          <div className="text-center py-14 space-y-3">
            <p className="text-5xl">⚠️</p>
            <p className="text-slate-300 text-lg font-extrabold">تعذّر تحميل السجل</p>
            <button
              onClick={() => loadFirst(session.id)}
              className="mt-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-2xl active:scale-95 transition-all"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-14 space-y-3">
            <p className="text-6xl">📭</p>
            <p className="text-slate-300 text-xl font-extrabold">لا يوجد سجل توصيلات بعد</p>
            <p className="text-slate-500 text-sm">ستظهر توصيلاتك المكتملة هنا</p>
          </div>
        ) : (
          <>
            {orders.map((order, idx) => {
              const key = dayKey(order.created_at);
              const prevKey = idx > 0 ? dayKey(orders[idx - 1].created_at) : null;
              const showHeader = key !== prevKey;
              const isExpanded = expandedId === order.id;
              return (
                <div key={order.id}>
                  {showHeader && (
                    <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                      <CheckCircle2 size={14} className="text-green-400" />
                      <p className="text-slate-400 text-xs font-medium">{dayLabel(key)}</p>
                    </div>
                  )}
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                    {/* السطر المطوي — قابل للنقر للتوسيع */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className="w-full px-4 py-3.5 flex items-center justify-between active:bg-slate-800/40 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded
                          ? <ChevronUp size={16} className="text-slate-500" />
                          : <ChevronDown size={16} className="text-slate-500" />
                        }
                        <span className="text-green-400 font-extrabold text-base">
                          {(order.total_amount ?? 0).toLocaleString()}
                          <span className="text-xs font-normal text-slate-500"> د.ع</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-white text-base">{order.client_name}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{timeLabel(order.created_at)}</p>
                      </div>
                    </button>

                    {/* التفاصيل الموسّعة */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-800">
                        {/* الرقم — واتساب */}
                        {order.client_phone && (
                          <a href={`https://wa.me/${order.client_phone.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-end gap-2 pt-3 active:scale-95 transition-all">
                            <span className="text-[#25D366] font-extrabold text-xl tracking-wide" dir="ltr">
                              {order.client_phone}
                            </span>
                            <MessageCircle size={20} className="text-[#25D366]" />
                          </a>
                        )}

                        {/* العنوان — يفتح الخريطة */}
                        {order.delivery_address && (
                          <button
                            onClick={() => setMapAddress(order.delivery_address!)}
                            className="w-full flex items-center gap-2 bg-blue-900/30 border border-blue-700/40 rounded-xl px-3 py-2.5 active:scale-[0.98] transition-all text-right">
                            <MapPin size={18} className="text-blue-400 flex-shrink-0" />
                            <span className="text-blue-300 font-medium text-base flex-1">{order.delivery_address}</span>
                          </button>
                        )}

                        {/* عناصر الطلب */}
                        {order.items.length > 0 && (
                          <div className="bg-slate-800/60 rounded-xl px-3 py-2.5 space-y-2">
                            <p className="text-xs font-medium text-slate-400 text-right mb-1.5">محتوى الطلب</p>
                            {order.items.map(item => (
                              <div key={item.id} className="flex justify-between items-center">
                                <span className="text-green-400 font-medium text-xs">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-300 text-sm">{item.item_name}</span>
                                  <span className="bg-slate-700 text-slate-300 text-xs font-medium w-5 h-5 rounded-full flex items-center justify-center">{item.quantity}×</span>
                                </div>
                              </div>
                            ))}
                            <div className="pt-1 border-t border-slate-700 flex justify-between items-center">
                              <span className="text-green-400 font-extrabold text-sm">{(order.total_amount ?? 0).toLocaleString()} د.ع</span>
                              <span className="text-xs font-medium text-slate-400">الإجمالي</span>
                            </div>
                          </div>
                        )}

                        {/* ملاحظة الزبون */}
                        {order.client_note && (
                          <p className="text-sm text-amber-400 bg-amber-900/20 border border-amber-800/40 rounded-xl px-3 py-2 text-right">📝 {order.client_note}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* تحميل المزيد */}
            {hasMore && (
              <div className="pt-2 space-y-2">
                {loadMoreError && (
                  <p className="text-center text-red-400 text-sm">تعذّر تحميل المزيد — حاول مرة أخرى</p>
                )}
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full py-3.5 bg-blue-600 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                >
                  {loadingMore ? <Loader2 size={18} className="animate-spin" /> : null}
                  تحميل المزيد
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal الخريطة */}
      <MapSheet address={mapAddress} onClose={() => setMapAddress(null)} />
    </div>
  );
}
