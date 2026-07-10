-- ============================================================
-- RBAC v2 — تصحيح: كاشير جديد يُنشأ بعد هذا التاريخ يوجد بـ user_roles
-- فقط (بلا صف restaurant_staff مقابل) — لذا staff_id/requested_by
-- (NOT NULL REFERENCES restaurant_staff) لازم تصير اختيارية، والهوية
-- الفعلية تُقرأ من requested_by_user_id/staff_user_id بدلاً منها.
-- شغّل بعد 20260710123000_rbac_approvals_shifts_user_id.sql
-- ============================================================

ALTER TABLE approval_requests ALTER COLUMN requested_by DROP NOT NULL;
ALTER TABLE cashier_shifts    ALTER COLUMN staff_id      DROP NOT NULL;

ALTER TABLE approval_requests
  ADD CONSTRAINT approval_requests_has_requester
  CHECK (requested_by IS NOT NULL OR requested_by_user_id IS NOT NULL);

ALTER TABLE cashier_shifts
  ADD CONSTRAINT cashier_shifts_has_staff
  CHECK (staff_id IS NOT NULL OR staff_user_id IS NOT NULL);

-- نفس المشكلة على stock_movements.performed_by_staff_id (FK إلى
-- restaurant_staff، أضافه migration المخزون الأصلي) — يبقى NULL لأي
-- تسجيل هدر من كاشير جديد بنموذج user_roles، ونضيف عمود user_id بديل.
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS performed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_mov_user ON stock_movements(performed_by_user_id)
  WHERE performed_by_user_id IS NOT NULL;
