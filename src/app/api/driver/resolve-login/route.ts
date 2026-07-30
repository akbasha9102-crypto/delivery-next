import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getClientIp, isRateLimited, recordAttempt } from '@/lib/utils/rate-limit';

// POST /api/driver/resolve-login — { phone } → { email }
// بعد إغلاق RLS على drivers، العميل (anon) ما عاد يقدر يستعلم عن السائق
// مباشرة من المتصفح (كان هذا هو استعلام تسجيل الدخول القديم غير الآمن —
// password نص صريح مقارَن بالمتصفح). الآن: نبحث عن السائق بالهاتف عبر
// service role فقط لنرجع بريده الصناعي driver-<id>@driver.dasha.app،
// والعميل بعدها يسجّل دخوله فعلياً عبر supabase.auth.signInWithPassword
// (Supabase Auth نفسه يتحقق كلمة المرور، وليس هذا الـ route).
export async function POST(req: NextRequest) {
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const phone = body.phone?.trim();
  if (!phone) return NextResponse.json({ error: 'رقم الهاتف مطلوب' }, { status: 400 });

  // حد المحاولات قبل أي استعلام — نفس منطق /api/auth/resolve-login (راجع
  // تعليقه لتفاصيل عدم تسجيل محاولة إضافية على طلب محظور أصلاً).
  const ip = getClientIp(req);
  if (await isRateLimited('driver_resolve_login', ip, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'محاولات كثيرة جداً، حاول لاحقاً' }, { status: 429 });
  }
  await recordAttempt('driver_resolve_login', ip);

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id')
    .eq('phone', phone)
    .maybeSingle();

  if (!driver?.user_id) {
    // إغلاق ثغرة تعداد الحسابات: نفس شكل الاستجابة الناجحة تماماً بإيميل
    // صناعي لن يطابق أي سائق حقيقي أبداً — راجع تعليق /api/auth/resolve-login
    // لتفصيل السبب (Supabase Auth يرفض signInWithPassword برسالة عامة موحّدة).
    return NextResponse.json({ email: `driver-fake-${randomBytes(6).toString('hex')}@driver.dasha.app` });
  }

  return NextResponse.json({ email: `driver-${driver.id}@driver.dasha.app` });
}
