-- ============================================================
-- إصلاح: user_roles ناقص أعمدة كان يفترض إضافتها بـ
-- 20260710120000_rbac_custom_claims.sql و20260710125000_rbac_user_roles_push.sql
-- ============================================================
-- السبب الأرجح: user_roles كان موجوداً مسبقاً بشكل أبسط، وCREATE TABLE
-- IF NOT EXISTS بذلك الملف تجاهل بصمت إضافة الأعمدة الجديدة (display_name,
-- code) لأن الجدول "موجود أصلاً" من منظور Postgres — وهذا سبب خطأ
-- PostgREST: "Could not find the 'code' column of 'user_roles' in the
-- schema cache" عند إضافة موظف/كاشير أو سائق (كلاهما يكتب لنفس الجدول).
-- ============================================================

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_roles ALTER COLUMN display_name DROP DEFAULT;

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_code_unique
  ON user_roles (LOWER(code)) WHERE code IS NOT NULL;

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS push_subscription JSONB;

NOTIFY pgrst, 'reload schema';
