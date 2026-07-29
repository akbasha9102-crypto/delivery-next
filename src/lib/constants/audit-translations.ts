/**
 * قاموس ترجمة سجل التدقيق (staff_actions_log) لعربي مفهوم لصاحب المطعم.
 * كل قيمة هنا مستخرجة من نقاط الكتابة الفعلية للسجل — راجع عند الإضافة:
 *  - src/lib/utils/staff-actions-log.ts وكل استدعاءات logStaffAction() بـ
 *    src/app/api/{orders,shifts,inventory,approvals}/**
 *  - supabase/migrations/20260707185929_data_audit_log.sql (triggers قاعدة
 *    البيانات لـ item/category/restaurant_settings — لا تمر عبر logStaffAction)
 *
 * عند إضافة action_type أو حقل settings جديد مستقبلاً: أضِفه هنا فقط.
 * أي مفتاح غير موجود يُعرض تلقائياً بصيغة مقروءة (بدل كسر الصفحة أو
 * إظهار snake_case خام) عبر humanizeFallback.
 */

// أنواع الإجراءات المسجَّلة فعلياً بجدول staff_actions_log
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // عمليات كاشير/مالك مباشرة (staff-actions-log.ts عبر API routes)
  order_void: 'إلغاء طلب',
  order_refund: 'استرجاع مبلغ',
  discount_applied: 'تطبيق خصم',
  coupon_applied: 'تطبيق كوبون',
  inventory_waste: 'تسجيل هدر مخزون',
  shift_open: 'فتح وردية',
  shift_close: 'إغلاق وردية',

  // دورة حياة طلبات الموافقة (عندما يتجاوز الكاشير حده المسموح)
  approval_requested: 'طلب موافقة المالك',
  approval_approved: 'موافقة المالك على الطلب',
  approval_rejected: 'رفض المالك للطلب',

  // تُسجَّل تلقائياً بـ trigger على مستوى قاعدة البيانات (data_audit_log.sql)
  price_edit: 'تعديل سعر مادة بالمنيو',
  item_deleted: 'حذف مادة من المنيو',
  category_deleted: 'حذف قسم من المنيو',
  settings_changed: 'تغيير إعدادات المطعم',
};

// أسماء أعمدة restaurant_settings كما تُسجَّل بـ before_data/after_data عند settings_changed
export const AUDIT_FIELD_LABELS: Record<string, string> = {
  restaurant_name: 'اسم المطعم',
  primary_color: 'اللون الأساسي للمنيو',
  logo_url: 'شعار المطعم',
  is_closed: 'حالة الإغلاق المؤقت',
  opens_at: 'موعد إعادة الفتح',
  schedule: 'جدول الدوام الأسبوعي',
  whatsapp_number: 'رقم الواتساب',
  location_url: 'رابط الموقع على الخرائط',
  is_suspended: 'إيقاف الحساب (من إدارة المنصة)',
  subscription_tier: 'باقة الاشتراك (من إدارة المنصة)',
  delivery_fee: 'رسوم التوصيل',
  min_order_amount: 'الحد الأدنى لقيمة الطلب',
  coupon_code: 'كود كوبون الخصم',
  coupon_discount_pct: 'نسبة خصم الكوبون',
  coupon_enabled: 'تفعيل كوبون الخصم',
  coupon_allow_retroactive: 'السماح بتطبيق الكوبون على طلب سابق',
  show_best_sellers: 'عرض قسم الأكثر مبيعاً',
};

// حقول تقنية بحتة (bookkeeping) — تتغيّر مع كل حفظ تقريباً ولا تعني شيئاً
// لصاحب المطعم، تُستبعَد كلياً من قائمة "ماذا تغيّر" (لا تُترجَم، تُخفى).
export const AUDIT_FIELD_IGNORE = new Set<string>(['updated_at', 'created_at']);

// أسماء الكيانات (entity_type) — غير معروضة بالواجهة حالياً، جاهزة لاستخدام مستقبلي
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  order: 'طلب',
  approval_request: 'طلب موافقة',
  cashier_shift: 'وردية كاشير',
  inventory_item: 'مادة مخزون',
  item: 'مادة منيو',
  category: 'قسم منيو',
  restaurant_settings: 'إعدادات المطعم',
};

/** يحوّل مفتاحاً تقنياً غير موجود بالقاموس لصيغة أقرب للقراءة (احتياطي أخير فقط) */
function humanizeFallback(key: string): string {
  return key.replace(/_/g, ' ').trim();
}

export function translateAuditAction(actionType: string): string {
  return AUDIT_ACTION_LABELS[actionType] ?? humanizeFallback(actionType);
}

export function translateAuditField(field: string): string {
  return AUDIT_FIELD_LABELS[field] ?? humanizeFallback(field);
}

export function translateAuditEntity(entityType: string): string {
  return AUDIT_ENTITY_LABELS[entityType] ?? humanizeFallback(entityType);
}
