-- ============================================================
-- RBAC نظام صلاحيات الموظفين (المالك/المدير مقابل الكاشير)
-- شغّل هذا الكود في Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gbmwrvnmvobvieembxmf/sql/new
-- ============================================================
-- ملاحظة مهمة (أمن):
-- حساب Supabase Auth الحالي واحد لكل مطعم (owner)، والكاشير يشارك نفس
-- الـ JWT. لذلك RLS هنا **لا يستطيع** التمييز بين "مالك" و"كاشير" ضمن
-- نفس المطعم — فقط يعزل مطعماً عن آخر (نفس نمط is_restaurant_owner
-- الموجود في supabase_migration_inventory.sql). إنفاذ صلاحيات الكاشير
-- الحقيقي يتم في طبقة API (Next.js route handlers + service role) التي
-- تجيب دور/حدود staff_id من هذه الجداول مباشرة من القاعدة، ولا تثق
-- بأي دور يُرسل من العميل. راجع خطة_نظام_الصلاحيات_RBAC.md القسم 3 و 6.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. جدول restaurant_staff — الموظفون (كاشير/مدير) المرتبطون بكل مطعم
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_staff (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id         UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  display_name          TEXT        NOT NULL,
  role                  TEXT        NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  pin_hash              TEXT        NOT NULL,              -- scrypt (salt:hash) — ليس نصاً صريحاً أبداً
  auth_user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL, -- اختياري: دخول عن بعد لاحقاً
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  max_discount_pct      NUMERIC(5,2)  NOT NULL DEFAULT 0,  -- سقف الخصم المسموح دون موافقة
  max_void_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,  -- سقف الإلغاء/الاسترجاع دون موافقة
  failed_pin_attempts   INTEGER     NOT NULL DEFAULT 0,    -- soft-lock: عدّاد محاولات PIN الخاطئة
  locked_until          TIMESTAMPTZ,                       -- soft-lock: مقفل مؤقتاً حتى هذا الوقت
  push_subscription     JSONB,                              -- اشتراك Push (owner/manager) لإشعارات الموافقة الفورية
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT restaurant_staff_discount_range CHECK (max_discount_pct >= 0 AND max_discount_pct <= 100),
  CONSTRAINT restaurant_staff_void_nonneg    CHECK (max_void_amount >= 0)
);

-- فهارس restaurant_staff
CREATE INDEX IF NOT EXISTS idx_staff_restaurant        ON restaurant_staff(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_restaurant_active ON restaurant_staff(restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_staff_auth_user         ON restaurant_staff(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- trigger: تحديث updated_at تلقائياً (نفس الدالة المستخدمة بـ migration المخزون —
-- يُعاد تعريفها هنا idempotently تحسباً لعدم تشغيل تلك الـ migration بعد)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS restaurant_staff_updated_at ON restaurant_staff;
CREATE TRIGGER restaurant_staff_updated_at
  BEFORE UPDATE ON restaurant_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────
-- 2. جدول cashier_shifts — ورديات الكاشير (فتح/إغلاق + جرد الكاش)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cashier_shifts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id         UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_id              UUID        NOT NULL REFERENCES restaurant_staff(id),
  opening_cash          NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_closing_cash NUMERIC(12,2),          -- محسوبة تلقائياً من مجموع الطلبات المكتملة خلال الوردية
  actual_closing_cash   NUMERIC(12,2),          -- يُدخلها الكاشير يدوياً عند الإغلاق
  variance              NUMERIC(12,2),          -- الفرق — يُنبَّه المالك تلقائياً لو تجاوز حداً معيناً
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at             TIMESTAMPTZ,
  status                TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),

  CONSTRAINT cashier_shifts_opening_nonneg CHECK (opening_cash >= 0)
);

-- فهارس cashier_shifts
CREATE INDEX IF NOT EXISTS idx_shifts_restaurant       ON cashier_shifts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff            ON cashier_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_open       ON cashier_shifts(staff_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_shifts_restaurant_status ON cashier_shifts(restaurant_id, status);


-- ─────────────────────────────────────────────────────────────
-- 3. جدول approval_requests — طلبات الموافقة الفورية
--    (Void كبير / خصم يتجاوز الحد / استرجاع)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  requested_by    UUID        NOT NULL REFERENCES restaurant_staff(id),
  request_type    TEXT        NOT NULL CHECK (request_type IN ('void_order', 'refund', 'discount_override', 'price_override')),
  order_id        UUID        REFERENCES orders(id),
  amount          NUMERIC(12,2),             -- مبلغ الإلغاء/الاسترجاع، أو نسبة الخصم المطلوبة
  reason          TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by     UUID        REFERENCES restaurant_staff(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- فهارس approval_requests
CREATE INDEX IF NOT EXISTS idx_approvals_restaurant        ON approval_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_approvals_restaurant_status ON approval_requests(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_order             ON approval_requests(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approvals_requested_by      ON approval_requests(requested_by);


-- ─────────────────────────────────────────────────────────────
-- 4. جدول staff_actions_log — سجل تدقيق شامل لكل عملية حساسة
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_actions_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_id        UUID        REFERENCES restaurant_staff(id),
  action_type     TEXT        NOT NULL,      -- 'order_void' | 'order_refund' | 'discount_applied' | 'shift_open' | 'shift_close' | 'approval_requested' | 'approval_approved' | 'approval_rejected' ...
  entity_type     TEXT,                       -- 'order' | 'cashier_shift' | 'approval_request' | 'inventory_item' ...
  entity_id       UUID,
  before_data     JSONB,
  after_data      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس staff_actions_log
CREATE INDEX IF NOT EXISTS idx_actions_log_restaurant      ON staff_actions_log(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_actions_log_restaurant_time ON staff_actions_log(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_log_staff           ON staff_actions_log(staff_id);
CREATE INDEX IF NOT EXISTS idx_actions_log_entity          ON staff_actions_log(entity_type, entity_id);


-- ─────────────────────────────────────────────────────────────
-- 5. دوال مساعدة (نفس نمط supabase_migration_inventory.sql)
--    يُعاد تعريفها هنا idempotently (CREATE OR REPLACE) تحسباً لعدم
--    تشغيل migration المخزون بعد، أو لتشغيل هذا الملف قبله.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_restaurant_owner(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants
    WHERE id = p_restaurant_id
      AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'super_admin')::BOOLEAN,
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- get_staff_role: دور المستخدم الحالي (auth.uid()) بالنسبة لمطعم معيّن.
-- يعيد 'owner' إن كان صاحب المطعم (owner_id)، وإلا يحاول إيجاد صف
-- restaurant_staff مرتبط بنفس auth.uid() عبر auth_user_id (Phase لاحقة
-- عندما يُربط كاشير بحساب Auth حقيقي). في المرحلة الأولى (PIN فقط بدون
-- حساب Auth منفصل للكاشير) هذه الدالة تعيد 'owner' أو NULL فقط — وهذا
-- متوقع وموثّق بالخطة (القسم 3): الإنفاذ الحقيقي لدور الكاشير هو بطبقة
-- API عبر staff_id، وليس عبر RLS/auth.uid().
CREATE OR REPLACE FUNCTION get_staff_role(p_restaurant_id UUID)
RETURNS TEXT AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND owner_id = auth.uid())
      THEN 'owner'
    ELSE (
      SELECT role FROM restaurant_staff
      WHERE restaurant_id = p_restaurant_id AND auth_user_id = auth.uid() AND is_active = TRUE
      LIMIT 1
    )
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ─────────────────────────────────────────────────────────────
-- 6. Row Level Security (RLS)
--    يعزل مطعماً عن آخر فقط — لا يميّز مالك/كاشير (راجع الملاحظة أعلى الملف).
--    كل الكتابة الحساسة (فتح/إغلاق الإجراءات المقيّدة) يجب أن تمر عبر
--    API route handlers بصلاحية service role (supabaseAdmin) التي تتجاوز RLS
--    أصلاً وتفرض القيود الحقيقية بالكود.
-- ─────────────────────────────────────────────────────────────

-- ── restaurant_staff ──
ALTER TABLE restaurant_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_staff: owner can do all"
  ON restaurant_staff FOR ALL
  USING (is_restaurant_owner(restaurant_id))
  WITH CHECK (is_restaurant_owner(restaurant_id));

CREATE POLICY "restaurant_staff: super_admin can do all"
  ON restaurant_staff FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ── cashier_shifts ──
ALTER TABLE cashier_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashier_shifts: owner can do all"
  ON cashier_shifts FOR ALL
  USING (is_restaurant_owner(restaurant_id))
  WITH CHECK (is_restaurant_owner(restaurant_id));

CREATE POLICY "cashier_shifts: super_admin can do all"
  ON cashier_shifts FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ── approval_requests ──
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_requests: owner can do all"
  ON approval_requests FOR ALL
  USING (is_restaurant_owner(restaurant_id))
  WITH CHECK (is_restaurant_owner(restaurant_id));

CREATE POLICY "approval_requests: super_admin can do all"
  ON approval_requests FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ── staff_actions_log ──
ALTER TABLE staff_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_actions_log: owner can do all"
  ON staff_actions_log FOR ALL
  USING (is_restaurant_owner(restaurant_id))
  WITH CHECK (is_restaurant_owner(restaurant_id));

CREATE POLICY "staff_actions_log: super_admin can do all"
  ON staff_actions_log FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ─────────────────────────────────────────────────────────────
-- 5. عمود إضافي على stock_movements (additive فقط — لا حذف/تعديل)
-- ─────────────────────────────────────────────────────────────
-- performed_by الحالي يشير إلى auth.users(id)، والكاشير (PIN فقط بدون
-- حساب Auth) لا يملك صفاً بهذا الجدول. هذا العمود الإضافي يسمح بتسجيل
-- هوية الكاشير الفعلي (restaurant_staff.id) عند WASTE مسجَّل من واجهة
-- الكاشير، دون المساس بعمود performed_by الأصلي أو أي بيانات موجودة.
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS performed_by_staff_id UUID REFERENCES restaurant_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_mov_staff ON stock_movements(performed_by_staff_id)
  WHERE performed_by_staff_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 6. عمود إضافي على orders (additive فقط) — إصلاح ثغرة أمنية:
-- تطبيق خصم ثانٍ على نفس الطلب كان يُحتسب فوق السعر المخصوم أصلاً
-- (تراكم تلقائي يتجاوز max_discount_pct الفعلي دون أي موافقة). هذا
-- العمود يحفظ السعر الأصلي قبل أول خصم فقط، ليُقاس كل خصم لاحق تراكمياً
-- بالنسبة للسعر الأصلي الحقيقي وليس آخر سعر بعد خصم سابق.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pre_discount_total NUMERIC(12,2);

-- ─────────────────────────────────────────────────────────────
-- 7. دخول مستقل حقيقي للكاشير (كود + كلمة مرور) — additive فقط
-- ─────────────────────────────────────────────────────────────
-- بدل شاشة "من أنت؟" بالـ PIN بعد جلسة المالك المشتركة، الكاشير الآن
-- يملك حساب Supabase Auth حقيقي مستقل (نفس نمط حساب المطعم `slug@dasha.app`
-- الموجود فعلاً)، بإيميل صناعي `<code>@cashier.dasha.app`. هذا يحل أيضاً
-- إشكال مشاركة JWT بين المالك والكاشير المذكور بالقسم 3 أعلاه.
-- pin_hash يبقى NOT NULL اختيارياً الآن (الكاشيرية الجدد يدخلون بكود+كلمة
-- مرور بدل PIN، والـ auth_user_id أصبح إلزامياً عملياً بدلاً من اختياري).
ALTER TABLE restaurant_staff
  ALTER COLUMN pin_hash DROP NOT NULL;

ALTER TABLE restaurant_staff
  ADD COLUMN IF NOT EXISTS code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_code_unique
  ON restaurant_staff (LOWER(code)) WHERE code IS NOT NULL;
