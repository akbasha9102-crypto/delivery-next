import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logImpersonation } from '@/lib/utils/impersonation-log';

// نفس نمط isAuthed() المستخدَم فعلياً بـ src/app/api/super-admin/restaurants/route.ts
async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

// ملاحظة عن شكل الأخطاء: restaurants/route.ts (وكذلك approvals/[id]/resolve/route.ts)
// يستخدمان فعلياً envelope مسطّح { error: string } بلا أي حقل "code" على
// الإطلاق بكل الكودباس. لا يوجد أي مكان آخر يعيد { error: { code, message } }.
// بما أن هذا المسار يحتاج فعلياً رموزاً منطقية مميّزة لكل حالة فشل (طُلبت
// صراحة بالتصميم)، وبما أنه لا يوجد نمط "code" سابق لمطابقته، قررتُ إضافة
// حقل "code" بجانب "error" (وليس تحويل "error" لكائن متداخل) — هذا يحافظ
// على "error" كنص مسطّح مطابقاً تماماً للنمط الحقيقي المستخدَم بكل مكان
// آخر، بينما يوفّر الرمز المنطقي المطلوب كحقل إضافي منفصل.
function errRes(code: string, message: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

// POST /api/super-admin/impersonate — { restaurantId, reason? }
// يُصدر جلسة Supabase حقيقية (access_token/refresh_token) لصاحب مطعم معيّن
// بدون كلمة سر، عبر generateLink (magiclink) + verifyOtp عبر service role —
// لا يُرسَل أي بريد فعلي، ولا يُمرَّر أي رابط/توكن وسيط بالمتصفح، فقط
// التوكنات النهائية بجسم JSON مباشرة لهذا الطلب.
//
// مهم: لا يُحظَر الطلب إن كان restaurants.is_suspended = true — الإصدار
// ينجح دوماً؛ الحظر الفعلي (لو المطعم موقوف) يُطبَّق تلقائياً لاحقاً عبر
// resolveStaffIdentity() الموجود أصلاً بـ src/lib/auth/staff-auth.ts (لم
// يُلمَس هنا إطلاقاً).
export async function POST(req: NextRequest) {
  if (!await isAuthed()) return errRes('UNAUTHORIZED', 'Unauthorized', 401);

  let body: { restaurantId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return errRes('INVALID_REQUEST', 'body غير صالح', 400);
  }

  const { restaurantId, reason } = body;
  if (!restaurantId?.trim()) {
    return errRes('INVALID_REQUEST', 'restaurantId مطلوب', 400);
  }

  // ملاحظة: is_suspended غير موجود على restaurants إطلاقاً — هو عمود على
  // restaurant_settings فقط (راجع 20260620025929_super_admin.sql). لا داعي
  // لفحص الحظر هنا أصلاً؛ يُطبَّق تلقائياً لاحقاً عبر resolveStaffIdentity()
  // كما هو موثّق أعلاه — لا تُعِد إضافته هنا.
  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, owner_id')
    .eq('id', restaurantId)
    .maybeSingle();

  if (restaurantError) {
    console.error('[impersonate] restaurants query failed', { restaurantId, error: restaurantError });
    return errRes('RESTAURANT_QUERY_FAILED', 'فشل الاستعلام عن بيانات المطعم', 500);
  }
  if (!restaurant) {
    return errRes('RESTAURANT_NOT_FOUND', 'المطعم غير موجود', 404);
  }
  if (!restaurant.owner_id) {
    return errRes('NO_OWNER_ASSIGNED', 'لا يوجد مالك مرتبط بهذا المطعم', 422);
  }

  const { data: ownerData, error: ownerError } = await supabaseAdmin.auth.admin.getUserById(restaurant.owner_id);
  if (ownerError) {
    if (ownerError.code === 'user_not_found' || ownerError.status === 404) {
      return errRes('OWNER_USER_NOT_FOUND', 'حساب المالك غير موجود بـ Auth', 404);
    }
    console.error('[impersonate] getUserById failed', { ownerId: restaurant.owner_id, error: ownerError });
    return errRes('OWNER_QUERY_FAILED', 'فشل الاستعلام عن حساب المالك', 500);
  }
  if (!ownerData?.user) {
    return errRes('OWNER_USER_NOT_FOUND', 'حساب المالك غير موجود بـ Auth', 404);
  }

  const ownerEmail = ownerData.user.email;
  if (!ownerEmail) {
    return errRes('OWNER_USER_NOT_FOUND', 'حساب المالك لا يملك بريداً إلكترونياً', 404);
  }

  // إصدار الجلسة: generateLink فقط (لا بريد فعلي يُرسَل) ثم verifyOtp
  // عبر service role لاستبدال التوكن بجلسة Supabase حقيقية.
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: ownerEmail,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return errRes('LINK_GENERATION_FAILED', linkError?.message ?? 'فشل توليد رابط الدخول', 500);
  }

  const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError || !sessionData?.session) {
    return errRes('SESSION_EXCHANGE_FAILED', verifyError?.message ?? 'فشل تبديل التوكن بجلسة', 500);
  }

  const { access_token, refresh_token, expires_at, expires_in } = sessionData.session;

  // تسجيل الحدث بعد نجاح verifyOtp مباشرة، قبل إرجاع الاستجابة الناجحة —
  // best-effort، لا يوقف إصدار الجلسة عند فشله. لا تُخزَّن التوكنات هنا.
  const logId = await logImpersonation({
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    targetOwnerId: restaurant.owner_id,
    targetOwnerEmail: ownerEmail,
    reason: reason?.trim() || undefined,
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
    accessTokenExpiresAt: expires_at ? new Date(expires_at * 1000).toISOString() : undefined,
  });

  return NextResponse.json({
    success: true,
    restaurant: { id: restaurant.id, name: restaurant.name },
    ownerEmail,
    logId,
    session: { access_token, refresh_token, expires_at, expires_in },
  });
}
