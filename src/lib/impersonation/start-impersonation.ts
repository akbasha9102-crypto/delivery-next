import { supabase } from '@/lib/supabase/client';

// يستدعي /api/super-admin/impersonate، يضبط جلسة Supabase الحقيقية بالمتصفح
// عبر setSession (بدون أي كلمة سر)، ثم يعيد التوجيه لداشبورد المطعم بنفس
// التبويب. ملاحظة: envelope الأخطاء الفعلي بهذا المشروع مسطّح { error: string }
// (وليس { error: { message } } متداخلاً) — راجع src/app/api/super-admin/restaurants/route.ts.
export async function startImpersonation(restaurantId: string, restaurantName: string): Promise<void> {
  const res = await fetch('/api/super-admin/impersonate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'فشل الدخول كصاحب المطعم');

  const { access_token, refresh_token } = json.session;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;

  sessionStorage.setItem('impersonation_active', JSON.stringify({ restaurantId, restaurantName, startedAt: Date.now(), logId: json.logId ?? null }));
  window.location.assign('/admin/dashboard'); // نفس التبويب، ليس تبويباً جديداً
}
