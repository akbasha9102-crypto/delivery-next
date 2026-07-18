'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Session } from '@/lib/session';
import DeliveryMapModal from '@/components/DeliveryMapModal';
import DriverBottomNav from '@/components/DriverBottomNav';
import {
  ChevronRight, Clock, CheckCircle2,
  MessageCircle, MapPin, Loader2, AlertTriangle,
} from 'lucide-react';

type OrderItem = { id: string; item_name: string; quantity: number; price: number };
type ArchivedOrder = {
  id: string;
  client_name: string;
  client_phone: string;
  delivery_address: string | null;
  total_amount: number;
  created_at: string;
  client_note: string | null;
  items: OrderItem[];
};

const PAGE_SIZE = 30;

type ArchivedOrderRow = Omit<ArchivedOrder, 'items'>;
type OrderItemRow = OrderItem & { order_id: string };

async function fetchArchivePage(driverId: string, offset: number) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, client_name, client_phone, delivery_address, total_amount, created_at, client_note')
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;
  if (!data) return { orders: [] as ArchivedOrder[], hasMore: false };

  const orders = data as ArchivedOrderRow[];
  const ids = orders.map(o => o.id);
  const { data: itemsData, error: itemsError } = ids.length
    ? await supabase.from('order_items').select('id, item_name, quantity, price, order_id').in('order_id', ids).order('id')
    : { data: [], error: null };

  if (itemsError) throw itemsError;

  const items = (itemsData ?? []) as OrderItemRow[];
  const itemsByOrder = new Map<string, OrderItem[]>();
  items.forEach(it => {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push({ id: it.id, item_name: it.item_name, quantity: it.quantity, price: it.price });
    itemsByOrder.set(it.order_id, arr);
  });

  const withItems: ArchivedOrder[] = orders.map(o => ({ ...o, items: itemsByOrder.get(o.id) ?? [] }));
  return { orders: withItems, hasMore: orders.length === PAGE_SIZE };
}

function localDayOf(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayLabel(dayStr: string) {
  const today = localDayOf(new Date().toISOString());
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = localDayOf(y.toISOString());
  if (dayStr === today) return 'اليوم';
  if (dayStr === yesterday) return 'أمس';
  return new Date(dayStr + 'T00:00:00').toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function DriverArchive() {
  const router = useRouter();
  const [session,     setSession]     = useState<Session | null>(null);
  const [orders,      setOrders]      = useState<ArchivedOrder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [offset,      setOffset]      = useState(0);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [mapAddress,  setMapAddress]  = useState<string | null>(null);
  const [error,       setError]       = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  // قراءة الجلسة
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('driver_session') : null;
    if (!raw) { router.replace('/'); return; }
    setSession(JSON.parse(raw) as Session);
  }, [router]);

  const loadFirstPage = useCallback((driverId: string) => {
    setLoading(true);
    setError(false);
    fetchArchivePage(driverId, 0)
      .then(({ orders: page, hasMore: more }) => {
        setOrders(page);
        setHasMore(more);
        setOffset(page.length);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!session) return;
    loadFirstPage(session.id);
  }, [session, loadFirstPage]);

  const loadMore = async () => {
    if (!session || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const { orders: page, hasMore: more } = await fetchArchivePage(session.id, offset);
      setOrders(prev => [...prev, ...page]);
      setHasMore(more);
      setOffset(offset + page.length);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">

      {/* هيدر */}
      <header className="sticky top-0 z-40 bg-slate-800/95 backdrop-blur border-b border-slate-700/60 px-4 py-3.5 flex items-center justify-between">
        <Link href="/dashboard" className="p-2 rounded-xl bg-slate-700 active:scale-90 transition-all">
          <ChevronRight size={17} className="text-slate-300" />
        </Link>
        <p className="font-black text-white text-base">الأرشيف</p>
        <div className="w-9" />
      </header>

      <div className="px-4 pt-4 space-y-2.5 max-w-lg mx-auto">

        {loading && <div className="flex justify-center py-14"><Loader2 className="animate-spin text-slate-500" size={28} /></div>}

        {!loading && error && (
          <div className="text-center py-14 space-y-3">
            <p className="text-6xl">⚠️</p>
            <p className="text-slate-300 font-black text-lg">تعذر تحميل الأرشيف</p>
            <p className="text-slate-500 text-sm">تحقق من الاتصال بالإنترنت وحاول مرة أخرى</p>
            <button
              onClick={() => loadFirstPage(session.id)}
              className="mt-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-2xl text-sm active:scale-95 transition-all">
              إعادة المحاولة
            </button>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-14 space-y-2">
            <p className="text-6xl">📦</p>
            <p className="text-slate-300 font-black text-lg">لا توجد رحلات مكتملة بعد</p>
          </div>
        )}

        {!loading && !error && orders.map((order, i) => {
          const day = localDayOf(order.created_at);
          const prevDay = i > 0 ? localDayOf(orders[i - 1].created_at) : null;
          const expanded = expandedId === order.id;
          return (
            <div key={order.id}>
              {day !== prevDay && (
                <p className="text-slate-500 text-xs font-bold px-1 pt-2">{dayLabel(day)}</p>
              )}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : order.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpandedId(expanded ? null : order.id); }}
                className="w-full text-right bg-slate-800 rounded-2xl border border-slate-700/60 overflow-hidden active:scale-[0.99] transition-all cursor-pointer">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Clock size={12} />
                    <span>{new Date(order.created_at).toLocaleString('ar-IQ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-black text-base">
                      {order.total_amount.toLocaleString()}<span className="text-xs font-normal text-slate-500"> د.ع</span>
                    </span>
                    <p className="text-white font-bold text-sm">{order.client_name}</p>
                    <CheckCircle2 size={15} className="text-green-500" />
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-slate-700/60 px-4 py-3 space-y-2.5" onClick={e => e.stopPropagation()}>
                    {order.client_phone && (
                      <a href={`https://wa.me/${order.client_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-end gap-2 active:scale-95 transition-all">
                        <span className="text-[#25D366] font-black text-lg" dir="ltr">{order.client_phone}</span>
                        <MessageCircle size={18} className="text-[#25D366]" />
                      </a>
                    )}
                    {order.delivery_address && (
                      <button onClick={() => setMapAddress(order.delivery_address)}
                        className="w-full flex items-center gap-2 bg-blue-900/30 border border-blue-700/40 rounded-xl px-3 py-2.5 active:scale-[0.98] transition-all text-right">
                        <MapPin size={16} className="text-blue-400 flex-shrink-0" />
                        <span className="text-blue-300 font-bold text-sm flex-1">{order.delivery_address}</span>
                      </button>
                    )}
                    {order.items.length > 0 && (
                      <div className="bg-slate-900/50 rounded-xl px-3 py-2.5 space-y-1.5">
                        {order.items.map(it => (
                          <div key={it.id} className="flex justify-between items-center">
                            <span className="text-amber-400 font-bold text-xs">{(it.price * it.quantity).toLocaleString()} د.ع</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-300 text-sm">{it.item_name}</span>
                              <span className="bg-slate-700 text-slate-400 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{it.quantity}×</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {order.client_note && (
                      <p className="text-amber-400 bg-amber-900/20 rounded-xl px-3 py-2 text-sm text-right">📝 {order.client_note}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {hasMore && !loading && !error && (
          <div className="space-y-1.5">
            {loadMoreError && (
              <p className="flex items-center justify-center gap-1.5 text-red-400 text-xs font-bold">
                <AlertTriangle size={13} /> تعذر تحميل المزيد
              </p>
            )}
            <button onClick={loadMore} disabled={loadingMore}
              className="w-full py-3 text-slate-400 text-sm font-bold active:scale-95 transition-all disabled:opacity-50">
              {loadingMore ? 'جاري التحميل...' : loadMoreError ? 'إعادة المحاولة' : 'تحميل المزيد'}
            </button>
          </div>
        )}

        {mapAddress && <DeliveryMapModal address={mapAddress} onClose={() => setMapAddress(null)} />}

      </div>

      <DriverBottomNav />
    </div>
  );
}
