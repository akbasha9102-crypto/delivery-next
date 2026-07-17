// دالة مشتركة لحساب "هل المطعم مفتوح فعلياً الآن؟" — تُستخدم بصفحة الزبون (HomeClient) ولوحة تحكم المطعم (إعدادات الجدولة)
// لا تكتب لقاعدة البيانات إطلاقاً — دالة نقية بحتة بدون أي آثار جانبية.
import type { WeekSchedule } from '@/context/SettingsContext';

/**
 * يحسب حالة الفتح/الإغلاق الفعلية للمطعم الآن.
 * الإغلاق اليدوي (isManuallyClosed) له أولوية قصوى: لو المدير أغلق يدوياً يبقى مغلق
 * بغض النظر عن الجدولة، إلى أن يفتحه يدوياً مرة أخرى.
 */
export function isRestaurantOpenNow(
  schedule: WeekSchedule | null | undefined,
  isManuallyClosed: boolean,
  now: Date = new Date()
): boolean {
  if (isManuallyClosed) return false;
  if (!schedule?.auto) return true;

  const dayKey = String(now.getDay());
  const day = schedule.days?.[dayKey];
  if (!day?.enabled) return false;

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const [oh = 0, om = 0]   = (day.open  || '00:00').split(':').map(Number);
  const [ch = 23, cm = 59] = (day.close || '23:59').split(':').map(Number);
  const openMins  = oh * 60 + om;
  const closeMins = ch * 60 + cm;

  // دوام يعبر منتصف الليل (مثلاً 18:00 → 02:00)
  return closeMins > openMins
    ? (nowMins >= openMins && nowMins < closeMins)
    : (nowMins >= openMins || nowMins < closeMins);
}
