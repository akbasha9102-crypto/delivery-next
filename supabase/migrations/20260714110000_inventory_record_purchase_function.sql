-- ============================================================
-- record_inventory_purchase — تسجيل عملية شراء مادة مخزون بشكل ذرّي:
--   1) تحديث cost_per_unit للمادة إلى السعر الجديد المدفوع فعلياً
--   2) إدراج حركة مخزون IN (يرفع current_stock تلقائياً عبر
--      trigger apply_stock_movement الموجود مسبقاً)
-- SECURITY INVOKER (صراحة): تبقى كل سياسات RLS الحالية على
-- inventory_items وstock_movements سارية بالكامل (لا حاجة لأي
-- تعديل RLS جديد) — نفس صلاحيات المالك/الكاشير المطبّقة أصلاً.
-- ============================================================

CREATE OR REPLACE FUNCTION record_inventory_purchase(
  p_item_id  UUID,
  p_quantity NUMERIC,
  p_price    NUMERIC,
  p_notes    TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_restaurant_id UUID;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'الكمية يجب أن تكون أكبر من صفر';
  END IF;
  IF p_price < 0 THEN
    RAISE EXCEPTION 'السعر لا يمكن أن يكون سالباً';
  END IF;

  SELECT restaurant_id INTO v_restaurant_id
  FROM inventory_items WHERE id = p_item_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'المادة غير موجودة أو لا صلاحية للوصول إليها';
  END IF;

  UPDATE inventory_items
  SET cost_per_unit = p_price
  WHERE id = p_item_id;

  INSERT INTO stock_movements
    (inventory_item_id, restaurant_id, movement_type, quantity_changed, cost_at_time, reference_type, notes)
  VALUES
    (p_item_id, v_restaurant_id, 'IN', p_quantity, p_price, 'purchase', p_notes);
END;
$$;

REVOKE ALL ON FUNCTION record_inventory_purchase(UUID, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_inventory_purchase(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;
