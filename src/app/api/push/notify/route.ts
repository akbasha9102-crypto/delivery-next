import webpush from 'web-push';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';

// POST /api/push/notify — يرسل إشعار لسائق محدد (طلب جاهز للاستلام). كان
// محمياً بسر ثابت مسرَّب عبر NEXT_PUBLIC_API_SECRET (ثغرة حرجة #1 بالمراجعة
// الأمنية) — الآن يتحقق أن المستدعي فعلاً موظف/مالك بنفس مطعم السائق.
export async function POST(request: NextRequest) {
  const supabase = supabaseAdmin;

  const { driver_id, title, body, url, tag } = await request.json();
  if (!driver_id || !title) {
    return Response.json({ error: 'missing fields' }, { status: 400 });
  }

  const { data: driver } = await supabase
    .from('drivers')
    .select('restaurant_id, push_subscription')
    .eq('id', driver_id)
    .single();

  if (!driver) return Response.json({ error: 'driver not found' }, { status: 404 });

  const identityRes = await resolveStaffIdentity(request, driver.restaurant_id);
  if (!identityRes.ok) return Response.json({ error: identityRes.error }, { status: identityRes.status });

  // بدون هذا التحقق، غياب أي متغير من الثلاثة يُسقط webpush.setVapidDetails
  // بخطأ throw فوري ينهار به المسار بالكامل بخطأ 500 غير معالج — بدل تجاهل
  // الإشعار بهدوء كما هو مطبّق فعلاً بـ notify-owner-push.ts (خطأ #19 بتقرير الفحص).
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json({ ok: true, skipped: true, warning: 'VAPID env vars missing' });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  if (!driver.push_subscription) {
    return Response.json({ error: 'no subscription' }, { status: 404 });
  }

  try {
    await webpush.sendNotification(
      driver.push_subscription,
      JSON.stringify({ title, body, url: url || '/', tag: tag || 'delivery' })
    );
    return Response.json({ ok: true });
  } catch (err: any) {
    // اشتراك منتهي الصلاحية - احذفه
    if (err.statusCode === 410 || err.statusCode === 404) {
      await supabase.from('drivers').update({ push_subscription: null }).eq('id', driver_id);
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}
