'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminBottomNav } from '@/components/BottomNav';
import { useDarkMode } from '@/context/ThemeContext';
import { MessageSquare, AlertCircle, ChevronRight } from 'lucide-react';

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

type RejectedOrder = {
  id: string;
  client_name: string;
  client_phone: string;
  total_amount: number;
  delivery_address: string | null;
  created_at: string;
};

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function ArchivePage() {
  const router = useRouter();
  useDarkMode();
  const [feedbacks, setFeedbacks]       = useState<Feedback[]>([]);
  const [rejected, setRejected]         = useState<RejectedOrder[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterType, setFilterType]     = useState<'all' | 'feedback' | 'complaint'>('all');
  const [section, setSection]           = useState<'feedback' | 'rejected'>('feedback');

  const fetchFeedbacks = useCallback(async () => {
    const today = localDate();
    const start = new Date(today + 'T00:00:00').toISOString();
    const end   = new Date(today + 'T23:59:59').toISOString();

    const [fbRes, rejRes] = await Promise.all([
      supabase.from('order_feedback').select('*, orders(total_amount, delivery_address)').order('created_at', { ascending: false }).limit(200),
      supabase.from('orders').select('id, client_name, client_phone, total_amount, delivery_address, created_at').eq('status', 'rejected').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }),
    ]);

    const enriched: Feedback[] = (fbRes.data || []).map((f: any) => ({
      ...f,
      total_amount: f.orders?.total_amount,
      delivery_address: f.orders?.delivery_address,
    }));
    setFeedbacks(enriched);
    setRejected((rejRes.data as RejectedOrder[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchFeedbacks(); }, [fetchFeedbacks]);

  useEffect(() => {
    const ch = supabase.channel('archive-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_feedback' }, fetchFeedbacks)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchFeedbacks]);

  const filtered = filterType === 'all' ? feedbacks : feedbacks.filter(f => f.type === filterType);
  const complaints = feedbacks.filter(f => f.type === 'complaint').length;
  const notes = feedbacks.filter(f => f.type === 'feedback').length;

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-slate-900 pb-28">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-700 active:scale-90 transition-all">
          <ChevronRight size={20} className="text-gray-500 dark:text-slate-400" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">الأرشيف</h1>
        <div className="w-9" />
      </header>

      {/* أقسام رئيسية */}
      <div className="flex gap-2 px-3 pt-3 pb-2">
        <button onClick={() => setSection('feedback')}
          className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border transition-all ${section === 'feedback' ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
          💬 ملاحظات{feedbacks.length > 0 ? ` (${feedbacks.length})` : ''}
        </button>
        <button onClick={() => setSection('rejected')}
          className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border transition-all ${section === 'rejected' ? 'bg-red-500 border-red-500 text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
          ✕ مرفوضة{rejected.length > 0 ? ` (${rejected.length})` : ''}
        </button>
      </div>

      {section === 'feedback' ? (
        <>
          {/* إحصاء */}
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
            {(['all', 'feedback', 'complaint'] as const).map(t => {
              const labels = { all: 'الكل', feedback: '💡 ملاحظات', complaint: '⚠️ شكاوى' };
              return (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-all active:scale-95 ${filterType === t ? 'bg-[#f97316] border-[#f97316] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400'}`}>
                  {labels[t]}
                </button>
              );
            })}
          </div>
          <div className="px-3">
            {loading ? (
              <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center mt-24"><p className="text-5xl mb-3">📭</p><p className="text-gray-400 dark:text-slate-500 font-medium">لا توجد ملاحظات بعد</p></div>
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
      ) : (
        /* ═══ قسم المرفوضة ═══ */
        <div className="px-3 pt-1">
          {loading ? (
            <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : rejected.length === 0 ? (
            <div className="text-center mt-24"><p className="text-5xl mb-3">✅</p><p className="text-gray-400 dark:text-slate-500 font-medium">لا توجد طلبات مرفوضة اليوم</p></div>
          ) : (
            <div className="space-y-3 max-w-lg mx-auto">
              {rejected.map(order => (
                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AdminBottomNav />
    </div>
  );
}

export default function ArchivePageGuarded() {
  return <AdminGuard><ArchivePage /></AdminGuard>;
}
