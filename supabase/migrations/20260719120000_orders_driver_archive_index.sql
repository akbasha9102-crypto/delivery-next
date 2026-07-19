-- فهرس لتسريع استعلام أرشيف السائق (orders by driver_id + status + created_at)
CREATE INDEX IF NOT EXISTS idx_orders_driver_status_created
  ON orders(driver_id, status, created_at DESC);
