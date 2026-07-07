-- الحد الأدنى للطلب: مبلغ يحدده المطعم كأقل قيمة مسموحة لطلب التوصيل
-- (customer menu). عند تفعيله (> 0) يُمنع الزبون من إتمام طلب توصيل
-- بقيمة أقل منه. لا ينطبق على طلب الاستلام (pickup).

ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
