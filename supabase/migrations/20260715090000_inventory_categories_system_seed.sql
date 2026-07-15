-- ============================================================
-- Inventory Categories — تحويل الفئات الافتراضية إلى صفوف حقيقية
-- الفئات الثمانية (عام، مشروبات، لحوم، خبز، خضار، توابل، زيوت، تغليف)
-- كانت معرّفة فقط كمصفوفة JS ثابتة CATEGORIES بصفحة المخزون، لذلك لا
-- تظهر بتبويب "الفئات" ولا يمكن تعديلها أو حذفها. هذا الملف يزرعها
-- كصفوف حقيقية بجدول inventory_categories لكل مطعم موجود حالياً، مع
-- عمود is_system توضيحي (تمييز بصري فقط بالواجهة — لا يمنع أي تعديل
-- أو حذف، فعمود category بجدول inventory_items نص حر بلا foreign key).
-- المطاعم الجديدة تُزرع لها نفس الفئات مباشرة عند الإنشاء عبر
-- src/app/api/super-admin/restaurants/route.ts، فهذا الـ backfill
-- يغطي فقط المطاعم الموجودة مسبقاً.
-- شغّل هذا الكود يدوياً في Supabase SQL Editor بعد المراجعة.
-- ============================================================

ALTER TABLE inventory_categories
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO inventory_categories (restaurant_id, name, color, is_active, is_system, sort_order)
SELECT r.id, d.name, d.color, TRUE, TRUE, d.sort_order
FROM restaurants r
CROSS JOIN (VALUES
  ('عام',      '#64748b', 0),
  ('مشروبات',  '#3b82f6', 1),
  ('لحوم',     '#ef4444', 2),
  ('خبز',      '#a16207', 3),
  ('خضار',     '#22c55e', 4),
  ('توابل',    '#eab308', 5),
  ('زيوت',     '#a855f7', 6),
  ('تغليف',    '#14b8a6', 7)
) AS d(name, color, sort_order)
ON CONFLICT (restaurant_id, name) DO NOTHING;

-- لا حاجة لتعديل RLS: السياسة الحالية على inventory_categories (من
-- migration 20260713110000) تعمل على مستوى الصف (restaurant_id) وتغطي
-- العمود الجديد تلقائياً، ولا فرق صلاحيات بين المالك والكاشير على هذا
-- الجدول (متعمّد).
