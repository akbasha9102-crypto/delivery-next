-- ============================================================
-- apply_order_edit — تطبيق تعديل طلب بشكل ذرّي (atomic) لسدّ ثغرة
-- عرقية (race condition) بشاشة المطبخ (/admin/kitchen):
--
-- المشكلة: صفحة الداشبورد كانت تُحدّث orders.last_edit_id (الذي يُطلق
-- حدث Supabase Realtime تستمع له شاشة المطبخ) ثم — كنداءين شبكيين
-- منفصلين لاحقين — تحذف وتُدرج صفوف order_items الجديدة. شاشة المطبخ
-- تُعيد الجلب فوراً عند استقبال حدث UPDATE هذا بلا أي تأخير أو إعادة
-- محاولة، فقد تقرأ الطلب قبل أن تُستبدل عناصره فعلاً — وبما أنها لا
-- تشترك بأي تنبيه على order_items نفسها، لا شيء يجبرها على إعادة جلب
-- لاحقة، فتبقى الشاشة عالقة على بيانات قديمة.
--
-- الحل: تنفيذ فحص الحراسة + استبدال العناصر + تحديث last_edit_id كلها
-- داخل معاملة واحدة ذرّية (دالة Postgres واحدة). بما أن Supabase
-- Realtime لا يُخطر العملاء إلا بعد commit المعاملة كاملة، فبحلول لحظة
-- استقبال أي عميل لحدث تغيّر last_edit_id تكون order_items قد استُبدلت
-- فعلاً ومُلتزمة بالكامل — بلا حاجة لأي تأخير أو إعادة محاولة على
-- جانب العميل.
--
-- ملاحظة حرجة: حراسة kitchen_ready_at IS NULL يجب أن تبقى قبل أي لمس
-- لـ order_items (الحذف/الإدراج) — هي ما يمنع إعادة كتابة عناصر طلب
-- أنهى المطبخ تجهيزه بالفعل من تحته بصمت.
--
-- SECURITY INVOKER (صراحة): تبقى كل سياسات RLS الحالية على orders
-- وorder_items وorder_edits سارية بالكامل — نفس صلاحيات الكاشير/المالك
-- المطبّقة أصلاً، لا حاجة لأي تعديل RLS جديد.
--
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor — لا يوجد تطبيق تلقائي
-- للـ migrations بهذا المشروع. آمن لإعادة التشغيل.
-- ============================================================

CREATE OR REPLACE FUNCTION apply_order_edit(
  p_order_id       UUID,
  p_edit_id        UUID,
  p_new_items      JSONB,
  p_new_total      NUMERIC,
  p_client_name    TEXT DEFAULT NULL,
  p_mark_accepted  BOOLEAN DEFAULT FALSE,
  p_accepted_by    UUID DEFAULT NULL,
  p_check_discount BOOLEAN DEFAULT FALSE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_discount_amount NUMERIC;
  v_rows_affected   INT;
BEGIN
  IF p_check_discount THEN
    SELECT discount_amount INTO v_discount_amount
    FROM orders WHERE id = p_order_id;

    IF v_discount_amount IS NOT NULL AND v_discount_amount > 0 THEN
      RAISE EXCEPTION 'لا يمكن قبول هذا التعديل — تم تطبيق خصم على الطلب، راجع الطلب يدوياً';
    END IF;
  END IF;

  -- حراسة عرقية (race guard) أولاً — قبل أي لمس لـ order_items. إن كان
  -- المطبخ قد أنهى تجهيز الطلب (kitchen_ready_at غير NULL)، يجب ألا
  -- يُطبَّق شيء إطلاقاً.
  UPDATE orders
  SET total_amount   = p_new_total,
      last_edit_id   = p_edit_id,
      pending_edit_id = NULL,
      client_name    = COALESCE(p_client_name, client_name)
  WHERE id = p_order_id
    AND kitchen_ready_at IS NULL;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'تم تجهيز الطلب بالفعل — لا يمكن تعديله الآن';
  END IF;

  DELETE FROM order_items WHERE order_id = p_order_id;

  INSERT INTO order_items (order_id, item_id, item_name, quantity, price)
  SELECT p_order_id,
         NULLIF(i->>'item_id', ''),
         i->>'item_name',
         i->>'quantity',
         i->>'price'
  FROM jsonb_array_elements(p_new_items) AS i;

  IF p_mark_accepted THEN
    UPDATE order_edits
    SET status      = 'accepted',
        accepted_at = now(),
        accepted_by = p_accepted_by
    WHERE id = p_edit_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION apply_order_edit(UUID, UUID, JSONB, NUMERIC, TEXT, BOOLEAN, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_order_edit(UUID, UUID, JSONB, NUMERIC, TEXT, BOOLEAN, UUID, BOOLEAN) TO authenticated;
