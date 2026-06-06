-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- يضيف عمود sort_order لترتيب الأقسام في المنيو

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT NULL;
