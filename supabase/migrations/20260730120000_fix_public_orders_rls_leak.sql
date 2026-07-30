-- إصلاح تسريب بيانات: سياسة RLS على orders كانت USING(true) بلا أي قيد —
-- أي حامل لمفتاح anon العام (أي زائر) يقدر يقرأ REST مباشرة (/rest/v1/orders?select=*)
-- ويفرّغ كل طلبات كل الزبائن بكل المطاعم (اسم/هاتف/عنوان/إحداثيات GPS)، لا فقط
-- الطلب الذي يعرف معرّفه أو رقم هاتفه كما كان مقصوداً بالتصميم الأصلي (راجع
-- تعليق migration 20260710122000). ثغرة حرجة #2 بالمراجعة الأمنية الشاملة.
--
-- الاستبدال:
--   • قراءة الزبون (بمعرّف الطلب أو رقم الهاتف) تمر الآن عبر مسارات API خادمية
--     جديدة (/api/track, /api/orders/by-phone) تستخدم service-role وتُرجع فقط
--     الصف/الصفوف المطابقة فعلياً لما أرسله الزبون — لا قراءة جدول مباشرة بعد الآن.
--   • إنشاء الطلب من العميل (cart/orders reorder) لم يعد يعتمد على SELECT بعد
--     الإدراج — المعرّف يُولَّد بجهة العميل (crypto.randomUUID()) قبل الإدراج.
--   • السائقون كانوا يعتمدون كلياً على هذه السياسة العامة لرؤية طلباتهم (لا
--     توجد أي سياسة SELECT خاصة بهم إطلاقاً بأي migration سابق) — تُضاف الآن
--     سياسة صريحة تسمح لهم برؤية طلباتهم المُسنَدة + الطلبات غير المُسنَدة
--     ضمن مطعمهم فقط (بدل رؤية كل طلبات كل المطاعم عبر USING(true) سابقاً).
--
-- owner/manager/cashier غير متأثرين (سياسة "orders: privileged or cashier full
-- access" من migration 20260713110000 تغطيهم بالكامل بما فيها SELECT).

DROP POLICY IF EXISTS "orders: public read" ON orders;
DROP POLICY IF EXISTS "order_items: public read" ON order_items;

DROP POLICY IF EXISTS "orders: driver read own or unassigned in restaurant" ON orders;
CREATE POLICY "orders: driver read own or unassigned in restaurant"
  ON orders FOR SELECT
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR (
      driver_id IS NULL
      AND restaurant_id IN (SELECT restaurant_id FROM drivers WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "order_items: driver read" ON order_items;
CREATE POLICY "order_items: driver read"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN drivers d ON d.user_id = auth.uid()
      WHERE o.id = order_items.order_id
        AND (o.driver_id = d.id OR (o.driver_id IS NULL AND o.restaurant_id = d.restaurant_id))
    )
  );

-- تضييق إضافي (ثغرة متوسطة #6 بالمراجعة): إدراج عناصر طلب من anon كان يقبل
-- أي order_id طالما المطعم غير موقوف (راجع migration 20260720090000)، حتى لو
-- الطلب مكتمل/مُسلَّم سابقاً — بعكس سياسة إدراج orders نفسها التي تشترط
-- status='pending'. إضافة نفس الشرط هنا، مع الإبقاء على شرط تعليق المطعم.
DROP POLICY IF EXISTS "order_items: public create" ON order_items;
CREATE POLICY "order_items: public create"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.status = 'pending'
        AND is_restaurant_active(o.restaurant_id)
    )
  );

NOTIFY pgrst, 'reload schema';
