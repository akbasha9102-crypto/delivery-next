-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- يضيف عمودَي color_dark و card_color_dark لألوان الوضع الليلي لكل قسم

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS color_dark text DEFAULT NULL;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS card_color_dark text DEFAULT NULL;
