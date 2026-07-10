import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';

// POST /api/staff/:id/push-subscribe — تسجيل اشتراك Push لجهاز موظف
// (owner/manager عادة) لاستلام تنبيهات الموافقة الفورية وفروقات الكاش.
//
// إصلاح ثغرة أمنية (H4): سابقاً لم يكن هناك أي تحقق هوية — أي طرف يملك
// الجلسة المشتركة يقدر يستبدل اشتراك Push الخاص بالمالك بجهازه هو،
// فيختطف تنبيهات "طلب موافقة" الفورية. الآن: يجب توكن موظف صالح، وأن
// يكون إما صاحب الصف نفسه (id مطابق لتوكنه) أو مالك/مدير مميّز (owner
// بلا staff_id لا يملك صفاً يطابقه — لذلك المالك يسجّل اشتراكه فقط عبر
// إنشاء صف "manager" لنفسه أولاً من شاشة إدارة الموظفين).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // push_subscription لسا على restaurant_staff مؤقتاً (لم تُنقَل لـ user_roles
  // بعد — انظر ملاحظة الترحيل بمهمة حذف restaurant_staff الأخيرة). نجيب
  // restaurant_id/auth_user_id تبع الصف المستهدف أولاً لتمرير resolveStaffIdentity.
  const { data: target } = await supabaseAdmin
    .from('restaurant_staff')
    .select('id, restaurant_id, auth_user_id')
    .eq('id', id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const identityRes = await resolveStaffIdentity(req, target.restaurant_id);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const requester = identityRes.identity;

  if (requester.user_id !== target.auth_user_id) {
    return NextResponse.json({ error: 'لا يمكنك تسجيل اشتراك لموظف آخر' }, { status: 403 });
  }

  let body: { subscription?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  if (!body.subscription) {
    return NextResponse.json({ error: 'subscription مطلوب' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('restaurant_staff')
    .update({ push_subscription: body.subscription })
    .eq('id', id)
    .eq('restaurant_id', requester.restaurant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
