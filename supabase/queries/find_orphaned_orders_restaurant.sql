-- محاولة تحديد المطعم الصحيح لكل طلب يتيم (restaurant_id IS NULL)
-- عن طريق إيجاد طلبات أخرى لنفس رقم الهاتف لها restaurant_id صحيح،
-- مرتبة حسب الأقرب زمنياً للطلب اليتيم.

SELECT
  orphan.id            AS orphan_order_id,
  orphan.client_phone,
  orphan.total_amount  AS orphan_amount,
  orphan.created_at    AS orphan_created_at,
  candidate.id          AS candidate_order_id,
  candidate.restaurant_id AS candidate_restaurant_id,
  r.name                AS candidate_restaurant_name,
  candidate.total_amount AS candidate_amount,
  candidate.created_at  AS candidate_created_at,
  ABS(EXTRACT(EPOCH FROM (orphan.created_at - candidate.created_at))) AS seconds_apart
FROM orders orphan
JOIN orders candidate
  ON candidate.client_phone = orphan.client_phone
 AND candidate.restaurant_id IS NOT NULL
LEFT JOIN restaurants r ON r.id = candidate.restaurant_id
WHERE orphan.restaurant_id IS NULL
ORDER BY orphan.id, seconds_apart ASC;
