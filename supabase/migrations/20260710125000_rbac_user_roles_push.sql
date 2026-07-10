-- ============================================================
-- RBAC v2 — عمود push_subscription على user_roles (إضافي)
-- شغّل بعد 20260710124000_rbac_nullable_legacy_staff_fk.sql
-- ============================================================
-- owner/manager/cashier جديد يُنشأ بعد اليوم يوجد فقط بـ user_roles (لا
-- restaurant_staff مقابل) — بدون هذا العمود، تسجيل push للموافقات الفورية
-- (notify-owner-push.ts) لن يعمل لأي مدير جديد بعد اليوم.
-- restaurant_staff.push_subscription يبقى كما هو مؤقتاً (يُقرأ أيضاً حتى
-- حذف الجدول القديم بالخطوة الأخيرة).

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS push_subscription JSONB;
