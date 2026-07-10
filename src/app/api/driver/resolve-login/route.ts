import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

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

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id')
    .eq('phone', phone)
    .maybeSingle();

  if (!driver?.user_id) {
    return NextResponse.json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' }, { status: 401 });
  }

  return NextResponse.json({ email: `driver-${driver.id}@driver.dasha.app` });
}
