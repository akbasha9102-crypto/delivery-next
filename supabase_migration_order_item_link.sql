-- ============================================================
-- ربط عناصر الطلب بالمنتج الفعلي في المنيو
-- لازم لخصم مكونات الوجبة من المخزون تلقائياً عند قبول الطلب
-- شغّل هذا الكود في Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gbmwrvnmvobvieembxmf/sql/new
-- ============================================================

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_item_id ON order_items(item_id) WHERE item_id IS NOT NULL;
