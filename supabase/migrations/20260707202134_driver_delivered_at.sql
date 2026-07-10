-- يضيف توقيت "وصول الطلب" الفعلي حتى نقدر نحسب متوسط وقت التوصيل لكل
-- سائق (إحصائيات السائقين) — بدونه كل اللي نملكه هو created_at فقط
-- ولا نعرف كم استغرق السائق فعلياً.
--
-- delivered_at تُعبّأ تلقائياً أول ما يتحوّل الطلب لحالة completed
-- (trigger، لا يحتاج أي تعديل بكود الواجهة). الطلبات المكتملة قبل تشغيل
-- هذا الملف تبقى delivered_at فارغة لها (لا يوجد وقت فعلي مسجَّل سابقاً).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_order_delivered_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_order_delivered_at ON orders;
CREATE TRIGGER trg_set_order_delivered_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_order_delivered_at();
