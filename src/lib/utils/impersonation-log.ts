// مساعد كتابة impersonation_log — مرآة أسلوبية لـ staff-actions-log.ts، لكن
// لجدول مستقل تماماً (راجع migration 20260728130000_impersonation_log.sql):
// سوبر أدمن ليس مستخدم Auth حقيقي وليس مرتبطاً بمطعم واحد، فحدث أمني كهذا
// (تسجيل دخول بدون كلمة سر بصلاحيات مالك كامل) يحتاج سجل تدقيق مستقل واضح
// بدل تحميل staff_actions_log بدلالات لا تناسبه.
import { supabaseAdmin } from '@/lib/supabase/admin';

export type LogImpersonationParams = {
  restaurantId: string;
  restaurantName: string;
  targetOwnerId: string;
  targetOwnerEmail: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  accessTokenExpiresAt?: string;
};

/**
 * يسجّل حدث انتحال هوية بعد نجاح إصدار الجلسة فعلياً. "best effort":
 * فشل الكتابة لا يوقف إصدار الجلسة (وصول السوبر أدمن أهم من فشل تسجيل
 * الحدث)، لكن الخطأ يُطبع بالـ log للمراجعة.
 *
 * ملاحظة أمنية: لا يُخزَّن access_token/refresh_token هنا إطلاقاً — فقط
 * وقت انتهاء صلاحية الـ access token (accessTokenExpiresAt) للمرجعية.
 */
export async function logImpersonation(params: LogImpersonationParams): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('impersonation_log').insert({
    restaurant_id: params.restaurantId,
    restaurant_name: params.restaurantName,
    target_owner_id: params.targetOwnerId,
    target_owner_email: params.targetOwnerEmail,
    performed_by_label: 'super_admin',
    reason: params.reason ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    access_token_expires_at: params.accessTokenExpiresAt ?? null,
  }).select('id').single();

  if (error) {
    console.error('[impersonation_log] failed to write audit entry:', error.message, {
      restaurant_id: params.restaurantId,
      target_owner_id: params.targetOwnerId,
    });
    return null;
  }

  return data?.id ?? null;
}
