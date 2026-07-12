-- خصم على مستوى القسم أو الوجبة (منفصل عن كوبون الخصم العام):
-- المالك يقدر يحدد نسبة خصم لقسم كامل بالمنيو، أو لوجبة معينة.
-- خصم الوجبة (إن وُجد) يتغلّب على خصم القسم — لا تراكم بين الاثنين.
-- 0 = غير مفعّل، بنفس فلسفة min_order_amount / delivery_fee.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0;
