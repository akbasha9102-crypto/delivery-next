-- ============================================================
-- RBAC v2 — خطوة إضافية: ربط approval_requests/cashier_shifts بـ
-- auth.uid() مباشرة (بدل الاعتماد فقط على restaurant_staff.id القديم)
-- شغّل بعد 20260710122000_rbac_rls_policies.sql
-- ============================================================
-- إضافية بالكامل. الهدف: يقدر العميل (المتصفح) يفلتر Realtime حسب
-- session.user.id مباشرة من الـ JWT بدون أي نداء API إضافي لمعرفة
-- restaurant_staff.id تبعه. staff_actions_log عنده performed_by_auth_id
-- من قبل أصلاً (لا حاجة لعمود جديد فيه).
-- ============================================================

ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS requested_by_user_id UUID REFERENCES auth.users(id);

ALTER TABLE cashier_shifts
  ADD COLUMN IF NOT EXISTS staff_user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_approvals_requested_by_user ON approval_requests(requested_by_user_id) WHERE requested_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shifts_staff_user ON cashier_shifts(staff_user_id) WHERE staff_user_id IS NOT NULL;

-- Backfill من الصفوف الحالية عبر restaurant_staff.auth_user_id
UPDATE approval_requests ar
SET requested_by_user_id = rs.auth_user_id
FROM restaurant_staff rs
WHERE ar.requested_by = rs.id AND ar.requested_by_user_id IS NULL AND rs.auth_user_id IS NOT NULL;

UPDATE cashier_shifts cs
SET staff_user_id = rs.auth_user_id
FROM restaurant_staff rs
WHERE cs.staff_id = rs.id AND cs.staff_user_id IS NULL AND rs.auth_user_id IS NOT NULL;

-- تحديث سياسة "own requests/shifts" لتقرأ auth.uid() مباشرة بدل subquery على restaurant_staff
DROP POLICY IF EXISTS "approval_requests: own requests" ON approval_requests;
CREATE POLICY "approval_requests: own requests"
  ON approval_requests FOR ALL
  USING (is_cashier_of(restaurant_id) AND requested_by_user_id = auth.uid())
  WITH CHECK (is_cashier_of(restaurant_id) AND requested_by_user_id = auth.uid());

DROP POLICY IF EXISTS "cashier_shifts: own shifts" ON cashier_shifts;
CREATE POLICY "cashier_shifts: own shifts"
  ON cashier_shifts FOR ALL
  USING (is_cashier_of(restaurant_id) AND staff_user_id = auth.uid())
  WITH CHECK (is_cashier_of(restaurant_id) AND staff_user_id = auth.uid());
