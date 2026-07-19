-- ============================================================
-- إنفاذ فعلي لإيقاف اشتراك المطعم (is_suspended) — من حماية واجهة
-- فقط إلى حماية بمستوى القاعدة (trigger + RLS)
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations
-- هذا المشروع — لا يُطبَّق تلقائياً). كل الأوامر آمنة لإعادة التشغيل.
--
-- الخلفية:
--  ميزة "إيقاف اشتراك المطعم" (super-admin/dashboard) كانت تعتمد كلياً
--  على AdminGuard/CustomerGuard بالواجهة — عمود restaurant_settings.
--  is_suspended موجود، لكن بلا أي إنفاذ خادم/قاعدة:
--   1) restaurant_settings_write (من 20260718000000) تسمح لـ
--      is_privileged_or_cashier_of (owner/manager/cashier) بتحديث الصف
--      كاملاً — أي المطعم نفسه يقدر يفكّ تعليقه بـ PATCH مباشر متجاوزاً
--      زر super-admin. هذا أخطر ثغرة هنا ويُغلَق بـ trigger (بند 0).
--   2) عميل (anon) أو كاشير يقدر ينشئ طلبات جديدة (orders/order_items)
--      لمطعم موقوف عبر استدعاء مباشر لـ Supabase (تجاوز واجهة الطلب
--      المحظورة بـ CustomerGuard). يُغلَق بتعديل 3 سياسات إنشاء فقط
--      (بند 2) دون المساس بأي سياسة تحديث/قراءة أخرى — owner/manager/
--      cashier يستمرون بتحديث طلبات قديمة حتى لو عُلّق المطعم أثناءها؛
--      التجميد فقط لإنشاء طلبات/عناصر جديدة.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0) منع فك التعليق الذاتي: أي تغيير على is_suspended يجب أن يمرّ
--    حصراً عبر super_admin، بغض النظر عن أي سياسة RLS تسمح بالكتابة
--    على restaurant_settings لأدوار أخرى (owner/manager/cashier).
--    is_super_admin() معرّفة أصلاً بـ 20260710120000_rbac_custom_claims.sql
--    (تُعاد الإشارة لها هنا كما هي، لا يُعاد تعريفها).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_non_super_admin_suspend_toggle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'فقط سوبر أدمن يقدر يبدّل حالة تعليق المطعم';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restaurant_settings_suspend_guard ON restaurant_settings;
CREATE TRIGGER trg_restaurant_settings_suspend_guard
  BEFORE UPDATE ON restaurant_settings
  FOR EACH ROW EXECUTE FUNCTION prevent_non_super_admin_suspend_toggle();

-- ─────────────────────────────────────────────────────────────
-- 1) is_restaurant_active — دالة موحّدة تُستخدم بسياسات إنشاء الطلبات
--    أدناه. بدون SECURITY DEFINER (نفس نمط is_privileged_of) لأن
--    restaurant_settings مقروءة أصلاً بسياسة عامة (restaurant_settings_
--    select_public، راجع 20260718000000)، فلا داعي لتجاوز RLS هنا.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_restaurant_active(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM restaurant_settings
    WHERE restaurant_id = p_restaurant_id AND is_suspended = TRUE
  );
$$ LANGUAGE sql STABLE;

-- ─────────────────────────────────────────────────────────────
-- 2) تجميد إنشاء طلبات/عناصر جديدة لمطعم موقوف — 3 سياسات إنشاء فقط.
--    لا تُمس: orders: privileged full access, orders: cashier update
--    status, orders: driver own orders, restaurants/categories/items
--    public read — هذه تبقى كما هي عمداً.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders: public create pending" ON orders;
CREATE POLICY "orders: public create pending"
  ON orders FOR INSERT
  WITH CHECK (status = 'pending' AND is_restaurant_active(restaurant_id));

DROP POLICY IF EXISTS "orders: cashier create" ON orders;
CREATE POLICY "orders: cashier create"
  ON orders FOR INSERT
  WITH CHECK (is_cashier_of(restaurant_id) AND is_restaurant_active(restaurant_id));

DROP POLICY IF EXISTS "order_items: public create" ON order_items;
CREATE POLICY "order_items: public create"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id AND is_restaurant_active(o.restaurant_id)
    )
  );

NOTIFY pgrst, 'reload schema';
