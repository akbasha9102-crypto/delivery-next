import { supabase } from '@/lib/supabase/client';
import { convertToInventoryUnit } from '@/lib/utils/unitConversion';

export type StockOrderItem = { id: string; item_id?: string | null; item_name: string; quantity: number; price: number };

// خصم مكونات الوجبات (menu_recipes) من المخزون تلقائياً عند بدء تجهيز/بيع طلب —
// دالة مشتركة يستدعيها كل مسار ينشئ طلباً يخصم مخزوناً فعلياً (لوحة التحكم
// الرئيسية وكاشير المحل المحلي)، لضمان ألا يفوت أي مسار خصم المخزون.
export async function deductStockForOrder(restaurantId: string, orderId: string, clientName: string, items: StockOrderItem[]) {
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
        movement_type: 'OUT_ORDER',
        quantity_changed: convertToInventoryUnit(r.quantity_required, r.unit, r.inventory_items?.unit) * oi.quantity,
        reference_id: orderId,
        reference_type: 'order',
        notes: `خصم تلقائي — طلب ${clientName}`,
      }));
  });
  if (movements.length === 0) return;

  const { error } = await supabase.from('stock_movements').insert(movements);
  if (error) console.error('تعذّر خصم المخزون تلقائياً للطلب', orderId, error.message);
}
