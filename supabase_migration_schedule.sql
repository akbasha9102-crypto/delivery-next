-- إضافة عمود الجدولة الأسبوعية لإعدادات المطعم
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT NULL;
