-- قسم "الأكثر مبيعاً" في منيو الزبون: يعرض دائماً أفضل 3 وجبات مبيعاً في الأعلى.
-- المالك/الكاشير يتحكم بإظهاره من صفحة المنيو بالداشبورد عبر سويتش.

ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS show_best_sellers BOOLEAN NOT NULL DEFAULT true;
