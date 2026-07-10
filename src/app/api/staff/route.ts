import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateStaffCode, staffCodeToEmail, verifyOwnerRequest, type StaffRole } from '@/lib/auth/staff-auth';

const STAFF_SELECT =
  'id, restaurant_id, display_name, role, is_active, user_id, code, max_discount_pct, max_void_amount, created_at, updated_at';

// GET /api/staff?restaurant_id= — قائمة موظفي الكاشير (manager/cashier)، مالك فقط.
// السائقون (driver) لهم صفحة/تدفّق إدارة منفصل تماماً (/admin/drivers)
// رغم مشاركتهم نفس جدول user_roles تحت الغطاء — لا يظهرون هنا.
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id') ?? '';
  const auth = await verifyOwnerRequest(req, restaurantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select(STAFF_SELECT)
    .eq('restaurant_id', restaurantId)
    .in('role', ['manager', 'cashier'])
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}

// POST /api/staff — إضافة موظف جديد (كاشير/مدير)، مالك فقط.
// ينشئ حساب Supabase Auth حقيقي مستقل للموظف (نفس نمط حساب المطعم
// slug@dasha.app) بإيميل صناعي code@cashier.dasha.app — الموظف يدخل
// بصفحة /login (تبويب "موظف") بالكود + كلمة المرور مباشرة، دون حاجة
// لجلسة المالك المشتركة أو شاشة PIN.
export async function POST(req: NextRequest) {
  let body: {
    restaurant_id?: string;
    display_name?: string;
    role?: StaffRole;
    password?: string;
    code?: string;
    max_discount_pct?: number;
    max_void_amount?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { restaurant_id, display_name, role, password, max_discount_pct, max_void_amount } = body;

  const auth = await verifyOwnerRequest(req, restaurant_id ?? '');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!display_name?.trim()) {
    return NextResponse.json({ error: 'display_name مطلوب' }, { status: 400 });
  }
  if (!role || !['manager', 'cashier', 'driver'].includes(role)) {
    return NextResponse.json({ error: 'role غير صالح' }, { status: 400 });
  }
  if (!password || password.trim().length < 4) {
    return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 4 أحرف/أرقام على الأقل' }, { status: 400 });
  }

  // كود مقترَح من الواجهة (عرض فوري للمالك عند فتح النموذج) — نتحقق من عدم
  // تكراره، وإلا نولّد كوداً جديداً. النتيجة النهائية تُرجَع دائماً بالاستجابة
  // كي تعرض الواجهة الكود الحقيقي المُستخدَم فعلياً.
  let code = body.code && /^\d{6}$/.test(body.code) ? body.code : generateStaffCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: clash } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .ilike('code', code)
      .maybeSingle();
    if (!clash) break;
    code = generateStaffCode();
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: staffCodeToEmail(code),
    password: password.trim(),
    email_confirm: true,
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .insert({
      restaurant_id,
      display_name: display_name.trim(),
      role,
      code,
      user_id: authData.user.id,
      max_discount_pct: max_discount_pct ?? 0,
      max_void_amount: max_void_amount ?? 0,
    })
    .select(STAFF_SELECT)
    .single();

  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: data }, { status: 201 });
}
