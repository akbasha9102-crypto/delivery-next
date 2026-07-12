-- حماية على مستوى قاعدة البيانات: يمنع تخزين نسبة خصم خارج المدى المنطقي
-- حتى لو تم تجاوز التحقق الموجود بالواجهة (React) مباشرة عبر الـ API.

ALTER TABLE categories
  ADD CONSTRAINT categories_discount_pct_range CHECK (discount_pct BETWEEN 0 AND 100);

ALTER TABLE items
  ADD CONSTRAINT items_discount_pct_range CHECK (discount_pct BETWEEN 0 AND 100);
