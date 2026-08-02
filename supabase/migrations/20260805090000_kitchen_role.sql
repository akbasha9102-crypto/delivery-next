-- ============================================================
-- دور "مطبخ" (kitchen) جديد — نفس نمط الكاشير بالضبط (حساب Supabase
-- Auth حقيقي مستقل عبر user_roles)، لكن بصلاحيات أضيق: قراءة فقط على
-- orders/order_items + تحديث orders.kitchen_ready_at حصراً. الغاية
-- الوحيدة لهذا الدور هي شاشة عرض المطبخ (/admin/kitchen).
-- ============================================================

-- (1) توسيع CHECK على user_roles.role ليشمل 'kitchen'
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('manager', 'cashier', 'driver', 'kitchen'));

-- (2) دالة مساعدة is_kitchen_of — نفس نمط is_cashier_of بالضبط
CREATE OR REPLACE FUNCTION is_kitchen_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id
      AND role = 'kitchen' AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- (3) orders: قراءة + تحديث فقط لدور kitchen (لا FOR ALL — أقل صلاحية ممكنة)
-- ⚠️ حدود معروفة ومقبولة: RLS لا يقيّد أي عمود تحديداً بـ UPDATE — الثقة
-- بأن كود العميل (شاشة المطبخ) لا يُرسل إلا kitchen_ready_at هي نفس نمط
-- الثقة المعتمد بكل هذا المشروع (لا trigger قفل أعمدة يُضاف هنا عمداً).
DROP POLICY IF EXISTS "orders: kitchen read" ON orders;
CREATE POLICY "orders: kitchen read"
  ON orders FOR SELECT
  USING (is_kitchen_of(restaurant_id));

DROP POLICY IF EXISTS "orders: kitchen update" ON orders;
CREATE POLICY "orders: kitchen update"
  ON orders FOR UPDATE
  USING (is_kitchen_of(restaurant_id))
  WITH CHECK (is_kitchen_of(restaurant_id));

-- (4) order_items: قراءة فقط لدور kitchen — لازمة لأن شاشة المطبخ تجلب
-- order_items(...) كـ nested select ضمن استعلام orders (PostgREST يُسقط
-- الصفوف المُضمَّنة بصمت إن رفضتها RLS، بدون أي خطأ ظاهر).
DROP POLICY IF EXISTS "order_items: kitchen read" ON order_items;
CREATE POLICY "order_items: kitchen read"
  ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND is_kitchen_of(o.restaurant_id)
  ));

-- إعادة تحميل schema cache فوراً بعد تعديل الدوال/السياسات
NOTIFY pgrst, 'reload schema';
