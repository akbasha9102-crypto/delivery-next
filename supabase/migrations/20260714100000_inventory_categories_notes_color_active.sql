-- ============================================================
-- Inventory Categories — ملاحظات، لون مميز، وتفعيل/تعطيل الفئة
-- يتيح لصاحب المطعم وصفاً حراً لكل فئة، لوناً مميزاً لها (hex كامل
-- يُطبَّق inline وليس كلاس Tailwind ديناميكي)، وتعطيلها مؤقتاً دون
-- حذفها أو حذف المواد المرتبطة بها.
-- شغّل هذا الكود في Supabase SQL Editor.
-- ============================================================

ALTER TABLE inventory_categories
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE inventory_categories
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#94a3b8';

ALTER TABLE inventory_categories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- لا حاجة لتعديل RLS: السياسة الحالية "inventory_categories: privileged or
-- cashier full access" (20260713110000) تعمل على مستوى الصف (restaurant_id)
-- وتغطي الأعمدة الجديدة تلقائياً.
