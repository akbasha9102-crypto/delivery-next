-- ============================================================
-- Inventory Management System — نظام إدارة المستودع
-- شغّل هذا الكود في Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gbmwrvnmvobvieembxmf/sql/new
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. جدول inventory_items — المواد الخام والمخزون
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  category          TEXT        DEFAULT 'عام',          -- مشروبات / لحوم / خبز / خضار ...
  unit              TEXT        NOT NULL DEFAULT 'قطعة', -- قطعة | غرام | كيلو | لتر | علبة
  current_stock     NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_alert_stock   NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_quantity  NUMERIC(12,3) DEFAULT 0,            -- الكمية المقترحة عند إعادة الطلب
  cost_per_unit     NUMERIC(12,3) NOT NULL DEFAULT 0,
  supplier          TEXT,                               -- اسم المورد
  barcode           TEXT,                               -- باركود المادة (اختياري)
  notes             TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT inventory_items_stock_non_negative CHECK (current_stock >= 0),
  CONSTRAINT inventory_items_min_alert_non_negative CHECK (min_alert_stock >= 0),
  CONSTRAINT inventory_items_cost_non_negative CHECK (cost_per_unit >= 0)
);

-- فهارس inventory_items
CREATE INDEX IF NOT EXISTS idx_inv_items_restaurant   ON inventory_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_category     ON inventory_items(restaurant_id, category);
CREATE INDEX IF NOT EXISTS idx_inv_items_low_stock    ON inventory_items(restaurant_id)
  WHERE current_stock <= min_alert_stock AND is_active = TRUE;

-- trigger: تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────
-- 2. جدول menu_recipes — وصفات ومكونات الوجبات
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_recipes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id        UUID        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  inventory_item_id   UUID        NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity_required   NUMERIC(12,3) NOT NULL DEFAULT 1,
  is_optional         BOOLEAN     NOT NULL DEFAULT FALSE, -- هل المكون اختياري؟
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT menu_recipes_unique UNIQUE (menu_item_id, inventory_item_id),
  CONSTRAINT menu_recipes_qty_positive CHECK (quantity_required > 0)
);

-- فهارس menu_recipes
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item      ON menu_recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_inventory_item ON menu_recipes(inventory_item_id);

CREATE TRIGGER menu_recipes_updated_at
  BEFORE UPDATE ON menu_recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────
-- 3. جدول stock_movements — سجل حركات المخزون
-- ─────────────────────────────────────────────────────────────
CREATE TYPE IF NOT EXISTS stock_movement_type AS ENUM (
  'IN',          -- استلام / شراء
  'OUT_ORDER',   -- استهلاك بسبب طلب
  'WASTE',       -- تلف أو هدر
  'ADJUSTMENT',  -- تعديل يدوي من المدير
  'RETURN'       -- إرجاع للمورد
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id                  UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id   UUID                 NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  restaurant_id       UUID                 NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  movement_type       stock_movement_type  NOT NULL,
  quantity_changed    NUMERIC(12,3)        NOT NULL,
  stock_before        NUMERIC(12,3),       -- الكمية قبل الحركة (للتدقيق)
  stock_after         NUMERIC(12,3),       -- الكمية بعد الحركة (للتدقيق)
  cost_at_time        NUMERIC(12,3),       -- التكلفة لحظة الحركة
  reference_id        UUID,               -- مثل: order_id إذا كانت OUT_ORDER
  reference_type      TEXT,               -- 'order' | 'purchase' | 'manual' ...
  performed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

  CONSTRAINT stock_movements_qty_nonzero CHECK (quantity_changed != 0)
);

-- فهارس stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_mov_restaurant  ON stock_movements(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_item        ON stock_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_type        ON stock_movements(restaurant_id, movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_mov_created     ON stock_movements(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_mov_reference   ON stock_movements(reference_id) WHERE reference_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 4. دالة: خصم المخزون تلقائياً عند تسجيل حركة OUT/WASTE
--    وإضافته عند IN/RETURN — مع حفظ stock_before / stock_after
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_before NUMERIC(12,3);
  v_delta  NUMERIC(12,3);
BEGIN
  SELECT current_stock INTO v_before
  FROM inventory_items
  WHERE id = NEW.inventory_item_id
  FOR UPDATE;

  -- تحديد اتجاه الحركة
  IF NEW.movement_type IN ('IN', 'RETURN', 'ADJUSTMENT') THEN
    v_delta := ABS(NEW.quantity_changed);
  ELSE
    v_delta := -ABS(NEW.quantity_changed);
  END IF;

  -- رفض الحركة لو ستجعل المخزون سالباً
  IF v_before + v_delta < 0 THEN
    RAISE EXCEPTION 'المخزون غير كافٍ: الرصيد الحالي % والكمية المطلوبة %',
      v_before, ABS(NEW.quantity_changed);
  END IF;

  -- تحديث المخزون
  UPDATE inventory_items
  SET current_stock = v_before + v_delta
  WHERE id = NEW.inventory_item_id;

  -- حفظ snapshot للتدقيق
  NEW.stock_before := v_before;
  NEW.stock_after  := v_before + v_delta;
  NEW.cost_at_time := COALESCE(NEW.cost_at_time,
    (SELECT cost_per_unit FROM inventory_items WHERE id = NEW.inventory_item_id));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_stock_movement
  BEFORE INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();


-- ─────────────────────────────────────────────────────────────
-- 5. Row Level Security (RLS)
-- ─────────────────────────────────────────────────────────────

-- دالة مساعدة: هل المستخدم الحالي مالك هذا المطعم؟
CREATE OR REPLACE FUNCTION is_restaurant_owner(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants
    WHERE id = p_restaurant_id
      AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- دالة مساعدة: هل المستخدم الحالي سوبر أدمن؟
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'super_admin')::BOOLEAN,
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── inventory_items ──
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_items: owner can do all"
  ON inventory_items FOR ALL
  USING (is_restaurant_owner(restaurant_id))
  WITH CHECK (is_restaurant_owner(restaurant_id));

CREATE POLICY "inventory_items: super_admin can do all"
  ON inventory_items FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ── menu_recipes ──
ALTER TABLE menu_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_recipes: owner can do all"
  ON menu_recipes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM items i
      WHERE i.id = menu_recipes.menu_item_id
        AND is_restaurant_owner(i.restaurant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM items i
      WHERE i.id = menu_recipes.menu_item_id
        AND is_restaurant_owner(i.restaurant_id)
    )
  );

CREATE POLICY "menu_recipes: super_admin can do all"
  ON menu_recipes FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ── stock_movements ──
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements: owner can do all"
  ON stock_movements FOR ALL
  USING (is_restaurant_owner(restaurant_id))
  WITH CHECK (is_restaurant_owner(restaurant_id));

CREATE POLICY "stock_movements: super_admin can do all"
  ON stock_movements FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());


-- ─────────────────────────────────────────────────────────────
-- 6. View مفيدة: المواد التي وصلت للحد الأدنى
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW low_stock_alerts AS
SELECT
  ii.id,
  ii.restaurant_id,
  r.name            AS restaurant_name,
  ii.name           AS item_name,
  ii.unit,
  ii.current_stock,
  ii.min_alert_stock,
  ii.reorder_quantity,
  ii.supplier,
  (ii.min_alert_stock - ii.current_stock) AS shortage_quantity
FROM inventory_items ii
JOIN restaurants r ON r.id = ii.restaurant_id
WHERE ii.current_stock <= ii.min_alert_stock
  AND ii.is_active = TRUE;


-- ─────────────────────────────────────────────────────────────
-- 7. View: تكلفة الوجبة الواحدة
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW menu_item_cost AS
SELECT
  mr.menu_item_id,
  i.name            AS menu_item_name,
  i.restaurant_id,
  SUM(mr.quantity_required * ii.cost_per_unit) AS total_cost_per_serving
FROM menu_recipes mr
JOIN items i         ON i.id  = mr.menu_item_id
JOIN inventory_items ii ON ii.id = mr.inventory_item_id
WHERE mr.is_optional = FALSE
GROUP BY mr.menu_item_id, i.name, i.restaurant_id;
