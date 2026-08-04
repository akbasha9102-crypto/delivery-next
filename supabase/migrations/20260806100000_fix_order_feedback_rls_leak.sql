-- إصلاح تسريب بيانات: جدول order_feedback (ملاحظات/شكاوى الزبائن على الطلبات:
-- اسم، رقم هاتف، نص الشكوى) أُنشئ بلا تفعيل RLS إطلاقاً (راجع تعليق migration
-- 20260704130934) بحجة "نفس نمط جدول orders غير المحمي وقتها" — هذا التبرير لم
-- يعد صالحاً: orders أُغلق لاحقاً عبر migration 20260730120000، بينما
-- order_feedback لم يُراجَع منذ ذلك الحين. النتيجة: صلاحيات Supabase
-- الافتراضية (بلا RLS) تترك anon/authenticated بقراءة SELECT كاملة — أي زائر
-- يقدر يفرّغ شكاوى/أرقام هواتف زبائن كل المطاعم عبر
-- GET /rest/v1/order_feedback?select=*.
--
-- الاستبدال:
--   • الإدراج (تعليق زبون من صفحة التتبع العامة /track، دون تسجيل دخول) يبقى
--     مفتوحاً عمداً بلا أي قيد إضافي على الهوية — لا يوجد مسار API بمفتاح
--     service-role لهذا الإدراج حالياً (خلافاً لـ /api/track و/api/track/edit)،
--     والإدراج أصلاً غير حسّاس (زبون يكتب شكواه فقط، restaurant_id/order_id
--     مأخوذان من صف طلب تم التحقق منه سلفاً من جهة العميل). لا داعٍ لنقله عبر
--     مسار خادمي جديد فقط لأجل هذا الإصلاح — خارج نطاق المطلوب هنا.
--   • القراءة (شاشة الأرشيف بالداشبورد /admin/archive وبثّها اللحظي) تبقى كما
--     هي وظيفياً، لكن الآن مقيّدة صراحة بموظفي المطعم صاحب الشكوى فقط
--     (owner/manager/cashier) أو سوبر-أدمن — بدل قراءة عامة مفتوحة بلا RLS
--     أصلاً. لا تأثير على /admin/archive لأنه أصلاً يستعلم كموظف مسجّل دخول
--     بنفس شرط restaurant_id.
--
-- ملاحظة نمط: لا نضيف "TO anon, authenticated" صراحة على سياسة الإدراج — نفس
-- نمط كل سياسات القراءة/الإدراج العامة بهذا المشروع (orders/order_items/
-- categories/items) التي تعتمد فقط USING/WITH CHECK بلا تحديد أدوار، لأن عدم
-- التحديد يعني افتراضياً كل الأدوار (public) وهو نفس الأثر المطلوب هنا.

ALTER TABLE order_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_feedback: public create" ON order_feedback;
CREATE POLICY "order_feedback: public create"
  ON order_feedback FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "order_feedback: privileged or cashier read" ON order_feedback;
CREATE POLICY "order_feedback: privileged or cashier read"
  ON order_feedback FOR SELECT
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

NOTIFY pgrst, 'reload schema';
