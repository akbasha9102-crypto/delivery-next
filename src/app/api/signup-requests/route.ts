import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { RESERVED_STAFF_USERNAMES } from '@/lib/auth/staff-auth';

const PHONE_REGEX    = /^[0-9+\-\s]+$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

// POST — إنشاء طلب حساب جديد (عام بالكامل، بدون أي مصادقة — يُملأ من
// صفحة /signup العامة). يُخزَّن كطلب pending بانتظار مراجعة سوبر أدمن،
// ويُنشئ فوراً حساب Supabase Auth خامل (راجع تعليق migration
// 20260725100000_account_creation_requests_username_auth.sql للتفصيل
// الكامل لماذا هذا آمن رغم عدم وجود موافقة بعد).
export async function POST(req: NextRequest) {
  const { fullName, phone, restaurantName, username, password } = await req.json().catch(() => ({}));

  const trimmedFullName       = typeof fullName === 'string' ? fullName.trim() : '';
  const trimmedPhone          = typeof phone === 'string' ? phone.trim() : '';
  const trimmedRestaurantName = typeof restaurantName === 'string' ? restaurantName.trim() : '';
  const normalizedUsername    = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const rawPassword           = typeof password === 'string' ? password : '';

  if (!trimmedFullName) {
    return NextResponse.json({ error: 'الاسم الكامل مطلوب' }, { status: 400 });
  }
  if (trimmedFullName.length < 2 || trimmedFullName.length > 120) {
    return NextResponse.json({ error: 'الاسم الكامل يجب أن يكون بين 2 و120 حرفاً' }, { status: 400 });
  }

  if (!trimmedPhone) {
    return NextResponse.json({ error: 'رقم الهاتف مطلوب' }, { status: 400 });
  }
  if (trimmedPhone.length < 6 || trimmedPhone.length > 30) {
    return NextResponse.json({ error: 'رقم الهاتف يجب أن يكون بين 6 و30 رقماً' }, { status: 400 });
  }
  if (!PHONE_REGEX.test(trimmedPhone)) {
    return NextResponse.json({ error: 'رقم الهاتف غير صالح' }, { status: 400 });
  }

  if (!trimmedRestaurantName) {
    return NextResponse.json({ error: 'اسم المطعم مطلوب' }, { status: 400 });
  }
  if (trimmedRestaurantName.length < 2 || trimmedRestaurantName.length > 120) {
    return NextResponse.json({ error: 'اسم المطعم يجب أن يكون بين 2 و120 حرفاً' }, { status: 400 });
  }

  if (!normalizedUsername || !USERNAME_REGEX.test(normalizedUsername)) {
    return NextResponse.json({ error: 'اسم المستخدم يجب أن يكون 3-24 حرفاً إنجليزياً صغيراً أو رقماً أو "_" فقط' }, { status: 400 });
  }
  if (RESERVED_STAFF_USERNAMES.has(normalizedUsername)) {
    return NextResponse.json({ error: 'اسم المستخدم هذا محجوز، الرجاء اختيار اسم آخر' }, { status: 400 });
  }
  if (!rawPassword || rawPassword.length < 8) {
    return NextResponse.json({ error: 'كلمة السر يجب أن تكون 8 أحرف على الأقل' }, { status: 400 });
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existingPending } = await supabaseAdmin
    .from('account_creation_requests')
    .select('id')
    .eq('phone', trimmedPhone)
    .eq('status', 'pending')
    .gte('created_at', tenMinutesAgo)
    .maybeSingle();

  if (existingPending) {
    return NextResponse.json({ error: 'لديك طلب قيد المراجعة بالفعل، الرجاء الانتظار قليلاً' }, { status: 409 });
  }

  const USERNAME_TAKEN_ERROR = 'اسم المستخدم هذا مستخدم مسبقاً';

  const { data: slugClash } = await supabaseAdmin
    .from('restaurants').select('id').eq('slug', normalizedUsername).maybeSingle();
  if (slugClash) return NextResponse.json({ error: USERNAME_TAKEN_ERROR }, { status: 409 });

  const { data: staffClash } = await supabaseAdmin
    .from('user_roles').select('id').ilike('code', normalizedUsername).maybeSingle();
  if (staffClash) return NextResponse.json({ error: USERNAME_TAKEN_ERROR }, { status: 409 });

  const { data: requestClash } = await supabaseAdmin
    .from('account_creation_requests')
    .select('id')
    .ilike('username', normalizedUsername)
    .neq('status', 'rejected')
    .maybeSingle();
  if (requestClash) return NextResponse.json({ error: USERNAME_TAKEN_ERROR }, { status: 409 });

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: `${normalizedUsername}@dasha.app`,
    password: rawPassword,
    email_confirm: true,
    user_metadata: { pending_signup_full_name: trimmedFullName, pending_signup_restaurant_name: trimmedRestaurantName },
  });

  if (authError) {
    const alreadyExists = authError.status === 422 || /already been registered|already exists/i.test(authError.message);
    if (alreadyExists) {
      return NextResponse.json({ error: USERNAME_TAKEN_ERROR }, { status: 409 });
    }
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const { error } = await supabaseAdmin.from('account_creation_requests').insert({
    full_name:       trimmedFullName,
    phone:           trimmedPhone,
    restaurant_name: trimmedRestaurantName,
    username:        normalizedUsername,
    auth_user_id:    authData.user.id,
  });

  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    if (error.code === '23505') {
      return NextResponse.json({ error: USERNAME_TAKEN_ERROR }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
