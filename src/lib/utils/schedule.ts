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

/**
 * يحسب عدد المللي ثانية حتى أقرب "لحظة تحوّل" قادمة بحالة الفتح/الإغلاق حسب الجدولة التلقائية فقط
 * (لا علاقة له بالإغلاق اليدوي — ذاك لا يتغيّر بمرور الوقت من تلقاء نفسه).
 * تُستخدم لجدولة setTimeout واحد دقيق بدل استطلاع دوري (polling) كل عدة ثوانٍ.
 *
 * يفحص اليوم الحالي وغداً فقط (يكفي لتغطية أي دوام، بما فيه الدوام العابر لمنتصف الليل،
 * لأن isRestaurantOpenNow يقيّم كل تاريخ تقويمي بجدول يومه الخاص فقط دون أي اعتماد على اليوم السابق).
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

  // نفحص تاريخ اليوم وتاريخ الغد (تقويمياً) — لكل منهما جدوله الخاص المستقل
  for (let offset = 0; offset <= 1; offset++) {
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
