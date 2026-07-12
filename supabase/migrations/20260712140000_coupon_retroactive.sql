-- كوبون رجعي: يسمح للموظف بتطبيق كوبون الخصم الحالي للمطعم على طلب
-- مكتمل بالفعل (POS/كاشير محلي فقط بهذه المرحلة) بدل الاقتصار على تطبيقه
-- بصفحة السلة عند إنشاء الطلب. مطفأ افتراضياً — المالك يفعّله صراحة.

ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS coupon_allow_retroactive BOOLEAN NOT NULL DEFAULT false;

-- توسيع قيد request_type بـ approval_requests ليشمل 'coupon_override' —
-- نفس فكرة تطبيق كوبون يتجاوز حد الخصم المسموح للكاشير دون موافقة، بنفس
-- مسار الموافقات الحالي لـ discount_override.
ALTER TABLE approval_requests
  DROP CONSTRAINT IF EXISTS approval_requests_request_type_check;

ALTER TABLE approval_requests
  ADD CONSTRAINT approval_requests_request_type_check
  CHECK (request_type IN ('void_order', 'refund', 'discount_override', 'price_override', 'coupon_override'));
