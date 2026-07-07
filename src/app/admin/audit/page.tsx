'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRestaurant } from '@/context/RestaurantContext';
import { OwnerOnly } from '@/components/OwnerOnly';
import type { StaffActionLog } from '@/lib/staffApi';

const ACTION_LABEL: Record<string, string> = {
  order_void: 'إلغاء طلب',
  order_refund: 'استرجاع مبلغ',
  discount_applied: 'تطبيق خصم',
  price_edit: 'تعديل سعر',
  item_deleted: 'حذف مادة',
  category_deleted: 'حذف قسم',
  settings_changed: 'تغيير إعدادات',
  inventory_adjust: 'تعديل مخزون',
  waste_registered: 'تسجيل هدر',
  shift_open: 'فتح وردية',
  shift_close: 'إغلاق وردية',
};

type JsonRecord = Record<string, unknown>;
const asRecord = (v: unknown): JsonRecord | null => (v && typeof v === 'object' ? v as JsonRecord : null);

function describeChange(l: StaffActionLog): string | null {
  const before = asRecord(l.before_data);
  const after  = asRecord(l.after_data);
  if (l.action_type === 'price_edit' && before && after) {
    return `${before.name ?? ''}: ${Number(before.price).toLocaleString()} ⟵ ${Number(after.price).toLocaleString()} د.ع`;
  }
  if ((l.action_type === 'item_deleted' || l.action_type === 'category_deleted') && before) {
    return `${before.name ?? ''}`;
  }
  if (l.action_type === 'settings_changed' && before && after) {
    const changedKeys = Object.keys(after).filter(k => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
    if (changedKeys.length === 0) return null;
    return `تغيّر: ${changedKeys.join('، ')}`;
  }
  return null;
}

/**
 * سجل التدقيق — عرض فقط للمالك. لا توجد نقطة GET مخصّصة لـ staff_actions_log ضمن العقد
 * المتفق عليه، لذا نقرأ الجدول مباشرة عبر Supabase (نفس نمط قراءة inventory_items/stock_movements
 * الحالي في admin/inventory) بانتظار أن يوفّر فريق الـ Backend endpoint مخصصاً إن احتاج الأمر.
 */
export default function AuditLogPage() {
  const router = useRouter();
  const { restaurantId } = useRestaurant();
  const [logs, setLogs] = useState<StaffActionLog[]>([]);
  const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchLogs = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    let q = supabase.from('staff_actions_log').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(200);
    if (fromDate) q = q.gte('created_at', fromDate);
    if (toDate) q = q.lte('created_at', toDate + 'T23:59:59');
    const { data, error } = await q;
    if (error) setErrored(true);
    else { setLogs((data as StaffActionLog[]) || []); setErrored(false); }
    setLoading(false);
  }, [restaurantId, fromDate, toDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!restaurantId) return;
    supabase.from('restaurant_staff').select('id, display_name').eq('restaurant_id', restaurantId).then(({ data }) => {
      setStaffNames(new Map((data || []).map(s => [s.id as string, s.display_name as string])));
    });
  }, [restaurantId]);

  const actorLabel = (l: StaffActionLog): string =>
    l.performed_by_label || (l.staff_id ? staffNames.get(l.staff_id) : null) || 'غير معروف';

  const types = [...new Set(logs.map(l => l.action_type))];
  const filtered = typeFilter ? logs.filter(l => l.action_type === typeFilter) : logs;

  return (
    <OwnerOnly>
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-10" dir="rtl">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 flex items-center justify-between">
        <div className="w-9" />
        <div className="flex items-center gap-2">
          <History size={18} className="text-[#2563eb]" />
          <p className="font-bold text-gray-900 dark:text-slate-100">سجل التدقيق</p>
        </div>
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all"><ChevronRight size={18} /></button>
      </header>

      <div className="px-4 pt-4">
        <div className="flex gap-2 mb-3">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-sm text-center border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 outline-none" />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-sm text-center border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 outline-none" />
        </div>

        {types.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
            <button onClick={() => setTypeFilter(null)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${!typeFilter ? 'bg-[#2563eb] border-[#2563eb] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>الكل</button>
            {types.map(t => (
              <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${typeFilter === t ? 'bg-[#2563eb] border-[#2563eb] text-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                {ACTION_LABEL[t] ?? t}
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
              const detail = describeChange(l);
              return (
                <div key={l.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{new Date(l.created_at).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    <span className="font-bold text-sm text-gray-900 dark:text-slate-100">{ACTION_LABEL[l.action_type] ?? l.action_type}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-bold" style={{ color: '#2563eb' }}>{actorLabel(l)}</span>
                    <span className="text-xs text-gray-400">بواسطة</span>
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
    </div>
    </OwnerOnly>
  );
}
