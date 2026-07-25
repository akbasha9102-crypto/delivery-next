'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, History, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/context/RestaurantContext';
import { useStaff } from '@/context/StaffContext';
import { OwnerOnly } from '@/components/guards/OwnerOnly';
import { AdminHeader } from '@/components/layout/AdminHeader';
import type { StaffActionLog } from '@/lib/api/staffApi';
import { translateAuditAction } from '@/lib/constants/audit-translations';
import { describeAuditLog } from '@/lib/utils/audit-describe';

const OWNER_FILTER_VALUE = 'owner';

/**
 * سجل التدقيق — عرض فقط للمالك/المدير (راجع OwnerOnly). لا توجد نقطة GET مخصّصة
 * لـ staff_actions_log ضمن العقد المتفق عليه، لذا نقرأ الجدول مباشرة عبر
 * Supabase (نفس نمط قراءة inventory_items/stock_movements الحالي في admin/inventory).
 */
export default function AuditLogPage() {
  const router = useRouter();
  const { restaurantId } = useRestaurant();
  const { isOwner, staffList } = useStaff();
  const [logs, setLogs] = useState<StaffActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string>('');
  const [filterDate, setFilterDate] = useState('');
  // قيم الفلتر المُطبَّقة فعلياً بالاستعلام — منفصلة عن قيم لوحة "تخصيص" حتى
  // لا يُعاد الجلب مع كل تغيير بالـ select/input قبل الضغط على "تطبيق".
  const [appliedActorId, setAppliedActorId] = useState('');
  const [appliedDate, setAppliedDate] = useState('');

  const hasActiveFilter = Boolean(appliedActorId || appliedDate);

  // معرّف المالك الحقيقي (auth.uid) — لازم لفلتر "المالك" (performed_by_auth_id
  // يخزّن auth.uid لا restaurant_id). restaurants قابلة للقراءة العامة (RLS).
  useEffect(() => {
    if (!restaurantId) return;
    supabase.from('restaurants').select('owner_id').eq('id', restaurantId).maybeSingle()
      .then(({ data }) => setOwnerId((data?.owner_id as string) ?? null));
  }, [restaurantId]);

  const fetchLogs = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    let q = supabase.from('staff_actions_log').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(200);

    if (appliedActorId) {
      const actorUserId = appliedActorId === OWNER_FILTER_VALUE ? ownerId : appliedActorId;
      if (actorUserId) q = q.eq('performed_by_auth_id', actorUserId);
    }
    if (appliedDate) {
      q = q.gte('created_at', appliedDate + 'T00:00:00').lte('created_at', appliedDate + 'T23:59:59');
    }

    const { data, error } = await q;
    if (error) setErrored(true);
    else { setLogs((data as StaffActionLog[]) || []); setErrored(false); }
    setLoading(false);
  }, [restaurantId, appliedActorId, appliedDate, ownerId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actorLabel = (l: StaffActionLog): string => l.performed_by_label || 'غير معروف';

  const types = [...new Set(logs.map(l => l.action_type))];
  const filtered = typeFilter ? logs.filter(l => l.action_type === typeFilter) : logs;

  const applyFilters = () => {
    setAppliedActorId(selectedActorId);
    setAppliedDate(filterDate);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setSelectedActorId('');
    setFilterDate('');
    setAppliedActorId('');
    setAppliedDate('');
    setShowFilters(false);
  };

  return (
    <OwnerOnly>
    <div className="min-h-screen bg-gray-50 dark:bg-[#212121] pb-10" dir="rtl">
      <AdminHeader
        title="سجل التدقيق"
        icon={<History size={18} className="text-gray-500 dark:text-slate-400" />}
        right={
          isOwner ? (
            <button onClick={() => setShowFilters(true)} className="relative w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all">
              <SlidersHorizontal size={16} />
              {hasActiveFilter && <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-[#2563eb]" />}
            </button>
          ) : undefined
        }
        left={
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all"><ChevronRight size={18} /></button>
        }
      />

      <div className="px-4 pt-4">
        {types.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
            <button onClick={() => setTypeFilter(null)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${!typeFilter ? 'bg-[var(--admin-accent-light-bg)] border-[var(--admin-accent-light-border)] text-white dark:bg-[var(--admin-accent-dark)] dark:border-[var(--admin-accent-dark)]' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>الكل</button>
            {types.map(t => (
              <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${typeFilter === t ? 'bg-[var(--admin-accent-light-bg)] border-[var(--admin-accent-light-border)] text-white dark:bg-[var(--admin-accent-dark)] dark:border-[var(--admin-accent-dark)]' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                {translateAuditAction(t)}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" /></div>
        ) : errored ? (
          <div className="text-center mt-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm">تعذّر تحميل سجل التدقيق — الجدول قد لا يكون منشوراً بعد</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center mt-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm">لا توجد سجلات بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(l => {
              const detail = describeAuditLog(l);
              return (
                <div key={l.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{new Date(l.created_at).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    <span className="font-bold text-sm text-gray-900 dark:text-slate-100">{translateAuditAction(l.action_type)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">بواسطة</span>
                    <span className="text-xs font-bold" style={{ color: '#2563eb' }}>{actorLabel(l)}</span>
                  </div>
                  {detail && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 text-right mt-1.5 border-t border-gray-50 dark:border-slate-700 pt-1.5">{detail}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowFilters(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <button onClick={() => setShowFilters(false)} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all"><X size={16} /></button>
              <p className="font-bold text-gray-900 dark:text-slate-100">تخصيص العرض</p>
              <div className="w-9" />
            </div>
            <div className="px-5 pb-2">
              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">الموظف</p>
              <select value={selectedActorId} onChange={e => setSelectedActorId(e.target.value)} dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563eb] mb-3">
                <option value="">الكل</option>
                <option value={OWNER_FILTER_VALUE}>المالك</option>
                {staffList.map(s => (
                  <option key={s.user_id} value={s.user_id}>{s.display_name}</option>
                ))}
              </select>

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">التاريخ</p>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-center text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563eb] mb-4" />

              <div className="flex gap-2 mb-6">
                <button onClick={clearFilters} className="flex-1 bg-[#EF4444] text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-all">
                  مسح الفلاتر
                </button>
                <button onClick={applyFilters} className="flex-1 bg-gradient-to-b from-[#22A066] to-[#186341] dark:bg-none dark:bg-[#10B981] text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-all">
                  تطبيق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </OwnerOnly>
  );
}
