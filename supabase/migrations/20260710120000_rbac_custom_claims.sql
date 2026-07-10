-- ============================================================
-- RBAC v2: نظام صلاحيات مبني على Supabase Auth Custom Claims
-- شغّل هذا الكود في Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gbmwrvnmvobvieembxmf/sql/new
-- ============================================================
-- يستبدل نظام restaurant_staff + توكن HMAC الموقّع بالكود (staff-auth.ts)
-- بالآلية القياسية المعتمدة من Supabase: دالة custom_access_token_hook
-- تحقن role/restaurant_id داخل الـ JWT نفسه عند كل تسجيل دخول/تجديد جلسة،
-- و RLS يقرأ هذه الـ claims مباشرة بدل الوثوق بأي شيء من العميل.
--
-- ⚠️ هذا الملف إضافي بالكامل (لا يحذف أو يعطّل شيء من restaurant_staff بعد).
-- ⚠️ بعد تشغيله، لازم تُفعَّل الدالة يدوياً من:
--    Supabase Dashboard → Authentication → Hooks →
--    "Customize Access Token (Custom Claims)" → اختر public.custom_access_token_hook
--    قبل هذه الخطوة، الدالة موجودة لكن Supabase Auth لا يستدعيها بعد —
--    تسجيل الدخول الحالي (owner/cashier) يستمر يعمل بالضبط كما هو الآن.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. جدول user_roles — يغطي cashier/manager/driver فقط
--    (المالك owner يُحدَّد دائماً من restaurants.owner_id مباشرة —
--    لا حاجة لصف هنا له، ويتجنّب هذا إشكال المالك متعدد الفروع)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id     UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role              TEXT        NOT NULL CHECK (role IN ('manager', 'cashier', 'driver')),
  display_name      TEXT        NOT NULL,
  code              TEXT,                                    -- لتركيب البريد الصناعي عند الدخول (code@cashier.dasha.app)
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  max_discount_pct  NUMERIC(5,2)  NOT NULL DEFAULT 0,
  max_void_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_roles_discount_range CHECK (max_discount_pct >= 0 AND max_discount_pct <= 100),
  CONSTRAINT user_roles_void_nonneg    CHECK (max_void_amount >= 0),
  CONSTRAINT user_roles_one_role_per_restaurant UNIQUE (user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user         ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_restaurant    ON user_roles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_restaurant_ac ON user_roles(restaurant_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_code_unique
  ON user_roles (LOWER(code)) WHERE code IS NOT NULL;

DROP TRIGGER IF EXISTS user_roles_updated_at ON user_roles;
CREATE TRIGGER user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 2. Backfill من restaurant_staff الحالي (كاشير/مدير فقط، owner مستثنى
--    لأنه يُشتق من restaurants.owner_id) — تعمل فقط إن restaurant_staff
--    ما زال موجوداً؛ آمنة على INSERT مكرر بفضل ON CONFLICT.
-- ─────────────────────────────────────────────────────────────
INSERT INTO user_roles (user_id, restaurant_id, role, display_name, code, is_active, max_discount_pct, max_void_amount)
SELECT auth_user_id, restaurant_id,
       CASE WHEN role = 'owner' THEN 'manager' ELSE role END,  -- لا وجود لصف "owner" ثانٍ لنفس المطعم عادة؛ احتياطاً يُخفَّض لـ manager
       display_name, code, is_active, max_discount_pct, max_void_amount
FROM restaurant_staff
WHERE auth_user_id IS NOT NULL
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. دالة custom_access_token_hook — نقطة التوسّع القياسية بـ Supabase
--    تُستدعى من Supabase Auth نفسه عند كل إصدار/تجديد JWT (بعد تفعيلها
--    من الـ Dashboard). تحقن app_metadata.role و app_metadata.restaurant_id.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  v_uid uuid;
  v_role text;
  v_restaurant_id uuid;
BEGIN
  v_uid := (event->>'user_id')::uuid;
  claims := COALESCE(event->'claims', '{}'::jsonb);

  -- أولوية 1: مالك مطعم؟ (owner_id على restaurants مباشرة)
  SELECT id INTO v_restaurant_id FROM restaurants WHERE owner_id = v_uid LIMIT 1;
  IF v_restaurant_id IS NOT NULL THEN
    v_role := 'owner';
    -- restaurant_id يُترك NULL عمداً للمالك: RLS الخاص بالمالك يعتمد على
    -- restaurants.owner_id مباشرة (is_owner_of)، لا على هذا claim — تجنّباً
    -- لإشكال المالك صاحب أكثر من فرع/مطعم واحد.
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(v_role));
  ELSE
    -- أولوية 2: كاشير/مدير/سائق نشط عبر user_roles
    SELECT role, restaurant_id INTO v_role, v_restaurant_id
    FROM user_roles
    WHERE user_id = v_uid AND is_active = TRUE
    LIMIT 1;

    IF v_role IS NOT NULL THEN
      claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(v_role));
      claims := jsonb_set(claims, '{app_metadata,restaurant_id}', to_jsonb(v_restaurant_id::text));
    END IF;
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- صلاحيات إلزامية لكي يقدر Supabase Auth يستدعي هذي الدالة أثناء إصدار JWT
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON user_roles TO supabase_auth_admin;

DROP POLICY IF EXISTS "user_roles: auth admin can read for hook" ON user_roles;
CREATE POLICY "user_roles: auth admin can read for hook"
  ON user_roles FOR SELECT
  TO supabase_auth_admin
  USING (true);

-- ─────────────────────────────────────────────────────────────
-- 4. دوال مساعدة لـ RLS — تقرأ الدور مباشرة من الـ JWT (بعد تفعيل
--    الـ hook)، بدل subquery على كل صف. is_owner_of تبقى تفحص الجدول
--    مباشرة (owner_id) لأنها أصلاً O(1) على مفتاح restaurants، ولتجنّب
--    إشكال تعدد المطاعم بنفس claim واحد.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_owner_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION jwt_role() RETURNS TEXT AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION jwt_restaurant_id() RETURNS UUID AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'restaurant_id', '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_manager_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT jwt_role() = 'manager' AND jwt_restaurant_id() = p_restaurant_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_cashier_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT jwt_role() = 'cashier' AND jwt_restaurant_id() = p_restaurant_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_driver_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT jwt_role() = 'driver' AND jwt_restaurant_id() = p_restaurant_id;
$$ LANGUAGE sql STABLE;

-- "صلاحيات موسّعة كالمالك" (owner أو manager) — تستخدمها سياسات كثيرة
CREATE OR REPLACE FUNCTION is_privileged_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_owner_of(p_restaurant_id) OR is_manager_of(p_restaurant_id);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((auth.jwt() -> 'user_metadata' ->> 'super_admin')::BOOLEAN, FALSE);
$$ LANGUAGE sql SECURITY DEFINER STABLE;
-- (يُعاد تعريفها هنا idempotently فقط؛ آلية دخول السوبر-أدمن نفسها
--  خارج نطاق هذا العمل ولم تُمس)
