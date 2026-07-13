-- ============================================================
-- إصلاح طارئ: استعادة دوال RBAC الصحيحة بعد تعديل خاطئ
-- ============================================================
-- بعد تطبيق 20260713110000_cashier_owner_parity_rls.sql ظهر خطأ بمحرر
-- SQL، فتم اللجوء لأداة ذكاء اصطناعي خارجية (Gemini) لم تكن مطّلعة على
-- المخطط الفعلي لهذا المشروع، فأعادت تعريف is_privileged_of/is_cashier_of/
-- is_super_admin بمنطق خاطئ تماماً:
--   - is_privileged_of الجديدة كانت تتحقق من role IN ('owner','super_admin')
--     بجدول user_roles — لكن المالك أصلاً غير مخزَّن بهذا الجدول إطلاقاً
--     (يُحدَّد فقط عبر restaurants.owner_id)، و'owner'/'super_admin' ليست
--     من القيم المسموحة أصلاً بقيد role CHECK. النتيجة: الدالة ترجع FALSE
--     دائماً حتى لصاحب المطعم نفسه — أي فقدان كامل لصلاحيات RLS على
--     الطلبات/الأصناف/السائقين/المخزون وغيرها للمالك والمدير معاً.
--   - is_cashier_of الجديدة فقدت شرط is_active = TRUE (حساب كاشير معطَّل
--     يبقى يملك وصولاً).
--   - is_super_admin الجديدة غيّرت الآلية بالكامل من فحص JWT user_metadata
--     إلى فحص جدول user_roles (اللي لا يخزّن سوبر-أدمن أصلاً) — ترجع
--     FALSE دائماً.
--
-- هذا الملف يُعيد تعريف الدوال الأربع بمنطقها الصحيح الأصلي (كما بـ
-- 20260710120000_rbac_custom_claims.sql و20260710127000_rbac_direct_query_rls.sql).
-- شغّل بعده: NOTIFY pgrst, 'reload schema';
-- ============================================================

CREATE OR REPLACE FUNCTION is_owner_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_manager_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id
      AND role = 'manager' AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION is_privileged_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_owner_of(p_restaurant_id) OR is_manager_of(p_restaurant_id);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_cashier_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id
      AND role = 'cashier' AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((auth.jwt() -> 'user_metadata' ->> 'super_admin')::BOOLEAN, FALSE);
$$ LANGUAGE sql SECURITY DEFINER STABLE;
