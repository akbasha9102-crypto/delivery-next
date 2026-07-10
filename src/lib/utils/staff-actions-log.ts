// مساعد موحّد لكتابة staff_actions_log — بدل تكرار نفس كود الـ insert
// بكل route حساس (void/refund/discount/shifts/approvals...).
import { supabaseAdmin } from '@/lib/supabase/admin';

export type LogStaffActionParams = {
  restaurant_id: string;
  performed_by_auth_id?: string | null;  // auth.uid() لمن نفّذ العملية (owner/manager/cashier)
  performed_by_label?: string | null;    // اسم معروض جاهز (مثلاً identity.display_name) — يمنع ظهور "غير معروف" بسجل التدقيق
  action_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  before_data?: unknown;
  after_data?: unknown;
};

/**
 * يسجّل عملية حساسة بسجل التدقيق. عمليات هذا الجدول "best effort":
 * فشل الكتابة لا يوقف العملية الأساسية (تنفيذ الـ void/refund/إلخ فعلياً
 * أهم من فشل تسجيل الحدث)، لكن الخطأ يُطبع بالـ log للمراجعة.
 *
 * ملاحظة للفريق: لا يوجد التزام (transaction) حقيقي بين تنفيذ العملية
 * الأساسية وكتابة هذا السجل — إن احتجتم ضماناً ذرّياً كاملاً لاحقاً،
 * الحل الأنظف هو تحويلهما لدالة Postgres واحدة (RPC) بدل استدعاءين
 * متتاليين من الـ API.
 */
export async function logStaffAction(params: LogStaffActionParams): Promise<void> {
  const { error } = await supabaseAdmin.from('staff_actions_log').insert({
    restaurant_id: params.restaurant_id,
    performed_by_auth_id: params.performed_by_auth_id ?? null,
    performed_by_label: params.performed_by_label ?? null,
    action_type: params.action_type,
    entity_type: params.entity_type ?? null,
    entity_id: params.entity_id ?? null,
    before_data: params.before_data ?? null,
    after_data: params.after_data ?? null,
  });

  if (error) {
    console.error('[staff_actions_log] failed to write audit entry:', error.message, {
      action_type: params.action_type,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
    });
  }
}
