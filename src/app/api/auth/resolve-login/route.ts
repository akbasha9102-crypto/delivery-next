import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { staffCodeToEmail } from '@/lib/auth/staff-auth';
import { getClientIp, isRateLimited, recordAttempt } from '@/lib/utils/rate-limit';

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

  // حد المحاولات قبل أي استعلام — يحمي من تخمين slug/code بقوة غاشمة عبر
  // نفس IP. لا نسجّل محاولة إضافية على الطلب المحظور نفسه (لا داعي لتمديد
  // النافذة أكثر لعميل محظور أصلاً يستمر بالقصف).
  const ip = getClientIp(req);
  if (await isRateLimited('staff_resolve_login', ip, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'محاولات كثيرة جداً، حاول لاحقاً' }, { status: 429 });
  }
  await recordAttempt('staff_resolve_login', ip);

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

  // إغلاق ثغرة تعداد الحسابات (enumeration oracle): لا نرجع 401 هنا —
  // بدل ذلك نرجع 200 بنفس شكل الاستجابة الناجحة تماماً، لكن بإيميل صناعي
  // لن يطابق أي حساب حقيقي أبداً (لاحقة عشوائية لا يمكن تخمينها). العميل
  // يستدعي signInWithPassword بهذا الإيميل فتفشل من Supabase Auth نفسه
  // بنفس رسالة "Invalid login credentials" العامة التي يحصل عليها من كتب
  // اسم مستخدم صحيحاً بكلمة مرور خاطئة — فلا يعود شكل/حالة استجابة هذا
  // الـ route يكشف هل الحساب موجود أصلاً أم لا.
  const fakeLocal = (local.replace(/[^a-z0-9_-]/g, '') || 'user').slice(0, 24);
  return NextResponse.json({ email: `${fakeLocal}-${randomBytes(4).toString('hex')}@dasha.app` });
}
