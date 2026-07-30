import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyOwnerRequest, MIN_STAFF_PASSWORD_LENGTH } from '@/lib/auth/staff-auth';

// POST /api/driver — إضافة سائق جديد، مالك فقط.
// ينشئ حساب Supabase Auth حقيقي (بريد صناعي driver-<id>@driver.dasha.app —
// نفس نمط حساب الكاشير code@cashier.dasha.app) بدل الاعتماد على password
// نصي صريح يُقارَن من المتصفح مباشرة (RLS على drivers أُغلق بالكامل أمام
// anon الآن — بدون حساب Auth حقيقي، السائق الجديد لن يقدر يسجّل دخول إطلاقاً).
export async function POST(req: NextRequest) {
  let body: { restaurant_id?: string; name?: string; phone?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { restaurant_id, name, phone, password } = body;
  if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id مطلوب' }, { status: 400 });

  const auth = await verifyOwnerRequest(req, restaurant_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'الاسم ورقم الهاتف مطلوبان' }, { status: 400 });
  }
  if (!password || password.trim().length < MIN_STAFF_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `كلمة المرور يجب أن تكون ${MIN_STAFF_PASSWORD_LENGTH} أحرف/أرقام على الأقل` }, { status: 400 });
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .insert({ restaurant_id, name: name.trim(), phone: phone.trim(), status: 'unavailable' })
    .select('id, name, phone, status')
    .single();

  if (driverError) return NextResponse.json({ error: driverError.message }, { status: 500 });

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: `driver-${driver.id}@driver.dasha.app`,
    password: password.trim(),
    email_confirm: true,
  });

  if (authError) {
    await supabaseAdmin.from('drivers').delete().eq('id', driver.id);
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('drivers')
    .update({ user_id: authData.user.id })
    .eq('id', driver.id);

  if (updateError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    await supabaseAdmin.from('drivers').delete().eq('id', driver.id);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabaseAdmin.from('user_roles').upsert(
    {
      user_id: authData.user.id,
      restaurant_id,
      role: 'driver',
      display_name: name.trim(),
      is_active: true,
    },
    { onConflict: 'user_id,restaurant_id' }
  );

  return NextResponse.json({ driver }, { status: 201 });
}
