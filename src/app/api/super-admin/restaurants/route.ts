import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

// توليد slug من اسم المطعم
function generateSlug(name: string, suffix?: string): string {
  // إزالة كلمة "مطعم" من البداية
  let base = name.replace(/^مطعم\s*/u, '').trim();

  // استخراج الحروف اللاتينية والأرقام
  const latin = base.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().trim();

  if (latin.length >= 2) {
    return latin.replace(/\s+/g, '-');
  }

  // إذا كان الاسم عربياً بالكامل، استخدم suffix أو timestamp
  if (suffix) return suffix.toLowerCase().replace(/\s+/g, '-');
  return `restaurant-${Date.now()}`;
}

// GET — قائمة المطاعم مع بيانات owner_id
export async function GET() {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ restaurants: data });
}

// POST — إنشاء مطعم جديد + حساب Supabase Auth
export async function POST(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, slug: customSlug, email, password } = await req.json();

  if (!name?.trim())     return NextResponse.json({ error: 'name مطلوب' },     { status: 400 });
  if (!email?.trim())    return NextResponse.json({ error: 'email مطلوب' },    { status: 400 });
  if (!password?.trim()) return NextResponse.json({ error: 'password مطلوب' }, { status: 400 });

  const slug = (customSlug?.trim() || generateSlug(name.trim())).toLowerCase().replace(/\s+/g, '-');

  // التحقق من أن الـ slug غير مكرر
  const { data: existing } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: `الـ slug "${slug}" مستخدم بالفعل` }, { status: 409 });
  }

  // إنشاء حساب Auth في Supabase
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim(),
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
    // حذف المستخدم إذا فشل إنشاء المطعم
    await supabaseAdmin.auth.admin.deleteUser(ownerId);
    return NextResponse.json({ error: restError.message }, { status: 500 });
  }

  // إنشاء restaurant_settings فارغة للمطعم الجديد
  await supabaseAdmin.from('restaurant_settings').insert({
    restaurant_name: name.trim(),
    restaurant_id: restaurant.id,
    admin_email: email.trim(),
    subscription_start: new Date().toISOString(),
    is_suspended: false,
  });

  return NextResponse.json({
    ok: true,
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    auth_user: { id: ownerId, email: email.trim() },
  });
}
