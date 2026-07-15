-- السماح بتخصيص وحدة قياس مختلفة لسطر الوصفة (لكل وجبة) عن وحدة تتبّع المادة بالمخزون
-- مثال: المخزون يتتبّع الزيت باللتر، لكن الوصفة تحدّد الكمية بالمل لكل وجبة

ALTER TABLE menu_recipes ADD COLUMN IF NOT EXISTS unit TEXT;

-- تعبئة السطور الموجودة بوحدة المادة نفسها (نفس السلوك القديم قبل هذا التعديل)
UPDATE menu_recipes mr
SET unit = ii.unit
FROM inventory_items ii
WHERE ii.id = mr.inventory_item_id
  AND mr.unit IS NULL;

-- تحديث عرض تكلفة الوجبة ليحوّل الكمية من وحدة سطر الوصفة إلى وحدة المخزون قبل الضرب بالتكلفة
CREATE OR REPLACE VIEW menu_item_cost AS
SELECT
  mr.menu_item_id,
  i.name            AS menu_item_name,
  i.restaurant_id,
  SUM(
    mr.quantity_required
    * CASE
        WHEN mr.unit IS NULL OR mr.unit = ii.unit THEN 1
        WHEN mr.unit = 'غرام' AND ii.unit = 'كيلو' THEN 0.001
        WHEN mr.unit = 'كيلو' AND ii.unit = 'غرام' THEN 1000
        WHEN mr.unit = 'مل'   AND ii.unit = 'لتر'  THEN 0.001
        WHEN mr.unit = 'لتر'  AND ii.unit = 'مل'   THEN 1000
        ELSE 1
      END
    * ii.cost_per_unit
  ) AS total_cost_per_serving
FROM menu_recipes mr
JOIN items i         ON i.id  = mr.menu_item_id
JOIN inventory_items ii ON ii.id = mr.inventory_item_id
WHERE mr.is_optional = FALSE
GROUP BY mr.menu_item_id, i.name, i.restaurant_id;
