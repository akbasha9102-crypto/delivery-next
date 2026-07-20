-- ربط الطلبات اليتيمة الأربعة بمطعم داري (71620805-cc20-4e3a-abfc-0ca0f0bcacff)
-- بناءً على مطابقة أقرب طلب سابق/لاحق لنفس رقم الهاتف من find_orphaned_orders_restaurant.sql
-- الشرط "restaurant_id IS NULL" يحمي من تعديل أي صف آخر بالخطأ.

UPDATE orders
SET restaurant_id = '71620805-cc20-4e3a-abfc-0ca0f0bcacff'
WHERE id IN (
  '948efe18-18ac-4895-9d85-c43bc03f27d6',
  '1a675d80-7428-42cf-9a15-9636bcc08972',
  '21b313cf-9bd4-48fc-ae98-e62c18c9e74f',
  'f47d54aa-e523-4cdd-bad6-40a430332c28'
)
AND restaurant_id IS NULL;

-- تحقق بعد التنفيذ: يجب أن يرجع 0
SELECT count(*) FROM orders WHERE restaurant_id IS NULL;
