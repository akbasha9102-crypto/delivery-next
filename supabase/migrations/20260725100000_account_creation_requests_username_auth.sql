-- ============================================================
-- account_creation_requests: إضافة username + auth_user_id
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations
-- هذا المشروع — لا يُطبَّق تلقائياً). كل الأوامر آمنة لإعادة التشغيل.
--
-- الخلفية:
--  صفحة /signup الجديدة (تحل محل SignupRequestModal القديم) تضيف 3 حقول
--  جديدة: اسم المستخدم، كلمة السر، تأكيد كلمة السر. كلمة السر لا تُخزَّن
--  هنا إطلاقاً — لا نص صريح ولا حتى مشفّر بشكل قابل للعكس (هذا المشروع
--  مرّ بتجربة مشروع شقيق "drivers-portal" أُوقف بالكامل بسبب تخزين كلمات
--  مرور السائقين كنص صريح، فالمعيار هنا صارم). بدلاً من ذلك: عند تقديم
--  الطلب (POST src/app/api/signup-requests/route.ts) يُستدعى فوراً
--  supabaseAdmin.auth.admin.createUser({ email: `${username}@dasha.app`,
--  password, email_confirm: true }) — Supabase Auth نفسه (نظام مُدقَّق
--  ومُختبَر) يملك تخزين/تجزئة كلمة السر من هذه اللحظة، ولا يُخزَّن هنا
--  سوى المعرّف الناتج auth_user_id.
--
--  لماذا إنشاء حساب Auth قبل الموافقة (وليس بعدها)؟ لأن تسجيل الدخول
--  الفعلي (src/app/api/auth/resolve-login/route.ts) لا يمنح وصولاً إلا
--  إذا وُجد صف مطابق بـ restaurants.slug أو user_roles.code — وهذا لن
--  يوجد حتى يقوم سوبر أدمن يدوياً بربط الطلب المعتمد بمطعم فعلي (عملية
--  منفصلة يدوية خارج نطاق هذا الـ migration بالكامل، كما هو موثّق أصلاً
--  بتعليق 20260724110000_account_creation_requests.sql). أي أن حساب
--  Auth المُنشَأ هنا "خامل" (inert) وغير قابل للاستخدام فعلياً إلى أن
--  يتم هذا الربط — لذا إنشاؤه مبكراً آمن. ملاحظة لأي قارئ مستقبلي: لا
--  "تُصلح" هذا بنقل createUser إلى خطوة الموافقة — هذا مقصود، فالغاية من
--  الإنشاء المبكر هي إبعاد كلمة السر عن أي تخزين مؤقت لدينا نهائياً.
--
--  عند الرفض (PATCH action=reject بـ
--  src/app/api/super-admin/signup-requests/route.ts) يجب استدعاء
--  supabaseAdmin.auth.admin.deleteUser(auth_user_id) لتفادي ترك حساب
--  Auth خامل يتيم بلا أي طلب مرتبط به.
--
--  الصفوف الموجودة فعلاً قبل هذا الـ migration (إن وُجدت) أُنشئت قبل أن
--  يكون لدينا حقل username/auth_user_id على الإطلاق — لا يوجد أي backfill
--  ممكن أو مطلوب لها، فتُترك NULL لها عمداً. كلا العمودين NULLABLE قصداً.
-- ============================================================

ALTER TABLE account_creation_requests ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE account_creation_requests ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

ALTER TABLE account_creation_requests
  DROP CONSTRAINT IF EXISTS account_creation_requests_username_format_check;
ALTER TABLE account_creation_requests
  ADD CONSTRAINT account_creation_requests_username_format_check
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,24}$');

-- فهرس فريد جزئي: يستثني الصفوف المرفوضة عمداً حتى يقدر مقدّم رُفض طلبه
-- يعيد المحاولة بنفس اسم المستخدم لاحقاً دون تصادم.
DROP INDEX IF EXISTS idx_account_creation_requests_username_unique;
CREATE UNIQUE INDEX idx_account_creation_requests_username_unique
  ON account_creation_requests (lower(username))
  WHERE status <> 'rejected';

NOTIFY pgrst, 'reload schema';
