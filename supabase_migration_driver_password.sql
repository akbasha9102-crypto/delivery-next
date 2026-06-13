-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- يضيف عمود password لجدول drivers

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS password TEXT;
