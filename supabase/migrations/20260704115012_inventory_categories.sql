-- ============================================================
-- Inventory Categories — فئات المخزون المستقلة
-- تسمح بإضافة فئة جديدة دون الحاجة لإنشاء مادة أولاً،
-- لتظهر لاحقاً كخيار جاهز داخل نافذة "إضافة مادة جديدة".
-- شغّل هذا الكود في Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gbmwrvnmvobvieembxmf/sql/new
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_categories (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT inventory_categories_unique UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inv_categories_restaurant ON inventory_categories(restaurant_id);

ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_categories: owner can do all"
  ON inventory_categories FOR ALL
  USING (is_restaurant_owner(restaurant_id))
  WITH CHECK (is_restaurant_owner(restaurant_id));

CREATE POLICY "inventory_categories: super_admin can do all"
  ON inventory_categories FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
