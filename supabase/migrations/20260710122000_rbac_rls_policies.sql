-- ============================================================
-- RBAC v2 — خطوة 3: تفعيل/تشديد RLS الفعلي على الجداول الأساسية
-- شغّل هذا الكود في Supabase SQL Editor بعد:
--   1) 20260710120000_rbac_custom_claims.sql
--   2) 20260710121000_driver_auth_column.sql
--   3) تفعيل custom_access_token_hook من Supabase Dashboard
--   4) تشغيل npm run migrate-drivers-to-auth ونجاحه لكل السائقين
--   5) نشر كود التطبيق الجديد (تسجيل دخول السائق عبر Supabase Auth
--      بدل استعلام password النصي المباشر — راجع src/app/driver/page.tsx)
--
-- ⚠️ الخطوة 5 إلزامية قبل هذا الملف تحديداً: بمجرد تفعيل RLS على drivers
-- هنا، استعلام تسجيل الدخول القديم (`.eq('phone',...).eq('password',...)`
-- من عميل anon) يتوقف عن إرجاع أي صف — أي سائق لسا ما انتقل لحساب Auth
-- حقيقي (خطوة 4) لن يقدر يسجّل دخول إطلاقاً بعد تشغيل هذا الملف.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. restaurants — يبقى مفتوحاً للقراءة (anon+authenticated) تماماً
--    كما هو اليوم فعلياً (RLS كان معطّلاً بالكامل) — القائمة/الطلب
--    العام لازم يشتغل بدون تسجيل دخول. الكتابة تُقيَّد للمالك فقط.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurants: public read" ON restaurants;
CREATE POLICY "restaurants: public read"
  ON restaurants FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "restaurants: owner full access" ON restaurants;
CREATE POLICY "restaurants: owner full access"
  ON restaurants FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "restaurants: super_admin full access" ON restaurants;
CREATE POLICY "restaurants: super_admin full access"
  ON restaurants FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ─────────────────────────────────────────────────────────────
-- 2. categories / items — قراءة عامة (منيو الزبون)، كتابة owner/manager فقط
-- ─────────────────────────────────────────────────────────────
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories: public read" ON categories;
CREATE POLICY "categories: public read" ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "categories: privileged write" ON categories;
CREATE POLICY "categories: privileged write"
  ON categories FOR ALL
  USING (is_privileged_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "items: public read" ON items;
CREATE POLICY "items: public read" ON items FOR SELECT USING (true);
DROP POLICY IF EXISTS "items: privileged write" ON items;
CREATE POLICY "items: privileged write"
  ON items FOR ALL
  USING (is_privileged_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_of(restaurant_id) OR is_super_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. orders / order_items — إنشاء/قراءة عامة (طلب زبون بدون تسجيل دخول
--    + تتبّع الطلب بالهاتف، سلوك قائم اليوم أصلاً وRLS لا يقدر يُحكم
--    قراءة anon حسب هاتف يرسله العميل نفسه). owner/manager: كل شيء.
--    cashier: إنشاء وتحديث حالة (بدون حذف). driver: قراءة/تحديث طلباته فقط.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders: public read" ON orders;
CREATE POLICY "orders: public read" ON orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "orders: public create pending" ON orders;
CREATE POLICY "orders: public create pending"
  ON orders FOR INSERT
  WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "orders: privileged full access" ON orders;
CREATE POLICY "orders: privileged full access"
  ON orders FOR ALL
  USING (is_privileged_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "orders: cashier create" ON orders;
CREATE POLICY "orders: cashier create"
  ON orders FOR INSERT
  WITH CHECK (is_cashier_of(restaurant_id));

DROP POLICY IF EXISTS "orders: cashier update status" ON orders;
CREATE POLICY "orders: cashier update status"
  ON orders FOR UPDATE
  USING (is_cashier_of(restaurant_id))
  WITH CHECK (is_cashier_of(restaurant_id));

DROP POLICY IF EXISTS "orders: driver own orders" ON orders;
CREATE POLICY "orders: driver own orders"
  ON orders FOR UPDATE
  USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
  WITH CHECK (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "order_items: public read" ON order_items;
CREATE POLICY "order_items: public read" ON order_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "order_items: public create" ON order_items;
CREATE POLICY "order_items: public create" ON order_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "order_items: privileged full access" ON order_items;
CREATE POLICY "order_items: privileged full access"
  ON order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND (is_privileged_of(o.restaurant_id) OR is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND (is_privileged_of(o.restaurant_id) OR is_super_admin())));

-- ─────────────────────────────────────────────────────────────
-- 4. drivers — يغلق ثغرة كلمة المرور النصية الصريحة: بلا أي وصول anon
--    إطلاقاً بعد اليوم. owner/manager: كل شيء. driver: صفّه فقط.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drivers: privileged full access" ON drivers;
CREATE POLICY "drivers: privileged full access"
  ON drivers FOR ALL
  USING (is_privileged_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "drivers: own row" ON drivers;
CREATE POLICY "drivers: own row"
  ON drivers FOR ALL
  USING (is_own_driver_row(user_id))
  WITH CHECK (is_own_driver_row(user_id));

-- ─────────────────────────────────────────────────────────────
-- 5. إعادة توجيه سياسات جداول المخزون الحالية من is_restaurant_owner
--    (تعزل مطعم فقط) إلى is_privileged_of (owner+manager)، + إضافة
--    قراءة cashier محدودة لصفحة هدر المخزون (waste).
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "inventory_items: owner can do all" ON inventory_items;
CREATE POLICY "inventory_items: privileged full access"
  ON inventory_items FOR ALL
  USING (is_privileged_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_of(restaurant_id) OR is_super_admin());
DROP POLICY IF EXISTS "inventory_items: super_admin can do all" ON inventory_items;

DROP POLICY IF EXISTS "inventory_items: cashier read" ON inventory_items;
CREATE POLICY "inventory_items: cashier read"
  ON inventory_items FOR SELECT
  USING (is_cashier_of(restaurant_id));

DROP POLICY IF EXISTS "inventory_categories: owner can do all" ON inventory_categories;
CREATE POLICY "inventory_categories: privileged full access"
  ON inventory_categories FOR ALL
  USING (is_privileged_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_of(restaurant_id) OR is_super_admin());
DROP POLICY IF EXISTS "inventory_categories: super_admin can do all" ON inventory_categories;

DROP POLICY IF EXISTS "menu_recipes: owner can do all" ON menu_recipes;
CREATE POLICY "menu_recipes: privileged full access"
  ON menu_recipes FOR ALL
  USING (is_privileged_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_of(restaurant_id) OR is_super_admin());
DROP POLICY IF EXISTS "menu_recipes: super_admin can do all" ON menu_recipes;

DROP POLICY IF EXISTS "stock_movements: owner can do all" ON stock_movements;
CREATE POLICY "stock_movements: privileged full access"
  ON stock_movements FOR ALL
  USING (is_privileged_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_of(restaurant_id) OR is_super_admin());
DROP POLICY IF EXISTS "stock_movements: super_admin can do all" ON stock_movements;

DROP POLICY IF EXISTS "stock_movements: cashier waste insert" ON stock_movements;
CREATE POLICY "stock_movements: cashier waste insert"
  ON stock_movements FOR INSERT
  WITH CHECK (is_cashier_of(restaurant_id) AND movement_type = 'waste');

DROP POLICY IF EXISTS "stock_movements: cashier read" ON stock_movements;
CREATE POLICY "stock_movements: cashier read"
  ON stock_movements FOR SELECT
  USING (is_cashier_of(restaurant_id));

-- ─────────────────────────────────────────────────────────────
-- 6. cashier_shifts / approval_requests / staff_actions_log — إعادة
--    توجيه للدور الجديد (owner/manager). staff_id/requested_by يبقى
--    يشير لـ restaurant_staff.id مؤقتاً (يُعاد ربطه لـ user_id عند حذف
--    الجدول القديم بالخطوة الأخيرة) — لذا صلاحية "صفّي أنا" للكاشير
--    تمر عبر auth_user_id على restaurant_staff حتى ذلك الحين.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cashier_shifts: owner can do all" ON cashier_shifts;
CREATE POLICY "cashier_shifts: privileged full access"
  ON cashier_shifts FOR ALL
  USING (is_privileged_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_of(restaurant_id) OR is_super_admin());
DROP POLICY IF EXISTS "cashier_shifts: super_admin can do all" ON cashier_shifts;

DROP POLICY IF EXISTS "cashier_shifts: own shifts" ON cashier_shifts;
CREATE POLICY "cashier_shifts: own shifts"
  ON cashier_shifts FOR ALL
  USING (is_cashier_of(restaurant_id) AND staff_id IN (SELECT id FROM restaurant_staff WHERE auth_user_id = auth.uid()))
  WITH CHECK (is_cashier_of(restaurant_id) AND staff_id IN (SELECT id FROM restaurant_staff WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "approval_requests: owner can do all" ON approval_requests;
CREATE POLICY "approval_requests: privileged full access"
  ON approval_requests FOR ALL
  USING (is_privileged_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_of(restaurant_id) OR is_super_admin());
DROP POLICY IF EXISTS "approval_requests: super_admin can do all" ON approval_requests;

DROP POLICY IF EXISTS "approval_requests: own requests" ON approval_requests;
CREATE POLICY "approval_requests: own requests"
  ON approval_requests FOR ALL
  USING (is_cashier_of(restaurant_id) AND requested_by IN (SELECT id FROM restaurant_staff WHERE auth_user_id = auth.uid()))
  WITH CHECK (is_cashier_of(restaurant_id) AND requested_by IN (SELECT id FROM restaurant_staff WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "staff_actions_log: owner can do all" ON staff_actions_log;
CREATE POLICY "staff_actions_log: privileged read"
  ON staff_actions_log FOR SELECT
  USING (is_privileged_of(restaurant_id) OR is_super_admin());
DROP POLICY IF EXISTS "staff_actions_log: super_admin can do all" ON staff_actions_log;
