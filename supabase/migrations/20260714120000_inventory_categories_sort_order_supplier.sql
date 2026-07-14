-- ============================================================
-- Inventory Categories — ترتيب العرض (sort_order) واسم المورد (supplier)
-- sort_order: يتحكم بترتيب ظهور شرائح الفئات في تبويب "المواد"، وترتيب
-- قائمة تبويب "الفئات" الجديد بصفحة المخزون. NULL = تظهر بالأسفل حتى
-- تُرتَّب يدوياً (نفس سلوك عمود sort_order بجدول categories بالمنيو).
-- supplier: اسم المورد الافتراضي المرتبط بالفئة (نص حر مستقل تماماً عن
-- عمود supplier الموجود أصلاً بجدول inventory_items لكل مادة على حدة).
-- شغّل هذا الكود يدوياً في Supabase SQL Editor بعد المراجعة.
-- ============================================================

ALTER TABLE inventory_categories
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT NULL;

ALTER TABLE inventory_categories
  ADD COLUMN IF NOT EXISTS supplier TEXT;

-- لا حاجة لتعديل RLS: السياسة الحالية "inventory_categories: privileged or
-- cashier full access" تعمل على مستوى الصف (restaurant_id) وتغطي الأعمدة
-- الجديدة تلقائياً — لا استثناء بالصلاحيات.
