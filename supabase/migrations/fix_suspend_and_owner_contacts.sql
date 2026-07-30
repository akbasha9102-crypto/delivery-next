-- ============================================================
-- 1) جدول ملاحظات صاحب المطعم (اسم/هاتف) — يصلح فشل تعديل بيانات المطعم
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurant_owner_contacts (
  restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  owner_name    TEXT,
  owner_phone   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE restaurant_owner_contacts ENABLE ROW LEVEL SECURITY;
-- عمداً: لا توجد أي سياسة CREATE POLICY هنا — service role فقط يقرأ/يكتب.

DROP TRIGGER IF EXISTS restaurant_owner_contacts_updated_at ON restaurant_owner_contacts;
CREATE TRIGGER restaurant_owner_contacts_updated_at
  BEFORE UPDATE ON restaurant_owner_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2) السماح لمسار service role بتبديل is_suspended — يصلح فشل تعليق الاشتراك
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_non_super_admin_suspend_toggle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     AND NOT is_super_admin()
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'فقط سوبر أدمن يقدر يبدّل حالة تعليق المطعم';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
