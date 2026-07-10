-- ============================================================
-- RBAC v2 — استبدال قراءة الدور من JWT Claims باستعلام مباشر
-- شغّل بعد 20260710126000_rbac_review_fixes.sql
-- ============================================================
-- Custom Access Token Hooks (Supabase Dashboard → Authentication → Hooks)
-- مقفلة على خطة Supabase المجانية — public.custom_access_token_hook
-- (من 20260710120000_rbac_custom_claims.sql) لا يمكن تفعيلها فعلياً، أي
-- auth.jwt() -> 'app_metadata' ->> 'role' يبقى NULL دائماً. هذا كان يعني
-- عملياً أن jwt_role()/jwt_restaurant_id() — وبالتالي is_manager_of/
-- is_cashier_of/is_driver_of وكل سياسة RLS المبنية عليها — تفشل دائماً
-- (ترجع NULL/false)، حتى لصف المالك نفسه في بعض المسارات.
--
-- الحل: نفس أسماء الدوال وتوقيعاتها (كل السياسات/الـ trigger الحالية
-- تشير لها بالاسم، فتُحدَّث تلقائياً دون لمس أي سياسة) لكن الجسم الآن
-- استعلام مباشر (Direct Query) من user_roles عبر auth.uid() — حيّ من
-- القاعدة في كل تقييم سياسة، لا يعتمد على أي hook أو تجديد JWT.
--
-- SECURITY DEFINER ضروري هنا: user_roles نفسه محمي بـ RLS ولا سياسة
-- SELECT فيه لـ authenticated (فقط supabase_auth_admin، للـ hook غير
-- المفعَّل أصلاً) — الدوال تعمل بصلاحية مالكها (postgres) لتقرأ الصف
-- المطلوب فقط، دون فتح قراءة عامة على الجدول. SET search_path يقفل
-- ثغرة search_path hijacking المعروفة لدوال SECURITY DEFINER.
-- ============================================================

CREATE OR REPLACE FUNCTION jwt_role() RETURNS TEXT AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION jwt_restaurant_id() RETURNS UUID AS $$
  SELECT restaurant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- كل واحدة استعلام مباشر واحد (بدل جسر عبر jwt_role()+jwt_restaurant_id()
-- اللي كان يطلب صفّين) مقيَّد بـ p_restaurant_id بالذات، فمستخدم له دور
-- بمطعم آخر لا يمرّ حتى لو كانت الجلسة نفسها صالحة.
CREATE OR REPLACE FUNCTION is_manager_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id
      AND role = 'manager' AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION is_cashier_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id
      AND role = 'cashier' AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION is_driver_of(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id
      AND role = 'driver' AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- is_privileged_of (is_owner_of OR is_manager_of) وكل السياسات المبنية
-- على هذي الدوال (categories/items/orders/drivers/inventory_*/
-- cashier_shifts/approval_requests/staff_actions_log، وتريغر
-- enforce_driver_order_update_columns) تُصلَح تلقائياً بلا أي تعديل إضافي.
