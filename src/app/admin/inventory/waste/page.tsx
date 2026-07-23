'use client';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Package, Search, Trash2, X } from 'lucide-react';
import { useRestaurant } from '@/context/RestaurantContext';
import { useStaff } from '@/context/StaffContext';
import { listInventoryForStaff, registerWaste, type CashierInventoryItem } from '@/lib/api/staffApi';
import { AdminBottomNav } from '@/components/layout/BottomNav';
import { AdminHeader } from '@/components/layout/AdminHeader';

/**
 * شاشة مخزون الكاشير المبسّطة — عرض الكمية فقط (بدون تكلفة الشراء أو المورّد إطلاقاً)
 * + نموذج "تسجيل هدر/تلف" بسبب إلزامي. تعتمد على GET /api/inventory/list بدل الاستعلام
 * المباشر لقاعدة البيانات حتى لا تُسرَّب حقول التكلفة الحساسة لواجهة الكاشير مطلقاً.
 *
 * ⚠️ POST /api/inventory/waste ليست ضمن العقد الأصلي المتفق عليه — أضفناها هنا (انظر
 * src/lib/staffApi.ts لتفاصيلها) لأن الخطة تُلزم بتمكين الكاشير من تسجيل الهدر باسمه.
 */
export default function CashierInventoryWastePage() {
  const { restaurantId } = useRestaurant();
  const { activeStaff } = useStaff();
  const staffToken = activeStaff?.staffToken ?? null;

  const [items, setItems] = useState<CashierInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorLoading, setErrorLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<CashierInventoryItem | null>(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const fetchItems = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const res = await listInventoryForStaff(restaurantId, staffToken ?? undefined);
    if (res.ok) {
      const list = Array.isArray(res.data) ? res.data : ((res.data as { items?: CashierInventoryItem[] })?.items ?? []);
      setItems(list as CashierInventoryItem[]);
      setErrorLoading(false);
    } else {
      setErrorLoading(true);
    }
    setLoading(false);
  }, [restaurantId, staffToken]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const submit = async () => {
    if (!target || !restaurantId || !staffToken || !qty || !reason.trim()) return;
    const quantity = parseFloat(qty);
    if (isNaN(quantity) || quantity <= 0) return;
    setSaving(true);
    const res = await registerWaste({ item_id: target.id, quantity, reason: reason.trim() }, staffToken);
    setSaving(false);
    if (!res.ok) { showToast('error' in res ? res.error : 'تعذّر تسجيل الهدر', false); return; }
    showToast('✓ تم تسجيل الهدر');
    setTarget(null);
    setQty('');
    setReason('');
    fetchItems();
  };

  const filtered = items.filter(i => !search || i.name.includes(search));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 md:pb-0 md:mr-[70px]" dir="rtl">
      <AdminHeader title="المخزون — تسجيل هدر" icon={<Package size={18} className="text-[#f97316]" />} />

      {toast && (
        <div className={`mx-4 mt-3 px-4 py-3 rounded-xl border text-center font-bold text-sm ${toast.ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      <div className="px-4 pt-4">
        <div className="relative mb-3">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن مادة..." dir="rtl"
            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl py-3 pr-10 pl-4 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316]" />
        </div>

        {loading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" /></div>
        ) : errorLoading ? (
          <div className="text-center mt-16">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm">تعذّر تحميل بيانات المخزون حالياً — حاول لاحقاً</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center mt-16">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm">لا توجد مواد</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {filtered.map(item => {
              const isLow = item.current_stock <= item.min_alert_stock;
              return (
                <div key={item.id} className={`bg-white dark:bg-slate-800 rounded-2xl border p-4 flex items-center justify-between ${isLow ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-slate-700'}`}>
                  <button onClick={() => { setTarget(item); setQty(''); setReason(''); }}
                    className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 font-bold text-xs px-3 py-2 rounded-xl active:scale-95 transition-all">
                    <Trash2 size={13} /> تسجيل هدر
                  </button>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.category}</p>
                    <p className={`text-sm font-black mt-1 ${isLow ? 'text-red-500' : 'text-gray-900 dark:text-slate-100'}`}>
                      {item.current_stock.toLocaleString()} <span className="text-xs font-normal text-gray-400">{item.unit}</span>
                      {isLow && <AlertTriangle size={12} className="inline mr-1 text-red-500" />}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {target && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setTarget(null)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <button onClick={() => setTarget(null)} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all"><X size={16} /></button>
              <p className="font-bold text-gray-900 dark:text-slate-100">تسجيل هدر</p>
              <div className="w-9" />
            </div>
            <div className="px-5 pb-2">
              <p className="text-sm text-[#f97316] font-bold text-right mb-4">{target.name} — {target.current_stock.toLocaleString()} {target.unit} متوفّرة</p>

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">الكمية التالفة ({target.unit})</p>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-3" />

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">السبب (إلزامي)</p>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: انتهاء الصلاحية، سقط أرضاً..." dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316] mb-4" />

              <button onClick={submit} disabled={saving || !qty || !reason.trim()}
                className="w-full bg-red-500 disabled:opacity-40 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-all mb-6">
                {saving ? 'جاري الحفظ...' : 'تسجيل الهدر'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminBottomNav />
    </div>
  );
}
