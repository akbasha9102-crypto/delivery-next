import { supabase } from '@/lib/supabase/client';
import { convertToInventoryUnit } from '@/lib/utils/unitConversion';
import { deductStockForOrder, type StockOrderItem } from '@/lib/utils/deduct-stock';

export type { StockOrderItem };

// تسوية المخزون عند تعديل طلب (قبول تعديل كاشير فوري، أو قبول تعديل زبون
// من صفحة التتبع بعد مراجعة الكاشير): "نُرجع" مكوّنات العناصر القديمة
// للمخزون ثم "نخصم" مكوّنات العناصر الجديدة — بدل حساب الفرق بينهما، أبسط
// وأقل عرضة لخطأ حسابي، ويطابق نفس فلسفة deductStockForOrder/returnStockForOrder
// الحاليتين (best-effort، لا تفشل تدفق الطلب بسبب عطل بالمخزون).
//
// ⚠️ لماذا لا نُعيد استخدام returnStockForOrder هنا لجزء "الإرجاع":
// تلك الدالة تعمل بالبحث عن حركات OUT_ORDER سابقة مسجَّلة بنفس
// reference_id لتعرف *كم* تُرجع (mirror). هنا reference_id هو معرّف
// order_edits جديد يُنشأ لحظة هذا التعديل بالذات — لا توجد أي حركة OUT_ORDER
// سابقة مسجَّلة تحته لتُقرأ (خصم الطلب الأصلي كان مسجَّلاً بـ reference_id
// = orderId ونوع 'order'، وليس بمعرّف تعديل لم يكن موجوداً وقتها). لذلك
// "الإرجاع" هنا مبني مباشرة من previousItems الممرَّرة (نفس توسّع الوصفة
// المستخدَم بـ deductStockForOrder)، وليس بالبحث عن حركات قديمة.
async function returnItemsDirectly(restaurantId: string, editId: string, items: StockOrderItem[], clientName: string) {
  const itemIds = [...new Set(items.filter(i => i.item_id).map(i => i.item_id as string))];
  if (itemIds.length === 0) return;

  const { data: recipes } = await supabase.from('menu_recipes').select('*, inventory_items(unit)').in('menu_item_id', itemIds);
  if (!recipes || recipes.length === 0) return;

  const movements = items.flatMap(oi => {
    if (!oi.item_id) return [];
    return recipes
      .filter(r => r.menu_item_id === oi.item_id)
      .map(r => ({
        inventory_item_id: r.inventory_item_id,
        restaurant_id: restaurantId,
        movement_type: 'RETURN',
        quantity_changed: convertToInventoryUnit(r.quantity_required, r.unit, r.inventory_items?.unit) * oi.quantity,
        reference_id: editId,
        reference_type: 'order_edit',
        notes: `إرجاع مخزون تلقائي — تعديل طلب ${clientName}`,
      }));
  });
  if (movements.length === 0) return;

  const { error } = await supabase.from('stock_movements').insert(movements);
  if (error) console.error('تعذّر إرجاع المخزون تلقائياً لتعديل الطلب', editId, error.message);
}

// تُستدعى بعد تطبيق تعديل طلب فعلياً (سواء تعديل كاشير فوري أو قبول تعديل
// زبون) لتسوية المخزون: إرجاع مكونات previousItems ثم خصم مكونات newItems.
// best-effort مثل باقي أدوات المخزون بالمشروع — لا تُلقي استثناءً يوقف تدفق
// الطلب، فقط تُسجّل الخطأ بالـ console إن فشل جزء منها.
export async function adjustStockForOrderEdit(
  restaurantId: string,
  editId: string,
  previousItems: StockOrderItem[],
  newItems: StockOrderItem[],
  clientName: string
): Promise<void> {
  await returnItemsDirectly(restaurantId, editId, previousItems, clientName);
  await deductStockForOrder(restaurantId, editId, clientName, newItems, 'order_edit');
}
