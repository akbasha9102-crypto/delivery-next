'use client';
import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, X, Clock, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRestaurant } from '@/context/RestaurantContext';
import { useStaff } from '@/context/StaffContext';
import { listApprovals, resolveApproval, type ApprovalRequest } from '@/lib/staffApi';

async function getAccessToken(): Promise<string | undefined> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

const TYPE_LABEL: Record<ApprovalRequest['request_type'], string> = {
  void_order: 'إلغاء طلب',
  refund: 'استرجاع مبلغ',
  discount_override: 'تجاوز حد الخصم',
  price_override: 'تعديل سعر',
};

/**
 * زر "طلبات الموافقة" — عنصر داخل صفحة الإعدادات (يظهر فقط للمالك/المدير)، وليس عائماً فوق
 * الشاشة. يعرض طلبات approval_requests المعلّقة ويسمح بالموافقة/الرفض بضغطة واحدة. يعتمد على
 * نفس نمط Supabase Realtime المستخدم فعلاً في admin/layout.tsx (قناة postgres_changes) — بدون
 * أي endpoint جديد للقراءة اللحظية.
 *
 * ⚠️ نقطة GET /api/approvals تُستخدم للتحميل الأولي فقط حسب العقد؛ إن لم تكن منشورة بعد
 * (فريق الـ Backend يبنيها بالتوازي) فسيبقى العداد صفراً بصمت دون كسر الواجهة، والتحديث اللحظي
 * سيعمل بمجرد أن يبدأ جدول approval_requests فعلياً بالتلقي (الجدول يُنشئه فريق الـ Backend أيضاً).
 */
export function ApprovalsBell() {
  const { restaurantId } = useRestaurant();
  const { activeStaff } = useStaff();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ApprovalRequest[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const token = await getAccessToken();
    const res = await listApprovals(restaurantId, 'pending', token);
    if (res.ok) {
      const list = Array.isArray(res.data) ? res.data : ((res.data as { approvals?: ApprovalRequest[] })?.approvals ?? []);
      setPending(list as ApprovalRequest[]);
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase.channel('approvals-owner-' + restaurantId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_requests', filter: `restaurant_id=eq.${restaurantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, load]);

  const resolve = async (id: string, action: 'approve' | 'reject') => {
    if (!activeStaff) return;
    setResolving(id);
    const token = await getAccessToken();
    if (!token) { setResolving(null); return; }
    const res = await resolveApproval(id, action, token);
    setResolving(null);
    if (res.ok) setPending(prev => prev.filter(p => p.id !== id));
  };

  return (
    <>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 active:scale-95 transition-all">
        <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">طلبات الموافقة</span>
          <div className="relative w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <Bell size={16} className="text-blue-500" />
            {pending.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                {pending.length > 9 ? '9+' : pending.length}
              </span>
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-t-3xl md:rounded-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
              <button onClick={() => setOpen(false)} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500"><X size={16} /></button>
              <p className="font-bold text-gray-900 dark:text-slate-100">طلبات بانتظار الموافقة</p>
              <div className="w-9" />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {pending.length === 0 ? (
                <p className="text-center text-gray-400 dark:text-slate-500 py-10">لا توجد طلبات معلّقة الآن</p>
              ) : pending.map(req => (
                <div key={req.id} className="bg-gray-50 dark:bg-slate-700/50 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#2563eb] flex items-center gap-1"><Clock size={12} /> معلّق</span>
                    <span className="font-bold text-sm text-gray-900 dark:text-slate-100">{TYPE_LABEL[req.request_type] ?? req.request_type}</span>
                  </div>
                  {req.amount != null && <p className="text-sm text-gray-600 dark:text-slate-300 text-right mb-1">المبلغ: {req.amount.toLocaleString()} د.ع</p>}
                  {req.reason && <p className="text-xs text-gray-500 dark:text-slate-400 text-right mb-3">السبب: {req.reason}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => resolve(req.id, 'approve')} disabled={resolving === req.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                      <Check size={14} /> موافقة
                    </button>
                    <button onClick={() => resolve(req.id, 'reject')} disabled={resolving === req.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                      <X size={14} /> رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
