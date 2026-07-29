import { supabaseAdmin } from '@/lib/supabase/admin';

// عند إلغاء/استرجاع طلب سبق أن خُصم مخزونه فعلياً (أي انتقل لحالة preparing/pickup/ready/
// completed قبل الإلغاء)، يجب إرجاع نفس كميات المكوّنات المخصومة — وإلا يتراكم فرق وهمي
// دائم بين المخزون المسجّل والمخزون الحقيقي (راجع الخطأ #12 بتقرير الفحص). تُستدعى من كل
// مسار ينهي طلباً بإلغاء/استرجاع فعلي (void/refund المباشر + موافقة المالك اللاحقة عليهما).
export async function returnStockForOrder(restaurantId: string, orderId: string, reasonLabel: string) {
  const { data: deducted, error: fetchError } = await supabaseAdmin
    .from('stock_movements')
    .select('inventory_item_id, quantity_changed')
    .eq('reference_type', 'order')
    .eq('reference_id', orderId)
    .eq('movement_type', 'OUT_ORDER');

  if (fetchError || !deducted || deducted.length === 0) return;

  // حماية من الإرجاع المزدوج لو استُدعيت هذه الدالة أكثر من مرة لنفس الطلب
  const { data: alreadyReturned } = await supabaseAdmin
    .from('stock_movements')
    .select('id')
    .eq('reference_type', 'order')
    .eq('reference_id', orderId)
    .eq('movement_type', 'RETURN')
    .limit(1);

  if (alreadyReturned && alreadyReturned.length > 0) return;

  const movements = deducted.map(m => ({
    inventory_item_id: m.inventory_item_id,
    restaurant_id: restaurantId,
    movement_type: 'RETURN',
    quantity_changed: Math.abs(Number(m.quantity_changed)),
    reference_id: orderId,
    reference_type: 'order',
    notes: `إرجاع مخزون تلقائي — ${reasonLabel}`,
  }));

  const { error } = await supabaseAdmin.from('stock_movements').insert(movements);
  if (error) console.error('تعذّر إرجاع المخزون تلقائياً للطلب', orderId, error.message);
}
