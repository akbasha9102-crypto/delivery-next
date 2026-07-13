-- فهارس أداء لاستعلام "الأكثر مبيعاً" بمنيو الزبون (src/app/menu/[slug]/page.tsx):
-- بدون هذه الفهارس، استعلام order_items بـ .in('order_id', <حتى 1000 قيمة>) يفرض
-- مسحاً كاملاً (seq scan) لجدول order_items المشترك بين كل المطاعم على المنصة،
-- واستعلام orders بـ restaurant_id + status + created_at معاً لا يستفيد من الفهرس
-- المفرد الحالي idx_orders_restaurant.

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
  ON orders(restaurant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id) WHERE item_id IS NOT NULL;
