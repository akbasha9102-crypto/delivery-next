-- ============================================================
-- تفعيل Realtime على جدول رسائل السوبر أدمن — نُسيت هذه الخطوة
-- عند إنشاء الجدول بملف 20260722090000_super_admin_notifications.sql،
-- فكانت الرسائل تصل داشبورد المطعم فقط بعد رفريش يدوي بدل وصولها Live.
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor — لا يُطبَّق تلقائياً.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'super_admin_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE super_admin_notifications;
  END IF;
END $$;
