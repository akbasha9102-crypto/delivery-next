import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// تحديد معدّل عام (rate limiting) لنقاط تسجيل الدخول — راجع migration
// 20260730130000_login_rate_limits.sql. مصمَّم كدالتين منفصلتين (فحص ثم
// تسجيل) بدل دالة واحدة مدمجة، لأن بعض الـ routes تحتاج تسجيل المحاولة
// فقط عند فشلها الفعلي (مثلاً super-admin/auth) وليس عند كل طلب.

/** يستخرج IP العميل من رؤوس الطلب — يعتمد على Vercel/الوسيط لإضافتها بصدق. */
export function getClientIp(req: Request | NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

/**
 * يتحقق هل تجاوز scope+key عدد المحاولات المسموح خلال النافذة الزمنية.
 * فشل مفتوح (Fail-open): لو استعلام العدّ فشل (مثلاً
 * الجدول غير موجود بعد لأن المستخدم لم يُطبّق الـ migration يدوياً بعد)،
 * نرجع false (غير محظور) بدل حجب كل تسجيلات الدخول الشرعية بسبب عطل
 * بجدول مساعد ثانوي — هذا الجدول أداة حماية إضافية، وليس مصدر الحقيقة
 * لصحة بيانات الدخول نفسها.
 */
export async function isRateLimited(
  scope: string,
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabaseAdmin
    .from('login_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('scope', scope)
    .eq('rate_key', key)
    .gte('attempted_at', since);

  if (error) {
    console.error('[rate-limit] count query failed, failing open:', error.message, { scope });
    return false;
  }

  return (count ?? 0) >= limit;
}

/** يسجّل محاولة واحدة. Best-effort: فشل الكتابة لا يوقف تدفق تسجيل الدخول. */
export async function recordAttempt(scope: string, key: string): Promise<void> {
  const { error } = await supabaseAdmin.from('login_rate_limits').insert({ scope, rate_key: key });
  if (error) {
    console.error('[rate-limit] failed to record attempt:', error.message, { scope });
  }

  // تقليم دوري رخيص بدون cron job منفصل: باحتمال 1% فقط بكل استدعاء، نحذف
  // الصفوف الأقدم من 24 ساعة (نافذة أطول من أي حد مستخدَم حالياً بالتطبيق)
  // fire-and-forget حتى لا يبطّئ استجابة تسجيل الدخول نفسها.
  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabaseAdmin
      .from('login_rate_limits')
      .delete()
      .lt('attempted_at', cutoff)
      .then(({ error: pruneError }) => {
        if (pruneError) console.error('[rate-limit] prune failed:', pruneError.message);
      });
  }
}
