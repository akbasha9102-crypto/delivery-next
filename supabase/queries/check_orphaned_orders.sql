-- تحقق من الطلبات اليتيمة الناتجة عن باغ "اطلب مجددا" (restaurant_id مفقود)
-- استعلامات قراءة فقط (SELECT)، لا تُعدّل أي بيانات.
-- السبب: قبل commit 8afbab6، كان زر "اطلب مجددا" يُنشئ طلبات بدون restaurant_id
-- فتمر بصمت عبر RLS لكنها لا تظهر في لوحة تحكم أي مطعم.

-- 1) العدد الإجمالي للطلبات اليتيمة
SELECT count(*) FROM orders WHERE restaurant_id IS NULL;

-- 2) تفاصيل الطلبات اليتيمة (للمراجعة اليدوية أو التواصل مع الزبائن/المطاعم المتأثرة)
SELECT id, client_name, client_phone, total_amount, status, created_at
FROM orders
WHERE restaurant_id IS NULL
ORDER BY created_at DESC;
