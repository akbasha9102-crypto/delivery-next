// مساعد كتابة super_admin_audit_log — مرآة أسلوبية لـ impersonation-log.ts،
// لكن لجدول مستقل تماماً (راجع migration 20260730140000_super_admin_audit_log.sql):
// يغطي إجراءات سوبر أدمن على أي مستخدم Supabase Auth (وليس فقط انتحال هوية
// مالك مطعم محدد)، فلا يناسبه نفس القيود (restaurant_id/target_owner_id
// NOT NULL) بجدول impersonation_log.
import { supabaseAdmin } from '@/lib/supabase/admin';

export type LogSuperAdminActionParams = {
  action: string;
  targetUserId?: string;
  targetRestaurantId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * يسجّل إجراء سوبر أدمن بعد نجاحه فعلياً. "best effort": فشل الكتابة لا
 * يوقف الإجراء نفسه (وصول/عمل سوبر أدمن أهم من فشل تسجيل الحدث)، لكن
 * الخطأ يُطبع بالـ log للمراجعة.
 *
 * ملاحظة أمنية: `details` يجب ألا يحوي قيمة كلمة مرور إطلاقاً، ولو بشكل
 * غير مباشر — سجّل فقط أسماء الحقول التي تغيّرت (Object.keys) والإيميل
 * الجديد إن وُجد، لا كلمة المرور الجديدة أبداً.
 */
export async function logSuperAdminAction(params: LogSuperAdminActionParams): Promise<void> {
  const { error } = await supabaseAdmin.from('super_admin_audit_log').insert({
    action: params.action,
    target_user_id: params.targetUserId ?? null,
    target_restaurant_id: params.targetRestaurantId ?? null,
    performed_by_label: 'super_admin',
    details: params.details ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });

  if (error) {
    console.error('[super_admin_audit_log] failed to write audit entry:', error.message, {
      action: params.action,
      target_user_id: params.targetUserId,
    });
  }
}
