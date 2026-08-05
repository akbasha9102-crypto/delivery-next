-- ============================================================
-- تفعيل Realtime على restaurant_settings — تعليق اشتراك المطعم من
-- super-admin لا ينعكس فوراً على داشبورد الموظفين ولا منيو العملاء
-- المفتوحين مسبقاً (يحتاجان F5 يدوي رغم أن AdminGuard/CustomerGuard/
-- SettingsContext جاهزون بالكامل لاستقبال التحديث الحي — نفس مشكلة
-- categories/items التي أُصلحت بـ 20260724090000_reassert_rbac_and_
-- menu_realtime.sql). الجدول restaurant_settings غير مُضاف إطلاقاً
-- لـ publication supabase_realtime بأي migration سابق بكامل المستودع.
--
-- لا حاجة لـ REPLICA IDENTITY FULL: الكود الأمامي (SettingsContext,
-- AdminGuard, CustomerGuard) يستهلك فقط new (الصف الكامل الجديد بعد
-- التحديث)، ولا يستخدم old إطلاقاً — REPLICA IDENTITY DEFAULT (PK
-- فقط) كافٍ، ونفس القرار المُتخذ سابقاً لـ categories/items.
--
-- لا حاجة لأي سياسة RLS جديدة: restaurant_settings_select_public
-- (من 20260718000000) هي USING (true) بلا أي قيد دور — anon
-- وauthenticated يملكان SELECT كامل على الصف بالفعل، والجدول لا
-- يحوي أي عمود حساس (بيانات صاحب المطعم الحساسة منقولة عمداً لجدول
-- منفصل restaurant_owner_contacts بلا أي سياسة RLS عامة — راجع
-- 20260721100000). Realtime لـ postgres_changes يطبّق نفس RLS
-- الخاصة بجلسة كل عميل، فهذه السياسة الموجودة كافية تماماً.
--
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل
-- migrations هذا المشروع — لا يُطبَّق تلقائياً، ولا يوجد CLI مربوط).
-- كل الأوامر آمنة لإعادة التشغيل (idempotent).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_settings;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
