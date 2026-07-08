-- الخصومات: خصم بنسبة مئوية على قسم كامل من المنيو أو على وجبة محددة.
-- يضبطه المالك من الإعدادات ← الخصومات، وينعكس تلقائياً على منيو الزبون وسلة الطلب.
-- خصم الوجبة (إن وُجد) له الأولوية على خصم القسم عند وجود الاثنين معاً.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0;
