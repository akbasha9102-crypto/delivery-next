-- ============================================================
-- إعادة تأكيد دوال RBAC الصحيحة + تفعيل Realtime لـ categories/items
-- ============================================================
-- السبب: تعديل لون القسم/الكارت من /admin/menu لا ينعكس على منيو
-- العملاء. الكود (saveCatColors) صحيح ومُتحقَّق منه فعلياً (يستخدم
-- .select() بعد .update() ولا يعرض "تم الحفظ" إلا عند نجاح حقيقي —
-- إصلاح سابق commit 306a71f). الشكوك تتجه الآن لحالة قاعدة البيانات
-- الحيّة نفسها، لأن migrations هذا المشروع تُطبَّق يدوياً فقط ولا يوجد
-- أي تتبّع لما نُفِّذ فعلاً وما لم يُنفَّذ:
--
--   1) دوال is_manager_of/is_cashier_of قد تكون لا تزال بالنسخة القديمة
--      المعتمدة على JWT claim معطَّل بنيوياً (custom_access_token_hook
--      مقفل على خطة Supabase المجانية) — فترجع FALSE دائماً لأي حساب
--      غير المالك، فتحظر RLS تحديث categories/items بصمت (صفر صفوف
--      متأثرة، بدون أي خطأ). الإصلاح الصحيح موجود بالمستودع فعلاً في
--      20260710127000_rbac_direct_query_rls.sql و
--      20260713120000_fix_gemini_broken_privileged_functions.sql لكن قد
--      لم يُطبَّق على القاعدة الحيّة، أو أُرجع لاحقاً بالخطأ.
--   2) جدولا categories/items غير مُضافين إطلاقاً لـ publication
--      supabase_realtime (لا وجود لهما في أي ALTER PUBLICATION بكل
--      المستودع) — أي حتى مع نجاح الحفظ، أي تبويب مفتوح مسبقاً لمنيو
--      العميل لن يستقبل التحديث حياً (لكن F5/تحديث يدوي كان سيحل هذا
--      الجزء تحديداً، لأن HomeClient يجلب البيانات مباشرة عند mount).
--
-- هذا الملف يجمع (كل الأوامر CREATE OR REPLACE / DROP+CREATE POLICY
-- idempotent، آمن للتشغيل أكثر من مرة):
--   أ) إعادة تأكيد نفس الدوال الصحيحة من 20260710127000 و20260713120000
--      (بنفس الجسم بالضبط — لا تعديل منطقي جديد هنا).
--   ب) إعادة تأكيد سياسات categories/items (وبقية الجداول) من
--      20260713110000_cashier_owner_parity_rls.sql.
--   ج) تفعيل Realtime لـ categories/items.
--   د) NOTIFY pgrst لإعادة تحميل schema cache فوراً بعد أي تعديل دوال.
--
-- شغّل هذا الملف كاملاً دفعة واحدة عبر Supabase SQL Editor.
-- ============================================================

-- (أ) الدوال الصحيحة — استعلام مباشر من user_roles/restaurants، لا اعتماد على JWT claims
CREATE OR REPLACE FUNCTION jwt_role() RETURNS TEXT AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION jwt_restaurant_id() RETURNS UUID AS $$
  SELECT restaurant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION is_owner_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_manager_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id
      AND role = 'manager' AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION is_cashier_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id
      AND role = 'cashier' AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION is_driver_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id
      AND role = 'driver' AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION is_privileged_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_owner_of(p_restaurant_id) OR is_manager_of(p_restaurant_id);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_privileged_or_cashier_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_privileged_of(p_restaurant_id) OR is_cashier_of(p_restaurant_id);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((auth.jwt() -> 'user_metadata' ->> 'super_admin')::BOOLEAN, FALSE);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- (ب) إعادة تأكيد السياسات المعتمدة على الدوال أعلاه (نفس محتوى 20260713110000)
DROP POLICY IF EXISTS "restaurants: cashier update" ON restaurants;
CREATE POLICY "restaurants: cashier update"
  ON restaurants FOR UPDATE
  USING (is_cashier_of(id))
  WITH CHECK (is_cashier_of(id));

DROP POLICY IF EXISTS "categories: privileged write" ON categories;
DROP POLICY IF EXISTS "categories: privileged or cashier write" ON categories;
CREATE POLICY "categories: privileged or cashier write"
  ON categories FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "items: privileged write" ON items;
DROP POLICY IF EXISTS "items: privileged or cashier write" ON items;
CREATE POLICY "items: privileged or cashier write"
  ON items FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "orders: privileged full access" ON orders;
DROP POLICY IF EXISTS "orders: privileged or cashier full access" ON orders;
CREATE POLICY "orders: privileged or cashier full access"
  ON orders FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "order_items: privileged full access" ON order_items;
DROP POLICY IF EXISTS "order_items: privileged or cashier full access" ON order_items;
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
DROP POLICY IF EXISTS "drivers: privileged or cashier full access" ON drivers;
CREATE POLICY "drivers: privileged or cashier full access"
  ON drivers FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "inventory_items: privileged full access" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items: privileged or cashier full access" ON inventory_items;
CREATE POLICY "inventory_items: privileged or cashier full access"
  ON inventory_items FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "inventory_categories: privileged full access" ON inventory_categories;
DROP POLICY IF EXISTS "inventory_categories: privileged or cashier full access" ON inventory_categories;
CREATE POLICY "inventory_categories: privileged or cashier full access"
  ON inventory_categories FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "menu_recipes: privileged full access" ON menu_recipes;
DROP POLICY IF EXISTS "menu_recipes: owner can do all" ON menu_recipes;
DROP POLICY IF EXISTS "menu_recipes: privileged or cashier full access" ON menu_recipes;
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
DROP POLICY IF EXISTS "stock_movements: privileged or cashier full access" ON stock_movements;
CREATE POLICY "stock_movements: privileged or cashier full access"
  ON stock_movements FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "cashier_shifts: cashier read all" ON cashier_shifts;
CREATE POLICY "cashier_shifts: cashier read all"
  ON cashier_shifts FOR SELECT
  USING (is_cashier_of(restaurant_id));

DROP POLICY IF EXISTS "approval_requests: cashier read all" ON approval_requests;
CREATE POLICY "approval_requests: cashier read all"
  ON approval_requests FOR SELECT
  USING (is_cashier_of(restaurant_id));

-- (ج) تفعيل Realtime لجدولي categories/items — كانا غائبين تماماً عن
-- publication supabase_realtime، فأي تبويب منيو عميل مفتوح مسبقاً لا
-- يستقبل التحديث حياً (يحتاج F5 يدوي رغم نجاح الحفظ).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE categories;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE items;
  END IF;
END $$;

-- (د) إعادة تحميل schema cache فوراً بعد تعديل الدوال
NOTIFY pgrst, 'reload schema';
