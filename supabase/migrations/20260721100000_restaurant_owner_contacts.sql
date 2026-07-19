-- ============================================================
-- معلومات صاحب المطعم — ملاحظة خاصة بسوبر أدمن فقط (اسم/هاتف صاحب المطعم)
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations
-- هذا المشروع — لا يُطبَّق تلقائياً). كل الأوامر آمنة لإعادة التشغيل.
--
-- الخلفية:
--  لوحة سوبر أدمن (super-admin/dashboard) تحتاج تخزين ملاحظة شخصية
--  لسوبر أدمن فقط ("لي انا فقط"): اسم صاحب المطعم ورقم هاتفه، بدون أي
--  تحقق/إلزام (حقول اختيارية بالكامل). يجب ألا تظهر هذه البيانات
--  إطلاقاً لصاحب/موظفي المطعم، ولا للزبائن، ولا عبر أي قراءة مباشرة
--  من المتصفح (anon/authenticated key).
--
--  لماذا ليس عمود جديد على restaurant_settings؟ لأن هذا الجدول لديه
--  سياسة قراءة عامة restaurant_settings_select_public (USING (true)،
--  من 20260718000000_fix_audit_identity_and_settings_rls.sql) تُقرأ
--  مباشرة من المتصفح بصفحة المنيو (src/app/menu/[slug]/page.tsx)
--  ولوحة سوبر أدمن نفسها (loadAll() بـ src/app/super-admin/dashboard/
--  page.tsx) — أي عمود يُضاف هناك يصبح عاماً فوراً لأي حامل مفتاح anon.
--
--  الحل: جدول منفصل تماماً، RLS مفعّل بلا أي CREATE POLICY لأي دور
--  (anon/authenticated) — أي رفض كل وصول بشكل افتراضي (RLS "deny by
--  default" عند عدم وجود سياسة مطابقة). القارئ/الكاتب الوحيد المسموح
--  هو supabaseAdmin (مفتاح service role، src/lib/supabase/admin.ts)
--  من داخل src/app/api/super-admin/restaurants/route.ts فقط، المحمي
--  بفحص كوكي sa_session == SUPER_ADMIN_SESSION_TOKEN (isAuthed()).
--  service role يتجاوز RLS دائماً بحكم طبيعته، لذا غياب أي سياسة هنا
--  ليس نقصاً بل تعزيز مقصود: حتى لو استُخدم مفتاح anon/authenticated
--  بالخطأ على هذا الجدول تحديداً (كودياً أو يدوياً)، تُرفض القراءة/
--  الكتابة تلقائياً لأن RLS مفعّل ولا توجد أي سياسة تسمح بأي شيء.
--  لا نضيف سياسة قائمة على is_super_admin() لأن مسار سوبر أدمن هنا
--  ليس Supabase Auth (لا JWT/auth.uid()) بل كوكي سرّي مشترك — لا يوجد
--  "دور" مصادقة نربط به سياسة، والمسار الوحيد الصحيح هو تجاوز RLS
--  بالكامل عبر service role من كود خادم محمي.
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_owner_contacts (
  restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  owner_name    TEXT,
  owner_phone   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE restaurant_owner_contacts ENABLE ROW LEVEL SECURITY;

-- عمداً: لا توجد أي سياسة CREATE POLICY هنا لأي دور — راجع الخلفية أعلاه.

-- إعادة استخدام دالة التحديث التلقائي لـ updated_at المعرّفة أصلاً بـ
-- 20260629063451_inventory.sql (update_updated_at_column) — لا تُعاد
-- كتابتها، فقط تُربط بجدول جديد.
DROP TRIGGER IF EXISTS restaurant_owner_contacts_updated_at ON restaurant_owner_contacts;
CREATE TRIGGER restaurant_owner_contacts_updated_at
  BEFORE UPDATE ON restaurant_owner_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';
