-- ============================================================
-- RBAC v3 — تكافؤ الكاشير مع المالك على مستوى RLS، باستثناء:
--   1) الإحصائيات (/admin/statistics, /admin/statistics/drivers)
--   2) إدارة الموظفين/الأدوار (user_roles)
--   3) سجل التدقيق (staff_actions_log)
-- شغّل بعد 20260713100000_menu_best_sellers_indexes.sql
-- ============================================================
-- ⚠️ قبل التشغيل: تحقّق من الحالة الحيّة الفعلية لسياسات menu_recipes عبر
--   SELECT policyname, qual, with_check FROM pg_policies WHERE tablename = 'menu_recipes';
-- نسخة 20260710122000_rbac_rls_policies.sql كانت تُنشئ سياسة على
-- menu_recipes تشير لعمود restaurant_id غير موجود أصلاً بالجدول (يحوي فقط
-- menu_item_id/inventory_item_id) — من شبه المؤكد أنها فشلت وقت التنفيذ
-- الفعلي وصُحِّحت يدوياً بمحرر SQL دون تحديث الملف بالمستودع. هذا الملف
-- يُعيد تعريف سياسة menu_recipes من الصفر بغض النظر عن حالتها الحالية.
-- ============================================================

CREATE OR REPLACE FUNCTION is_privileged_or_cashier_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_privileged_of(p_restaurant_id) OR is_cashier_of(p_restaurant_id);
$$ LANGUAGE sql STABLE;

DROP POLICY IF EXISTS "restaurants: cashier update" ON restaurants;
CREATE POLICY "restaurants: cashier update"
  ON restaurants FOR UPDATE
  USING (is_cashier_of(id))
  WITH CHECK (is_cashier_of(id));

CREATE OR REPLACE FUNCTION enforce_restaurant_owner_id_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'لا يمكن تغيير مالك المطعم من هذا المسار';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_restaurant_owner_id_immutable ON restaurants;
CREATE TRIGGER trg_enforce_restaurant_owner_id_immutable
  BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION enforce_restaurant_owner_id_immutable();

DROP POLICY IF EXISTS "categories: privileged write" ON categories;
CREATE POLICY "categories: privileged or cashier write"
  ON categories FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "items: privileged write" ON items;
CREATE POLICY "items: privileged or cashier write"
  ON items FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "orders: privileged full access" ON orders;
CREATE POLICY "orders: privileged or cashier full access"
  ON orders FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());
DROP POLICY IF EXISTS "orders: cashier create" ON orders;
DROP POLICY IF EXISTS "orders: cashier update status" ON orders;

DROP POLICY IF EXISTS "order_items: privileged full access" ON order_items;
CREATE POLICY "order_items: privileged or cashier full access"
  ON order_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (is_privileged_or_cashier_of(o.restaurant_id) OR is_super_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (is_privileged_or_cashier_of(o.restaurant_id) OR is_super_admin())
  ));

DROP POLICY IF EXISTS "drivers: privileged full access" ON drivers;
CREATE POLICY "drivers: privileged or cashier full access"
  ON drivers FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "inventory_items: privileged full access" ON inventory_items;
CREATE POLICY "inventory_items: privileged or cashier full access"
  ON inventory_items FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());
DROP POLICY IF EXISTS "inventory_items: cashier read" ON inventory_items;

DROP POLICY IF EXISTS "inventory_categories: privileged full access" ON inventory_categories;
CREATE POLICY "inventory_categories: privileged or cashier full access"
  ON inventory_categories FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "menu_recipes: privileged full access" ON menu_recipes;
DROP POLICY IF EXISTS "menu_recipes: owner can do all" ON menu_recipes;
CREATE POLICY "menu_recipes: privileged or cashier full access"
  ON menu_recipes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM items i
    WHERE i.id = menu_recipes.menu_item_id
      AND (is_privileged_or_cashier_of(i.restaurant_id) OR is_super_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM items i
    WHERE i.id = menu_recipes.menu_item_id
      AND (is_privileged_or_cashier_of(i.restaurant_id) OR is_super_admin())
  ));

DROP POLICY IF EXISTS "stock_movements: privileged full access" ON stock_movements;
CREATE POLICY "stock_movements: privileged or cashier full access"
  ON stock_movements FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());
DROP POLICY IF EXISTS "stock_movements: cashier waste insert" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements: cashier read" ON stock_movements;

DROP POLICY IF EXISTS "cashier_shifts: cashier read all" ON cashier_shifts;
CREATE POLICY "cashier_shifts: cashier read all"
  ON cashier_shifts FOR SELECT
  USING (is_cashier_of(restaurant_id));

DROP POLICY IF EXISTS "approval_requests: cashier read all" ON approval_requests;
CREATE POLICY "approval_requests: cashier read all"
  ON approval_requests FOR SELECT
  USING (is_cashier_of(restaurant_id));

-- staff_actions_log: عمداً بلا أي تغيير (استثناء #3).
-- user_roles: عمداً بلا أي تغيير (استثناء #2).
