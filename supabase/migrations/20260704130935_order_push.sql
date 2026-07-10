-- ============================================================
-- Order Push — إشعارات تتبع الطلب للزبون
-- تسمح بحفظ اشتراك Web Push للزبون على طلبه، لإرسال إشعارات
-- فورية عند تغيّر حالة الطلب (قيد التجهيز/في الطريق/تم التوصيل).
-- شغّل هذا الكود في Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gbmwrvnmvobvieembxmf/sql/new
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS push_subscription JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT false;
