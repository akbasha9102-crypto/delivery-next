-- ============================================================
-- login_page_identity: هوية بصرية قابلة للتخصيص لصفحة /login (خط ولون)
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations
-- هذا المشروع — لا يُطبَّق تلقائياً). كل الأوامر آمنة لإعادة التشغيل.
--
-- صف واحد فقط (singleton بمعرف ثابت) يخزّن اختيار سوبر أدمن/المالك لخط
-- ولون عنوان "ماشي" وخط ولون عبارة "تسجيل الدخول" بصفحة تسجيل الدخول.
-- هذا الإعداد عام لكل الزوار (لا علاقة له بالمتصفح/localStorage) — يُقرأ
-- من قِبَل صفحة /login نفسها (ISR بمهلة revalidate=30 ثانية).
--
-- brand_font_key و login_font_key يخزّنان "مفتاح" فقط من قائمة مغلقة
-- ثابتة بالكود (src/app/login/login-fonts.ts) — وليس اسم خط حر — لأن
-- next/font/google يتطلب استيراداً ثابتاً وقت البناء لكل خط مدعوم.
--
-- الكتابة محصورة بـ service role فقط عبر POST /api/login-settings، وهو
-- محمي بنفس كوكي جلسة sa_session المستخدم فعلاً بـ
-- src/app/api/super-admin/auth/route.ts (لا سر جديد، لا PIN جديد).
-- ============================================================

CREATE TABLE IF NOT EXISTS login_page_identity (
  id                UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  brand_font_key    TEXT NOT NULL DEFAULT 'lateef',
  brand_color       TEXT NOT NULL DEFAULT '#15803D',
  login_font_key    TEXT NOT NULL DEFAULT 'tajawal',
  login_color       TEXT NOT NULL DEFAULT '#1d1d1f',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT login_page_identity_singleton CHECK (id = '00000000-0000-0000-0000-000000000001')
);

INSERT INTO login_page_identity (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE login_page_identity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lpi: public read" ON login_page_identity;
CREATE POLICY "lpi: public read" ON login_page_identity
  FOR SELECT TO anon, authenticated USING (true);

-- عمداً: لا سياسة INSERT/UPDATE/DELETE — الكتابة فقط عبر service role من API محمي بكوكي الجلسة.

NOTIFY pgrst, 'reload schema';
