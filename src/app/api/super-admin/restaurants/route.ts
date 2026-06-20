import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

function generateSlug(name: string, suffix?: string): string {
  const base = name.replace(/^مطعم\s*/u, '').trim();
  const latin = base.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().trim();
  if (latin.length >= 2) return latin.replace(/\s+/g, '-');
  if (suffix) return suffix.toLowerCase().replace(/\s+/g, '-');
  return `restaurant-${Date.now()}`;
}

// الإيميل الداخلي مولود من الـ slug — لا يُعرض للمستخدم أبداً
function slugToEmail(slug: string) {
  return `${slug}@dasha.app`;
}

// GET — قائمة المطاعم
export async function GET() {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ restaurants: data });
}

// POST — إنشاء مطعم جديد + حساب بدون إيميل
export async function POST(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, slug: customSlug, password } = await req.json();

  if (!name?.trim())     return NextResponse.json({ error: 'name مطلوب' },     { status: 400 });
  if (!password?.trim()) return NextResponse.json({ error: 'password مطلوب' }, { status: 400 });

  const slug  = (customSlug?.trim() || generateSlug(name.trim())).toLowerCase().replace(/\s+/g, '-');
  const email = slugToEmail(slug);

  // التحقق من أن الـ slug غير مكرر
  const { data: existing } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: `اسم المستخدم "${slug}" مستخدم بالفعل` }, { status: 409 });
  }

  // إنشاء حساب Auth في Supabase
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: password.trim(),
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const ownerId = authData.user.id;

  // إنشاء المطعم في جدول restaurants
  const { data: restaurant, error: restError } = await supabaseAdmin
    .from('restaurants')
    .insert({ name: name.trim(), slug, owner_id: ownerId })
    .select()
    .single();

  if (restError) {
    await supabaseAdmin.auth.admin.deleteUser(ownerId);
    return NextResponse.json({ error: restError.message }, { status: 500 });
  }

  // إنشاء restaurant_settings للمطعم الجديد
  await supabaseAdmin.from('restaurant_settings').insert({
    restaurant_name: name.trim(),
    restaurant_id: restaurant.id,
    subscription_start: new Date().toISOString(),
    is_suspended: false,
  });

  return NextResponse.json({
    ok: true,
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    username: slug,
  });
}

// PATCH — تعديل slug أو كلمة مرور مطعم موجود
export async function PATCH(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { restaurantDbId, newSlug, newPassword } = await req.json();

  if (!restaurantDbId) {
    return NextResponse.json({ error: 'restaurantDbId مطلوب' }, { status: 400 });
  }
  if (!newSlug && !newPassword) {
    return NextResponse.json({ error: 'يجب تقديم newSlug أو newPassword على الأقل' }, { status: 400 });
  }

  // جلب المطعم الحالي
  const { data: restaurant, error: fetchError } = await supabaseAdmin
    .from('restaurants')
    .select('id, slug, owner_id')
    .eq('id', restaurantDbId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!restaurant) return NextResponse.json({ error: 'المطعم غير موجود' }, { status: 404 });

  const ownerId: string = restaurant.owner_id;
  const authUpdates: { email?: string; password?: string } = {};

  // تحديث الـ slug إذا كان مختلفاً
  if (newSlug && newSlug !== restaurant.slug) {
    const { data: existing } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('slug', newSlug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: `اسم المستخدم "${newSlug}" مستخدم بالفعل` }, { status: 409 });
    }

    authUpdates.email = slugToEmail(newSlug);
  }

  // تحديث كلمة المرور
  if (newPassword) {
    authUpdates.password = newPassword.trim();
  }

  // Auth أولاً — لو فشل نوقف قبل تغيير الداتابيس
  if (Object.keys(authUpdates).length > 0) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(ownerId, authUpdates);
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // بعد نجاح Auth نحدّث slug في الداتابيس
  if (newSlug && newSlug !== restaurant.slug) {
    const { error: slugError } = await supabaseAdmin
      .from('restaurants')
      .update({ slug: newSlug })
      .eq('id', restaurantDbId);

    if (slugError) return NextResponse.json({ error: slugError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
