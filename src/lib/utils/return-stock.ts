import { supabaseAdmin } from '@/lib/supabase/admin';

// عند إلغاء/استرجاع طلب سبق أن خُصم مخزونه فعلياً (أي انتقل لحالة preparing/pickup/ready/
// completed قبل الإلغاء)، يجب إرجاع نفس كميات المكوّنات المخصومة — وإلا يتراكم فرق وهمي
// دائم بين المخزون المسجّل والمخزون الحقيقي (راجع الخطأ #12 بتقرير الفحص). تُستدعى من كل
// مسار ينهي طلباً بإلغاء/استرجاع فعلي (void/refund المباشر + موافقة المالك اللاحقة عليهما).
//
// تشمل أيضاً حركات المخزون الناتجة عن تعديلات الطلب (order_edits) — تلك تُسجَّل
// بـ reference_type='order_edit' و reference_id = معرّف صف order_edits (وليس
// معرّف الطلب نفسه)، فلا يكفي البحث بـ reference_id = orderId وحده، وإلا يُفقَد
// أي مخزون إضافي استُهلك بتعديلات لاحقة (خصم دائم وهمي بالمخزون).
export async function returnStockForOrder(restaurantId: string, orderId: string, reasonLabel: string) {
  const { data: deducted, error: fetchError } = await supabaseAdmin
    .from('stock_movements')
    .select('inventory_item_id, quantity_changed')
    .eq('reference_type', 'order')
    .eq('reference_id', orderId)
    .eq('movement_type', 'OUT_ORDER');

  if (fetchError) return;

  const { data: edits, error: editsError } = await supabaseAdmin
    .from('order_edits')
    .select('id')
    .eq('order_id', orderId);

  if (editsError) return;

  const editIds = (edits || []).map(e => e.id);

  let editDeducted: { inventory_item_id: string; quantity_changed: number; reference_id: string }[] = [];
  if (editIds.length > 0) {
    const { data: editMovements, error: editFetchError } = await supabaseAdmin
      .from('stock_movements')
      .select('inventory_item_id, quantity_changed, reference_id')
      .eq('reference_type', 'order_edit')
      .in('reference_id', editIds)
      .eq('movement_type', 'OUT_ORDER');

    if (editFetchError) return;
    editDeducted = editMovements || [];
  }

  const allDeducted = [...(deducted || []), ...editDeducted];
  if (allDeducted.length === 0) return;

  // حماية من الإرجاع المزدوج لو استُدعيت هذه الدالة أكثر من مرة لنفس الطلب —
  // تفحص أيضاً حركات RETURN المسجَّلة ضد معرّفات تعديلات هذا الطلب (بنفس
  // reference_type/reference_id المستخدَمين بخصم OUT_ORDER الأصلي لكل تعديل)،
  // وليس فقط ضد معرّف الطلب نفسه.
  const { data: alreadyReturnedOrder } = await supabaseAdmin
    .from('stock_movements')
    .select('id')
    .eq('reference_type', 'order')
    .eq('reference_id', orderId)
    .eq('movement_type', 'RETURN')
    .limit(1);

  if (alreadyReturnedOrder && alreadyReturnedOrder.length > 0) return;

  if (editIds.length > 0) {
    const { data: alreadyReturnedEdits } = await supabaseAdmin
      .from('stock_movements')
      .select('id')
      .eq('reference_type', 'order_edit')
      .in('reference_id', editIds)
      .eq('movement_type', 'RETURN')
      .limit(1);

    if (alreadyReturnedEdits && alreadyReturnedEdits.length > 0) return;
  }

  const orderMovements = (deducted || []).map(m => ({
    inventory_item_id: m.inventory_item_id,
    restaurant_id: restaurantId,
    movement_type: 'RETURN',
    quantity_changed: Math.abs(Number(m.quantity_changed)),
    reference_id: orderId,
    reference_type: 'order',
    notes: `إرجاع مخزون تلقائي — ${reasonLabel}`,
  }));

  // كل حركة إرجاع لتعديل تحمل نفس reference_id (معرّف صف order_edits) الذي
  // حمله خصمها الأصلي — يطابق نمط mirror المستخدَم بجزء 'order' أعلاه، ويُبقي
  // فحص الإرجاع المزدوج أعلاه متماسكاً (RETURN بنفس reference_type/reference_id).
  const editMovementsOut = editDeducted.map(m => ({
    inventory_item_id: m.inventory_item_id,
    restaurant_id: restaurantId,
    movement_type: 'RETURN',
    quantity_changed: Math.abs(Number(m.quantity_changed)),
    reference_id: m.reference_id,
    reference_type: 'order_edit',
    notes: `إرجاع مخزون تلقائي (تعديل طلب) — ${reasonLabel}`,
  }));

  const movements = [...orderMovements, ...editMovementsOut];

  const { error } = await supabaseAdmin.from('stock_movements').insert(movements);
  if (error) console.error('تعذّر إرجاع المخزون تلقائياً للطلب', orderId, error.message);
}
