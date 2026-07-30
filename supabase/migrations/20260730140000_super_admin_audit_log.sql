-- سجل تدقيق لإجراءات سوبر أدمن الحساسة (تعديل مستخدمي Auth عموماً وحسابات
-- ملاك المطاعم تحديداً — تغيير إيميل/كلمة مرور). جدول مستقل عن
-- impersonation_log (migration 20260728130000) لأن ذاك الجدول مبني حول
-- انتحال هوية مالك مطعم محدد (restaurant_id/target_owner_id كلاهما
-- NOT NULL)، بينما إجراءات هذا السجل قد تستهدف أي مستخدم Supabase Auth
-- (بما فيهم سوبر أدمن آخرين مستقبلاً) بلا ربط إلزامي بمطعم — فلا يناسبه
-- نفس القيود. RLS مقفلة بالكامل (deny-all): فقط supabaseAdmin بمفتاح
-- service-role يتجاوز RLS، لا حاجة لأي سياسة سماح.
CREATE TABLE IF NOT EXISTS super_admin_audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action                TEXT NOT NULL,
  target_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_restaurant_id  UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  performed_by_label    TEXT NOT NULL DEFAULT 'super_admin',
  details               JSONB,
  ip_address            TEXT,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_log_target_user ON super_admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_log_created_at ON super_admin_audit_log(created_at DESC);

ALTER TABLE super_admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_super_admin_audit_log" ON super_admin_audit_log;
CREATE POLICY "deny_all_super_admin_audit_log" ON super_admin_audit_log FOR ALL USING (false);
