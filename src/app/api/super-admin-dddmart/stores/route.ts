import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { dddmartAdmin } from '@/lib/supabase/dddmart-admin';
import { getClientIp } from '@/lib/utils/rate-limit';
import { logSuperAdminAction } from '@/lib/utils/super-admin-audit-log';

// فحص الجلسة منسوخ عمداً (لا مشترك) من src/app/api/super-admin/restaurants/route.ts —
// راجع تعليق العزل بتصميم لوحة super-admin-dddmart: تكرار قصير مقصود حتى لا
// يؤثر تعديل مستقبلي لأحد اللوحتين على الأخرى ضمناً.
async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

// توليد slug داخلي فقط (لا يوجد بمشروع dddmart توجيه (routing) لكل متجر عبر
// الرابط، فهذا معرّف داخلي بحت) — نفس منطق توليد slug بمسار restaurants،
// يشيل الأحرف غير اللاتينية ويحوّل المسافات لشرطات، مع fallback بالطابع
// الزمني للأسماء العربية بالكامل.
function generateStoreSlug(name: string): string {
  const latin = name.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().trim();
  if (latin.length >= 2) return latin.replace(/\s+/g, '-');
  return `store-${Date.now()}`;
}

// GET — قائمة متاجر dddmart
export async function GET() {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await dddmartAdmin
    .from('stores')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ stores: data ?? [] });
}

// POST — إنشاء متجر dddmart جديد + أول حساب أدمن له
export async function POST(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { storeName, adminFullName, adminEmail, adminPassword } = await req.json();

  if (!storeName?.trim())     return NextResponse.json({ error: 'storeName مطلوب' },     { status: 400 });
  if (!adminFullName?.trim()) return NextResponse.json({ error: 'adminFullName مطلوب' }, { status: 400 });
  if (!adminEmail?.trim())    return NextResponse.json({ error: 'adminEmail مطلوب' },    { status: 400 });
  if (!adminPassword?.trim()) return NextResponse.json({ error: 'adminPassword مطلوب' }, { status: 400 });

  const slug = generateStoreSlug(storeName.trim());

  // التحقق من عدم تكرار الـ slug بجدول stores بمشروع dddmart
  const { data: existing, error: existingError } = await dddmartAdmin
    .from('stores')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) return NextResponse.json({ error: `الـ slug "${slug}" مستخدم بالفعل` }, { status: 409 });

  // إدراج صف المتجر أولاً
  const { data: store, error: storeError } = await dddmartAdmin
    .from('stores')
    .insert({ name: storeName.trim(), slug, is_active: true })
    .select()
    .single();

  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 500 });

  // إنشاء حساب Auth لأدمن المتجر بمشروع dddmart — user_metadata.store_id هو
  // ما يقرأه trigger الـ handle_new_user() (من المرحلة الأولى بـ dddmart)
  // لتعيين الملف الشخصي الجديد لهذا المتجر تحديداً وجعله أول أدمن له.
  const { error: authError } = await dddmartAdmin.auth.admin.createUser({
    email: adminEmail.trim(),
    password: adminPassword.trim(),
    email_confirm: true,
    user_metadata: { full_name: adminFullName.trim(), store_id: store.id },
  });

  if (authError) {
    // تراجع (rollback): حذف صف المتجر الذي أُنشئ للتو حتى لا يبقى متجر يتيم
    // بلا أي حساب أدمن.
    await dddmartAdmin.from('stores').delete().eq('id', store.id);
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  await logSuperAdminAction({
    action: 'dddmart_store_created',
    details: { store_id: store.id, store_name: store.name },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.json({ ok: true, store });
}
