-- ============================================================
-- ميزة "تعديل الطلب": جدول order_edits + عمودا orders.pending_edit_id /
-- orders.last_edit_id — يسمح بتعديل طلبات محلية (order_type='pickup'،
-- من لوحة التحكم الرئيسية) مباشرة من الكاشير، وتعديل طلبات التوصيل
-- (order_type='delivery') من الزبون عبر صفحة التتبع العامة، مع مرور
-- تعديل الزبون إلزامياً بمراجعة/قبول الكاشير قبل وصوله للمطبخ.
--
-- order_edits يسجّل كل محاولة تعديل (previous_items/new_items = لقطة
-- عناصر الطلب قبل/بعد كـ JSONB، وليس FK لجدول order_items — لأن صفوف
-- order_items نفسها تُستبدل عند القبول، فلا يبقى شيء يُشار إليه لاحقاً
-- لعرض "ماذا تغيّر" بتاريخ الطلب/شاشة المطبخ).
--
-- edited_by='cashier' + status='accepted' مباشرة: تعديل الكاشير لطلب
-- محلي يُطبَّق فوراً بلا انتظار موافقة أحد (هو نفسه صاحب القرار).
-- edited_by='customer' + status='pending': تعديل الزبون ينتظر قبول/رفض
-- الكاشير قبل أن ينعكس على order_items الفعلية.
--
-- orders.pending_edit_id: تعديل زبون بانتظار مراجعة — يُصفَّر عند القبول/الرفض.
-- orders.last_edit_id: آخر تعديل طُبِّق فعلياً (من أي مصدر) — تستخدمه
-- شاشة المطبخ لعرض "✏️ معدّل" مع العناصر القديمة مشطوبة فوق الحالية.
--
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations
-- هذا المشروع — لا يُطبَّق تلقائياً). كل الأوامر آمنة لإعادة التشغيل.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0) جدول order_edits
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_edits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  edited_by       TEXT NOT NULL CHECK (edited_by IN ('cashier', 'customer')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  previous_items  JSONB NOT NULL,
  new_items       JSONB NOT NULL,
  previous_total  NUMERIC(12,2) NOT NULL,
  new_total       NUMERIC(12,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  accepted_by     UUID,
  rejected_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_order_edits_order_id ON order_edits(order_id);
CREATE INDEX IF NOT EXISTS idx_order_edits_restaurant_pending ON order_edits(restaurant_id) WHERE status = 'pending';

-- يمنع سباق الإرسال المزدوج (double-submit) من إنشاء صفّي 'pending' متزامنين
-- لنفس الطلب — فحص pending_edit_id بمستوى التطبيق وحده لا يكفي تحت تزامن حقيقي.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_edits_one_pending_per_order ON order_edits(order_id) WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────
-- 1) عمودا orders.pending_edit_id / orders.last_edit_id
-- ─────────────────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pending_edit_id UUID REFERENCES order_edits(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_edit_id UUID REFERENCES order_edits(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_pending_edit ON orders(restaurant_id) WHERE pending_edit_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2) RLS — نفس صلاحيات orders بالضبط: is_privileged_or_cashier_of
--    (owner/manager/cashier) OR is_super_admin() لكل شيء، ودور kitchen
--    قراءة فقط (لازمة لشاشة المطبخ لعرض previous_items بالتذكرة).
--    الدالتان معرَّفتان مسبقاً بـ:
--      is_privileged_or_cashier_of → 20260713110000_cashier_owner_parity_rls.sql
--      is_super_admin              → 20260710120000_rbac_custom_claims.sql
--      is_kitchen_of               → 20260805090000_kitchen_role.sql
--    لا تعريف جديد هنا — فقط استخدام. مسار الزبون (customer) يمر حصراً
--    عبر supabaseAdmin بمفتاح service-role من /api/track/edit، فلا يحتاج
--    أي سياسة RLS لـ anon هنا (نفس نمط orders عبر /api/track).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE order_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_edits: privileged or cashier full access" ON order_edits;
CREATE POLICY "order_edits: privileged or cashier full access"
  ON order_edits FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "order_edits: kitchen read" ON order_edits;
CREATE POLICY "order_edits: kitchen read"
  ON order_edits FOR SELECT
  USING (is_kitchen_of(restaurant_id));

-- إعادة تحميل schema cache فوراً بعد إضافة الجدول/الأعمدة/السياسات
NOTIFY pgrst, 'reload schema';
