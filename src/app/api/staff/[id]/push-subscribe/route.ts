import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveStaffIdentity } from '@/lib/staff-auth';

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

  const identityRes = await resolveStaffIdentity(req);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const requester = identityRes.identity;

  if (requester.staff_id !== id) {
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
