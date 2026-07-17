// دالة مشتركة لحساب "هل المطعم مفتوح فعلياً الآن؟" — تُستخدم بصفحة الزبون (HomeClient) ولوحة تحكم المطعم (إعدادات الجدولة)
// لا تكتب لقاعدة البيانات إطلاقاً — دالة نقية بحتة بدون أي آثار جانبية.
import type { WeekSchedule } from '@/context/SettingsContext';

// أسماء أيام الأسبوع بالعربية — الفهرس يطابق Date.getDay() (0 = الأحد)
export const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** ينسّق وقت "HH:mm" لنص عربي مختصر مثل "9:00 ص" */
export function formatOpenTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/** ينسّق وقت "HH:mm" لنص عربي كامل مثل "9:00 صباحاً" */
export function formatCloseTimeFull(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'مساءً' : 'صباحاً';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

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

/**
 * يحسب عدد المللي ثانية حتى أقرب "لحظة تحوّل" قادمة بحالة الفتح/الإغلاق حسب الجدولة التلقائية فقط
 * (لا علاقة له بالإغلاق اليدوي — ذاك لا يتغيّر بمرور الوقت من تلقاء نفسه).
 * تُستخدم لجدولة setTimeout واحد دقيق بدل استطلاع دوري (polling) كل عدة ثوانٍ.
 *
 * يفحص 7 أيام قدّام (يكفي لتغطية أي دوام، بما فيه الدوام العابر لمنتصف الليل،
 * لأن isRestaurantOpenNow يقيّم كل تاريخ تقويمي بجدول يومه الخاص فقط دون أي اعتماد على اليوم السابق،
 * وكذلك تغطية حالة تعطيل عدة أيام متتالية بالجدولة).
 *
 * يرجع null إذا كانت الجدولة يدوية بالكامل (auto=false) أو إذا لم توجد أي لحظة تحوّل مستقبلية
 * (حالة نادرة جداً، مثلاً كل الأيام معطّلة أو بلا ساعات).
 */
export function getMsUntilNextScheduleTransition(
  schedule: WeekSchedule | null | undefined,
  now: Date = new Date()
): number | null {
  if (!schedule?.auto) return null;

  const candidates: Date[] = [];

  // نفحص 7 أيام قدّام (تقويمياً) — لكل منها جدوله الخاص المستقل، ونرصد لحظتي الفتح والإغلاق كمرشحين
  for (let offset = 0; offset <= 7; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayKey = String(d.getDay());
    const day = schedule.days?.[dayKey];
    if (!day?.enabled) continue;

    const [oh = 0, om = 0]   = (day.open  || '00:00').split(':').map(Number);
    const [ch = 23, cm = 59] = (day.close || '23:59').split(':').map(Number);

    candidates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), oh, om, 0, 0));
    candidates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), ch, cm, 0, 0));
  }

  const futureDiffsMs = candidates
    .map(c => c.getTime() - now.getTime())
    .filter(ms => ms > 0);

  if (futureDiffsMs.length === 0) return null;
  return Math.min(...futureDiffsMs);
}

/**
 * يحسب أقرب لحظة فتح قادمة حسب الجدولة التلقائية فقط (auto=true).
 * يبحث بالوقت الحالي أولاً (إن كان اليوم مفعّلاً ولم يفتح بعد)، ثم بالأيام التالية حتى أسبوع كامل قدّام.
 * يرجع null إذا كانت الجدولة يدوية بالكامل (auto=false) أو معطّلة لكامل الأسبوع.
 */
export function getNextOpenTime(
  schedule: WeekSchedule | null | undefined,
  now: Date = new Date()
): Date | null {
  if (!schedule?.auto) return null;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (let offset = 0; offset <= 7; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayKey = String(d.getDay());
    const day = schedule.days?.[dayKey];
    if (!day?.enabled) continue;
    const [oh = 0, om = 0] = (day.open || '00:00').split(':').map(Number);
    const openMins = oh * 60 + om;
    if (offset === 0 && openMins <= nowMins) continue;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), oh, om, 0, 0);
  }
  return null;
}
