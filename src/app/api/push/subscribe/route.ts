import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';

// POST /api/push/subscribe — تسجيل اشتراك Push لجهاز سائق. كان بلا أي تحقق
// هوية إطلاقاً — أي شخص يعرف driver_id (غير سري، يظهر بلوحة الإدارة) كان
// يقدر يختطف قناة إشعارات ذلك السائق (ثغرة #2 بالمراجعة الأمنية). الآن
// driver_id بجسم الطلب يُستخدَم فقط لمعرفة مطعم السائق للتحقق منه — الكتابة
// الفعلية مقيَّدة بصف السائق صاحب الجلسة الموثَّقة نفسه (user_id)، بنفس
// نمط src/app/api/staff/[id]/push-subscribe/route.ts.
export async function POST(request: NextRequest) {
  const supabase = supabaseAdmin;
  const { driver_id, subscription } = await request.json();
  if (!driver_id || !subscription) {
    return Response.json({ error: 'missing fields' }, { status: 400 });
  }

  const { data: driver } = await supabase
    .from('drivers')
    .select('restaurant_id')
    .eq('id', driver_id)
    .maybeSingle();
  if (!driver) return Response.json({ error: 'driver not found' }, { status: 404 });

  const identityRes = await resolveStaffIdentity(request, driver.restaurant_id);
  if (!identityRes.ok) return Response.json({ error: identityRes.error }, { status: identityRes.status });
  const identity = identityRes.identity;
  if (identity.role !== 'driver') {
    return Response.json({ error: 'هذا المسار للسائقين فقط' }, { status: 403 });
  }

  const { error } = await supabase
    .from('drivers')
    .update({ push_subscription: subscription })
    .eq('user_id', identity.user_id)
    .eq('restaurant_id', identity.restaurant_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
