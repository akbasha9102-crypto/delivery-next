// طلبات الكاشير المحلي (admin/local) ومودال "طلب سريع" بالداشبورد (admin/dashboard)
// يضبطان client_phone على '0000000000' ثابتاً دائماً (لا يوجد حقل هاتف بهذين
// النموذجين) — هذا يجعله مؤشراً موثوقاً 100% لـ"طلب داخلي/محلي"، ويغطي حتى
// الطلبات القديمة المؤرشفة (بعكس created_by_staff المضاف حديثاً بدون تطبيق رجعي).
const DEFAULT_LOCAL_NAMES = new Set(['زبون بدون جوال', 'زبون كاشير']);

export function localOrderDisplay(order: { client_name: string; client_phone: string }) {
  const isInternalOrder = order.client_phone === '0000000000';
  if (!isInternalOrder) return null;
  const hasRealName = !DEFAULT_LOCAL_NAMES.has(order.client_name);
  return { name: hasRealName ? order.client_name : 'طلب محلي', showLocalTag: hasRealName };
}
