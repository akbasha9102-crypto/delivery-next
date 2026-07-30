-- جدول تحديد معدّل محاولات تسجيل الدخول (resolve-login للمالك/الموظف/السائق
-- وسوبر أدمن) — يمنع تخمين slug/code عبر هجوم قوة غاشمة (brute force) على
-- /api/auth/resolve-login و/api/driver/resolve-login و/api/super-admin/auth.
-- RLS مقفلة بالكامل (deny-all): فقط supabaseAdmin بمفتاح service-role
-- يتجاوز RLS ويكتب/يقرأ هذا الجدول من الـ routes نفسها، لا حاجة لأي
-- سياسة سماح — لا مستخدم (anon أو authenticated) يصل لهذا الجدول مباشرة.
CREATE TABLE IF NOT EXISTS login_rate_limits (
  id           BIGSERIAL PRIMARY KEY,
  scope        TEXT NOT NULL,
  rate_key     TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_rate_limits_scope_key_time
  ON login_rate_limits (scope, rate_key, attempted_at DESC);

ALTER TABLE login_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_login_rate_limits" ON login_rate_limits;
CREATE POLICY "deny_all_login_rate_limits" ON login_rate_limits FOR ALL USING (false);
