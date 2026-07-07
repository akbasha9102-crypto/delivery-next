-- رسوم التوصيل: مبلغ ثابت لكل مطعم يُضاف تلقائياً على فاتورة الزبون
-- عند اختيار "توصيل" من قائمة الطلب (customer menu)

-- إعداد رسوم التوصيل لكل مطعم (owner-scoped)
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

-- حفظ قيمة الرسوم الفعلية المطبّقة على كل طلب توصيل (سجل تاريخي —
-- لا يتغيّر لاحقاً حتى لو عدّل المالك رسوم التوصيل بالإعدادات)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
