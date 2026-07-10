-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- يضيف عمود card_color للون خلفية كارتات كل قسم

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS card_color text DEFAULT NULL;
