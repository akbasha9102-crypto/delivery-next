-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- يضيف عمود push_subscription لجدول drivers لحفظ اشتراكات الإشعارات

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS push_subscription JSONB;
