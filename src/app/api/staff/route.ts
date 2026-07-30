import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizeStaffUsername, isValidStaffUsername, staffCodeToEmail, verifyOwnerRequest, isProfessionalPackage, MIN_STAFF_PASSWORD_LENGTH, type StaffRole } from '@/lib/auth/staff-auth';

const STAFF_SELECT =
  'id, restaurant_id, display_name, role, is_active, user_id, code, max_discount_pct, max_void_amount, created_at, updated_at';

// GET /api/staff?restaurant_id= — قائمة موظفي الكاشير (manager/cashier)، مالك فقط.
// السائقون (driver) لهم صفحة/تدفّق إدارة منفصل تماماً (/admin/drivers)
// رغم مشاركتهم نفس جدول user_roles تحت الغطاء — لا يظهرون هنا.
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id') ?? '';
  const auth = await verifyOwnerRequest(req, restaurantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!(await isProfessionalPackage(restaurantId))) {
    return NextResponse.json({ error: 'إدارة الموظفين غير متاحة بالباقة الحالية' }, { status: 403 });
  }

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
// slug@dasha.app) بإيميل صناعي code@cashier.dasha.app — اسم المستخدم
// (code) يختاره المالك نفسه عند الإنشاء (وليس مولَّداً تلقائياً)، والموظف
// يدخل بصفحة /login الموحّدة باسم المستخدم هذا + كلمة المرور مباشرة، دون
// حاجة لجلسة المالك المشتركة أو شاشة PIN.
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

  if (!(await isProfessionalPackage(restaurant_id ?? ''))) {
    return NextResponse.json({ error: 'إدارة الموظفين غير متاحة بالباقة الحالية' }, { status: 403 });
  }

  if (!display_name?.trim()) {
    return NextResponse.json({ error: 'display_name مطلوب' }, { status: 400 });
  }
  // driver مستبعَد عمداً — للسائقين تدفّق إنشاء منفصل (/api/driver) يُنشئ
  // صف drivers المرتبط أيضاً، وإلا يبقى حساب driver بلا صف drivers مقابل.
  if (!role || !['manager', 'cashier'].includes(role)) {
    return NextResponse.json({ error: 'role غير صالح' }, { status: 400 });
  }
  if (!password || password.trim().length < MIN_STAFF_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `كلمة المرور يجب أن تكون ${MIN_STAFF_PASSWORD_LENGTH} أحرف/أرقام على الأقل` }, { status: 400 });
  }

  if (!body.code?.trim()) {
    return NextResponse.json({ error: 'اسم المستخدم مطلوب' }, { status: 400 });
  }
  const code = normalizeStaffUsername(body.code);
  if (!isValidStaffUsername(code)) {
    return NextResponse.json({ error: 'اسم المستخدم يجب أن يكون 3-20 حرفاً/رقماً إنجليزياً صغيراً، أو - أو _، وليس كلمة محجوزة' }, { status: 400 });
  }

  const { data: codeClash } = await supabaseAdmin.from('user_roles').select('id').ilike('code', code).maybeSingle();
  if (codeClash) {
    return NextResponse.json({ error: `اسم المستخدم "${code}" مستخدم بالفعل` }, { status: 409 });
  }
  const { data: slugClash } = await supabaseAdmin.from('restaurants').select('id').ilike('slug', code).maybeSingle();
  if (slugClash) {
    return NextResponse.json({ error: `اسم المستخدم "${code}" مستخدم بالفعل` }, { status: 409 });
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
