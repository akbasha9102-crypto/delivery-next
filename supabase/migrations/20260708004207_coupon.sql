-- كوبون الخصم: كوبون واحد لكل مطعم، خصم نسبة مئوية، يضبطه المالك من الإعدادات
-- ويدخله الزبون بصفحة السلة (/cart) عند إتمام الطلب.

ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS coupon_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_enabled BOOLEAN NOT NULL DEFAULT false;

-- سجل تاريخي بكل طلب (لا يتأثر بتعديل لاحق على الكوبون بالإعدادات)، بنفس فلسفة delivery_fee.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
