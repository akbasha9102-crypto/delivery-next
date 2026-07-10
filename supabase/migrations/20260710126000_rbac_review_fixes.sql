-- ============================================================
-- RBAC v2 — إصلاحات من مراجعة كود شاملة (/code-review) على فرع feature-rbac
-- شغّل بعد 20260710125000_rbac_user_roles_push.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. خطأ حالة أحرف: التطبيق يكتب movement_type='WASTE' (كبيرة) دائماً،
--    لكن سياسة الكاشير كانت تقارن بـ 'waste' (صغيرة) فلا تطابق أبداً.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stock_movements: cashier waste insert" ON stock_movements;
CREATE POLICY "stock_movements: cashier waste insert"
  ON stock_movements FOR INSERT
  WITH CHECK (is_cashier_of(restaurant_id) AND movement_type = 'WASTE');

-- ─────────────────────────────────────────────────────────────
-- 2. سياسة DELETE مفقودة على orders/order_items لطلبات "pending" — كان
--    نمط "أنشئ الطلب، فشل إدراج الأصناف، احذف الطلب المعلَّق" (cart/local
--    POS) يعمل قبل تفعيل RLS؛ بدون هذه السياسة يفشل الحذف بصمت ويتراكم
--    "طلبات معلَّقة" فارغة بلا أصناف. لا خطورة أمنية حقيقية بالسماح بحذف
--    صف status='pending' تحديداً (لا قيمة مالية/عملياتية بعد لطلب لسا معلَّق).
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders: delete own pending" ON orders;
CREATE POLICY "orders: delete own pending"
  ON orders FOR DELETE
  USING (status = 'pending');

DROP POLICY IF EXISTS "order_items: delete of pending order" ON order_items;
CREATE POLICY "order_items: delete of pending order"
  ON order_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.status = 'pending'));

-- ─────────────────────────────────────────────────────────────
-- 3. تقييد تحديث السائق لطلباته: كان "orders: driver own orders" يسمح
--    بتعديل أي عمود (عبر عميل Supabase مباشرة، خارج مسارات API) على أي
--    طلب مُسنَد له — بما فيها total_amount/client_name/إلخ. الآن يُمنع
--    أي تعديل خارج status عبر trigger (RLS وحده لا يميّز بين الأعمدة).
--    لا يُطبَّق على service_role (auth.uid() فارغ فيه) حتى لا يكسر
--    مسارات الـ API (void/refund/discount) التي تحدّث orders بصلاحية إدارية.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_driver_order_update_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service_role (مسارات API) — غير مقيَّد
  END IF;

  IF jwt_role() = 'driver' AND NOT is_privileged_of(NEW.restaurant_id) AND NOT is_cashier_of(NEW.restaurant_id) THEN
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
      OR NEW.client_name IS DISTINCT FROM OLD.client_name
      OR NEW.client_phone IS DISTINCT FROM OLD.client_phone
      OR NEW.delivery_address IS DISTINCT FROM OLD.delivery_address
      OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
      OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
      OR NEW.pre_discount_total IS DISTINCT FROM OLD.pre_discount_total
    THEN
      RAISE EXCEPTION 'السائق لا يملك صلاحية تعديل هذا الحقل';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_driver_order_update_columns ON orders;
CREATE TRIGGER trg_enforce_driver_order_update_columns
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION enforce_driver_order_update_columns();

-- ─────────────────────────────────────────────────────────────
-- 4. اشتراك Push للمالك — لا مكان له بعد اليوم (owner ليس له صف
--    user_roles عمداً، ولا صف restaurant_staff بعد حذف الجدول القديم
--    لاحقاً). عمود مباشر على restaurants (واحد لكل مطعم، يكفي لغرض
--    تنبيهات الموافقة/فروقات الكاش الحالي).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS owner_push_subscription JSONB;

-- ─────────────────────────────────────────────────────────────
-- 5. إبطال جلسات موظف مُعطَّل فوراً — بدون هذا، تعطيل الكاشير من لوحة
--    المالك (is_active=false) لا يُبطل الـ JWT الحالي بجهازه؛ يبقى صالحاً
--    لحد انتهاء صلاحيته الطبيعية (access_token عادة ~ساعة). حذف صفوف
--    auth.sessions يُبطل إعادة التجديد فوراً (refresh التالي يفشل).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION revoke_user_sessions(p_user_id UUID)
RETURNS VOID AS $$
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

REVOKE ALL ON FUNCTION revoke_user_sessions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revoke_user_sessions(UUID) TO service_role;
