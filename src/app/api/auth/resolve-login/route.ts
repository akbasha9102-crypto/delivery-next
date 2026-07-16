import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { staffCodeToEmail } from '@/lib/auth/staff-auth';

// POST /api/auth/resolve-login — { identifier } → { email }
// نقطة دخول موحّدة لصفحة /login: تقبل slug المطعم (مالك) أو code الموظف
// (كاشير/مدير) وتُرجع الإيميل الداخلي الصناعي المطابق، دون كشف أيهما كان
// (نفس منطق src/app/api/driver/resolve-login/route.ts — لا نمرّر كلمة
// المرور هنا إطلاقاً، Supabase Auth نفسه يتحقق منها لاحقاً عبر
// signInWithPassword على العميل).
export async function POST(req: NextRequest) {
  let body: { identifier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const raw = body.identifier?.trim() ?? '';
  if (!raw) return NextResponse.json({ error: 'اسم المستخدم مطلوب' }, { status: 400 });

  const local = raw.split('@')[0].trim().toLowerCase();
  if (!local) return NextResponse.json({ error: 'اسم المستخدم مطلوب' }, { status: 400 });

  // ملاحظة: البحث المتسلسل (مطعم ثم موظف) يترك فارقاً زمنياً نظرياً بين
  // الحالتين (timing signal) — مقبول كقصور معروف مسبق (نفس فئة القيود
  // الموجودة بباقي الكودبيس)، وليس شيئاً نصلحه هنا.
  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('slug')
    .eq('slug', local)
    .maybeSingle();

  if (restaurant) {
    return NextResponse.json({ email: `${local}@dasha.app` });
  }

  const { data: staff } = await supabaseAdmin
    .from('user_roles')
    .select('code')
    .ilike('code', local)
    .maybeSingle();

  if (staff) {
    return NextResponse.json({ email: staffCodeToEmail(staff.code) });
  }

  return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 });
}
