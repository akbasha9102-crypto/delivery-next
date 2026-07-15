-- إجراء وقائي بحت (defensive): يوسّع trigger تعبئة delivered_at ليغطي
-- INSERT مو بس UPDATE. حالياً لا يوجد أي مسار حي يُدرج طلب completed مع
-- driver_id مباشرة عبر INSERT (كل مسارات إكمال التوصيل الحية تمر عبر
-- UPDATE وتعمل بشكل صحيح مع الـ trigger الحالي) — لكن هذا يسدّ ثغرة
-- نظرية حتى لا تتكرر نفس الفجوة التاريخية مستقبلاً إن أُضيف مسار جديد
-- يُدرج طلبات completed مباشرة.

CREATE OR REPLACE FUNCTION set_order_delivered_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' AND NEW.delivered_at IS NULL THEN
      NEW.delivered_at := NOW();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.delivered_at IS NULL THEN
      NEW.delivered_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_order_delivered_at ON orders;
CREATE TRIGGER trg_set_order_delivered_at
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_order_delivered_at();
