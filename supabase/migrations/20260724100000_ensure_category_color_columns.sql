-- ============================================================
-- تأكيد وجود أعمدة ألوان القسم على categories فعلياً
-- ============================================================
-- الخطأ الذي ظهر عند الحفظ من الداشبورد:
--   "Could not find the 'card_color_dark' column of 'categories' in the
--   schema cache"
-- هذا خطأ PostgREST القياسي عندما يكون العمود غير موجود أصلاً بالجدول —
-- وليس مشكلة كاش فقط. الملفين المفترض أنهما أضافا هذه الأعمدة
-- (20260609165143_category_card_color.sql و
-- 20260611114705_category_dark_colors.sql) من الواضح أنهما لم يُطبَّقا
-- فعلاً على قاعدة الإنتاج الحيّة (migrations هذا المشروع تُطبَّق يدوياً
-- فقط، بلا أي تتبّع لما نُفِّذ).
--
-- كل أمر هنا IF NOT EXISTS — آمن للتشغيل حتى لو كان بعض الأعمدة موجوداً
-- فعلاً (مثل color الأساسي الذي غالباً أُنشئ يدوياً مع الجدول نفسه).
-- ============================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS color text DEFAULT NULL;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS card_color text DEFAULT NULL;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS color_dark text DEFAULT NULL;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS card_color_dark text DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
