import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';

// POST /api/staff/:id/push-subscribe — تسجيل اشتراك Push لجهاز موظف
// (owner/manager) لاستلام تنبيهات الموافقة الفورية وفروقات الكاش.
// :id لم يعد يُستخدَم لتحديد الهدف (الهوية تُشتق من الجلسة الموثَّقة فقط —
// لا يمكن تسجيل اشتراك لأي هوية غير هوية المتصل نفسه). يُبقى بالمسار
// فقط توافقاً مع الشكل الحالي للاستدعاء.
export async function POST(req: NextRequest) {
  let body: { subscription?: unknown; restaurant_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  if (!body.subscription) return NextResponse.json({ error: 'subscription مطلوب' }, { status: 400 });
  if (!body.restaurant_id) return NextResponse.json({ error: 'restaurant_id مطلوب' }, { status: 400 });

  const identityRes = await resolveStaffIdentity(req, body.restaurant_id);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const requester = identityRes.identity;

  // user_roles أولاً (النموذج الجديد — manager/cashier/driver)
  if (requester.staff_id) {
    const { error } = await supabaseAdmin
      .from('user_roles')
      .update({ push_subscription: body.subscription })
      .eq('id', requester.staff_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // مالك (أو موظف قديم لم يُنقَل بعد) — restaurant_staff عبر auth_user_id
  const { error } = await supabaseAdmin
    .from('restaurant_staff')
    .update({ push_subscription: body.subscription })
    .eq('restaurant_id', requester.restaurant_id)
    .eq('auth_user_id', requester.user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
