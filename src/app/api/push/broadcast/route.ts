import webpush from 'web-push';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';

// POST /api/push/broadcast — يرسل إشعار لكل سائقي مطعم معيّن (طلب جديد).
// كان محمياً سابقاً بسر ثابت (x-api-secret) يُرسَل عبر NEXT_PUBLIC_API_SECRET —
// أي متغيّر NEXT_PUBLIC_ يُضمَّن حرفياً بحزمة JS العامة، فكان أي زائر يقدر
// يستخرجه ويبث إشعارات لسائقي أي مطعم (ثغرة حرجة #1 بالمراجعة الأمنية).
// الآن الهوية تُستخرَج من جلسة الموظف/المالك الحقيقية، ومقيّدة بمطعمه فقط.
export async function POST(request: NextRequest) {
  const supabase = supabaseAdmin;

  const { title, body, url, tag, restaurant_id } = await request.json();
  if (!restaurant_id) {
    return Response.json({ error: 'restaurant_id مطلوب' }, { status: 400 });
  }

  const identityRes = await resolveStaffIdentity(request, restaurant_id);
  if (!identityRes.ok) return Response.json({ error: identityRes.error }, { status: identityRes.status });

  // بدون هذا التحقق، غياب أي متغير من الثلاثة يُسقط webpush.setVapidDetails
  // بخطأ throw فوري ينهار به المسار بالكامل بخطأ 500 غير معالج (خطأ #19 بتقرير الفحص).
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json({ ok: true, sent: 0, warning: 'VAPID env vars missing' });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, push_subscription')
    .eq('restaurant_id', restaurant_id)
    .not('push_subscription', 'is', null);

  if (!drivers?.length) return Response.json({ ok: true, sent: 0 });

  await Promise.allSettled(
    drivers.map(async (driver) => {
      if (!driver.push_subscription) return;
      try {
        await webpush.sendNotification(
          driver.push_subscription,
          JSON.stringify({ title, body, url: url || '/drivers/dashboard', tag: tag || 'new-order' })
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('drivers').update({ push_subscription: null }).eq('id', driver.id);
        } else {
          console.error('[push/broadcast] sendNotification failed for driver', driver.id, err);
        }
      }
    })
  );

  return Response.json({ ok: true, sent: drivers.length });
}
