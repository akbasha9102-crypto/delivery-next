'use client';
import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/context/RestaurantContext';
import { useStaff } from '@/context/StaffContext';

/**
 * إشعار فوري للكاشير عند البتّ بطلب موافقة أرسله هو (استرجاع/إلغاء/خصم كبير).
 * يستمع لتحديثات approval_requests عبر Realtime (نفس نمط admin/layout.tsx).
 */
export function MyApprovalToast() {
  const { restaurantId } = useRestaurant();
  const { activeStaff } = useStaff();
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!restaurantId || !activeStaff?.staffId) return;
    const ch = supabase.channel('approvals-mine-' + activeStaff.staffId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'approval_requests', filter: `requested_by=eq.${activeStaff.staffId}` }, ({ new: row }: { new: { status?: string } }) => {
        if (row?.status === 'approved') setToast({ ok: true, msg: '✓ تمت الموافقة على طلبك' });
        else if (row?.status === 'rejected') setToast({ ok: false, msg: '✗ تم رفض طلبك' });
        if (row?.status !== 'pending') setTimeout(() => setToast(null), 5000);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, activeStaff?.staffId]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 inset-x-4 z-[80] flex justify-center" dir="rtl">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg font-bold text-sm text-white ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
        {toast.ok ? <Check size={16} /> : <X size={16} />}
        {toast.msg}
      </div>
    </div>
  );
}
