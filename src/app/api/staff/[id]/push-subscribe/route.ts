import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// POST /api/staff/:id/push-subscribe — تسجيل اشتراك Push لجهاز موظف
// (owner/manager عادة) لاستلام تنبيهات الموافقة الفورية وفروقات الكاش.
// نقطة إضافية غير مذكورة صراحة بالعقد المتفَق عليه مع الفرونت إند — تكرر
// نفس نمط src/app/api/push/subscribe/route.ts (الخاص بالسائقين) بالضبط،
// لكن على restaurant_staff بدل drivers. اختيارية: بدون استدعائها، تظل كل
// الـ endpoints الأخرى تعمل، فقط بدون إشعارات push فعلية للمالك.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

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
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
