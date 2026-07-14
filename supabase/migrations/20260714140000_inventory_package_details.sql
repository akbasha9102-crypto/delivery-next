-- تفاصيل التعبئة الداخلية عند اختيار وحدة "صندوق" أو "كيس" في المخزون.
-- current_stock يبقى دائماً بعدد/وزن الوحدة الأصلية المختارة (unit) كما يُدخلها المستخدم.
-- package_quantity + package_unit يخزّنان تفصيل ما بداخل الصندوق/الكيس الواحد (مثال: صندوق = 12 قطعة، كيس = 5 كيلو).
-- تبقى NULL لأي مادة بوحدة قياس أخرى (قطعة، غرام، كيلو، لتر، علبة).

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS package_quantity NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS package_unit TEXT;

ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_package_quantity_nonneg
  CHECK (package_quantity IS NULL OR package_quantity >= 0);
