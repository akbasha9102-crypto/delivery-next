-- ============================================================
-- account_creation_requests: تتبّع الربط الفعلي بمطعم (linked_restaurant_id)
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations
-- هذا المشروع — لا يُطبَّق تلقائياً). كل الأوامر آمنة لإعادة التشغيل.
--
-- الخلفية:
--  status='approved' يعني فقط أن سوبر أدمن ضغط "قبول" من لوحته — هذا لا
--  يعني إطلاقاً أن مطعماً فعلياً أُنشئ وأن حساب Auth الخامل (auth_user_id،
--  انظر 20260725100000_account_creation_requests_username_auth.sql) صار
--  مرتبطاً به. بين لحظة الموافقة ولحظة تعبئة نموذج "إضافة مطعم" قد يمر
--  وقت طويل، وقد يُغلق المتصفح أو يُنسى الطلب كلياً — فيبقى الطلب
--  "approved" للأبد دون أي مطعم مرتبط، وهذا وضع طبيعي وغير خطير (الحساب
--  الخامل باقٍ وسليم، فقط بانتظار استكمال الربط لاحقاً).
--
--  عمودان جديدان يتتبعان هذا الاستكمال بشكل منفصل تماماً عن status، بلا
--  إضافة أي قيمة status جديدة:
--    - linked_restaurant_id: يُملأ فقط عند نجاح POST
--      /api/super-admin/restaurants بوضع signupRequestId (الربط الفعلي).
--    - linked_at: توقيت هذا الربط.
--
--  لماذا هذا التمييز مهم تحديداً؟ لسببين:
--   1) مسار الرفض (PATCH action=reject بـ
--      src/app/api/super-admin/signup-requests/route.ts) يستدعي
--      auth.admin.deleteUser(auth_user_id) — لكن الرفض مسموح فقط من حالة
--      'pending' (محروس أصلاً بشرط status !== 'pending' → 409)، فلا خطر
--      عليه من هذا التغيير. الحارس الحقيقي المُضاف هنا هو فحص
--      linked_restaurant_id IS NULL داخل POST نفسها (409 لو موجود) —
--      يمنع ربط نفس الطلب بمطعمين (نقرتين متزامنتين)، ويحمي من إعادة
--      استخدام حساب صار يملك مطعماً حياً فعلاً.
--   2) واجهة "الأرشيف" بلوحة سوبر أدمن تحتاج تمييز 3 حالات مختلفة بصرياً:
--      "مقبول ومُفعّل" (linked_restaurant_id موجود)، "مقبول — لم يُستكمل"
--      (approved لكن linked_restaurant_id لا يزال NULL — طلب مُهمَل يمكن
--      استئناف ربطه بأي وقت عبر زر "استئناف الربط")، أو "مرفوض".
--
--  عمداً: لا يوجد أي cron/auto-expiry لتنظيف الطلبات "المُهملة" — قد تبقى
--  approved بلا ربط للأبد، وهذا آمن (لا شيء يُحذف تلقائياً)، ومُعالَج
--  بزر يدوي بدلاً من مؤقّت قد يحذف بيانات حقيقية لعميل حالي بالخطأ.
-- ============================================================

ALTER TABLE account_creation_requests
  ADD COLUMN IF NOT EXISTS linked_restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
ALTER TABLE account_creation_requests
  ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_account_creation_requests_linked_restaurant_id
  ON account_creation_requests (linked_restaurant_id);

NOTIFY pgrst, 'reload schema';
