-- سجل تدقيق تلقائي: "مين سوى شنو ومتى" لتعديلات الأسعار، حذف المواد/الأقسام،
-- وتغيير الإعدادات. يعالج نقطة النواقص: هذه العمليات كانت تتم عبر كتابة
-- مباشرة من المتصفح لجداول items/categories/restaurant_settings بدون أي
-- تسجيل — بعكس عمليات الكاشير (إلغاء/استرجاع/خصم/هدر) اللي أصلاً تُسجَّل
-- بجدول staff_actions_log عبر API routes.
--
-- الحل: triggers على مستوى القاعدة (لا تعتمد على كود العميل، تشتغل حتى لو
-- عدّل أحد لاحقاً صفحة المنيو/الإعدادات ونسي يضيف تسجيل يدوي).
--
-- شغّل هذا الكود في Supabase SQL Editor (بعد supabase_migration_rbac_staff.sql).

-- ─────────────────────────────────────────────────────────────
-- 1. عمود جديد على staff_actions_log: مين سوى العملية خارج نطاق
--    staff_id (المخصص لأفعال الكاشير الحساسة عبر API فقط)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE staff_actions_log
  ADD COLUMN IF NOT EXISTS performed_by_auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS performed_by_label   TEXT;

-- ─────────────────────────────────────────────────────────────
-- 2. دالة مساعدة: تحدد اسم مين سوى العملية الحالية (auth.uid())
--    بالنسبة لمطعم معيّن — "المالك" أو اسم الكاشير من restaurant_staff
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_actor_label(p_restaurant_id UUID)
RETURNS TEXT AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND owner_id = auth.uid())
      THEN 'المالك'
    ELSE (
      SELECT display_name FROM restaurant_staff
      WHERE restaurant_id = p_restaurant_id AND auth_user_id = auth.uid()
      LIMIT 1
    )
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- 3. تعديل/حذف مادة بالمنيو (items) — تسجيل تعديل السعر والحذف
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO staff_actions_log
      (restaurant_id, action_type, entity_type, entity_id, before_data, after_data, performed_by_auth_id, performed_by_label)
    VALUES
      (OLD.restaurant_id, 'item_deleted', 'item', OLD.id,
       jsonb_build_object('name', OLD.name, 'price', OLD.price, 'category_id', OLD.category_id),
       NULL, auth.uid(), resolve_actor_label(OLD.restaurant_id));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO staff_actions_log
      (restaurant_id, action_type, entity_type, entity_id, before_data, after_data, performed_by_auth_id, performed_by_label)
    VALUES
      (NEW.restaurant_id, 'price_edit', 'item', NEW.id,
       jsonb_build_object('name', OLD.name, 'price', OLD.price),
       jsonb_build_object('name', NEW.name, 'price', NEW.price),
       auth.uid(), resolve_actor_label(NEW.restaurant_id));
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_item_change ON items;
CREATE TRIGGER trg_log_item_change
AFTER UPDATE OR DELETE ON items
FOR EACH ROW EXECUTE FUNCTION log_item_change();

-- ─────────────────────────────────────────────────────────────
-- 4. حذف قسم بالمنيو (categories)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_category_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO staff_actions_log
    (restaurant_id, action_type, entity_type, entity_id, before_data, after_data, performed_by_auth_id, performed_by_label)
  VALUES
    (OLD.restaurant_id, 'category_deleted', 'category', OLD.id,
     jsonb_build_object('name', OLD.name), NULL,
     auth.uid(), resolve_actor_label(OLD.restaurant_id));
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_category_delete ON categories;
CREATE TRIGGER trg_log_category_delete
AFTER DELETE ON categories
FOR EACH ROW EXECUTE FUNCTION log_category_delete();

-- ─────────────────────────────────────────────────────────────
-- 5. تغيير الإعدادات (restaurant_settings) — نسجّل كل الحقول قبل/بعد
--    (باستثناء id/restaurant_id) حتى تغطي أي إعداد جديد يُضاف مستقبلاً
--    (رسوم توصيل، حد أدنى للطلب، دوام، ألوان...) بدون تعديل هذا الـ trigger.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_settings_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD IS DISTINCT FROM NEW THEN
    INSERT INTO staff_actions_log
      (restaurant_id, action_type, entity_type, entity_id, before_data, after_data, performed_by_auth_id, performed_by_label)
    VALUES
      (NEW.restaurant_id, 'settings_changed', 'restaurant_settings', NEW.id,
       (to_jsonb(OLD) - 'id' - 'restaurant_id'),
       (to_jsonb(NEW) - 'id' - 'restaurant_id'),
       auth.uid(), resolve_actor_label(NEW.restaurant_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_settings_change ON restaurant_settings;
CREATE TRIGGER trg_log_settings_change
AFTER UPDATE ON restaurant_settings
FOR EACH ROW EXECUTE FUNCTION log_settings_change();
