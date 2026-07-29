import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyOwnerRequest, normalizeStaffUsername, isValidStaffUsername, staffCodeToEmail, isProfessionalPackage, type StaffRole } from '@/lib/auth/staff-auth';

const STAFF_SELECT =
  'id, restaurant_id, display_name, role, is_active, user_id, code, max_discount_pct, max_void_amount, created_at, updated_at';

// PATCH /api/staff/:id — تحديث جزئي (تعطيل، تغيير حدود، إعادة تعيين كلمة المرور)، مالك فقط
// :id هو user_roles.id (وليس restaurant_staff.id القديم).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: {
    display_name?: string;
    role?: StaffRole;
    is_active?: boolean;
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

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('user_roles')
    .select('id, restaurant_id, user_id, code')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });

  const auth = await verifyOwnerRequest(req, existing.restaurant_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!(await isProfessionalPackage(existing.restaurant_id))) {
    return NextResponse.json({ error: 'إدارة الموظفين غير متاحة بالباقة الحالية' }, { status: 403 });
  }

  const update: Record<string, unknown> = {};

  if (body.display_name !== undefined) {
    if (!body.display_name.trim()) return NextResponse.json({ error: 'display_name لا يمكن أن يكون فارغاً' }, { status: 400 });
    update.display_name = body.display_name.trim();
  }
  if (body.role !== undefined) {
    if (!['manager', 'cashier'].includes(body.role)) {
      return NextResponse.json({ error: 'role غير صالح' }, { status: 400 });
    }
    update.role = body.role;
  }
  if (body.is_active !== undefined) update.is_active = !!body.is_active;
  if (body.max_discount_pct !== undefined) update.max_discount_pct = body.max_discount_pct;
  if (body.max_void_amount !== undefined) update.max_void_amount = body.max_void_amount;

  // تعديل اسم المستخدم (code): يتطلب مزامنة الإيميل الداخلي بحساب Auth
  // الحقيقي (code@cashier.dasha.app) — مع تراجع (rollback) إن فشل تحديث
  // user_roles بعد نجاح تغيير الإيميل بـ Auth.
  let previousEmailForRollback: string | null = null;

  if (body.code !== undefined) {
    const newCode = normalizeStaffUsername(body.code);
    if (!isValidStaffUsername(newCode)) {
      return NextResponse.json({ error: 'اسم المستخدم يجب أن يكون 3-20 حرفاً/رقماً إنجليزياً صغيراً، أو - أو _، وليس كلمة محجوزة' }, { status: 400 });
    }
    const currentCode = (existing.code ?? '').toLowerCase();
    if (newCode !== currentCode) {
      const { data: codeClash } = await supabaseAdmin.from('user_roles').select('id').ilike('code', newCode).neq('id', id).maybeSingle();
      if (codeClash) return NextResponse.json({ error: `اسم المستخدم "${newCode}" مستخدم بالفعل` }, { status: 409 });
      const { data: slugClash } = await supabaseAdmin.from('restaurants').select('id').ilike('slug', newCode).maybeSingle();
      if (slugClash) return NextResponse.json({ error: `اسم المستخدم "${newCode}" مستخدم بالفعل` }, { status: 409 });

      previousEmailForRollback = staffCodeToEmail(existing.code ?? '');
      const { error: emailAuthError } = await supabaseAdmin.auth.admin.updateUserById(existing.user_id, {
        email: staffCodeToEmail(newCode),
      });
      if (emailAuthError) return NextResponse.json({ error: emailAuthError.message }, { status: 500 });

      update.code = newCode;
    }
  }

  if (body.password !== undefined) {
    if (body.password.trim().length < 4) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 4 أحرف/أرقام على الأقل' }, { status: 400 });
    }
    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(existing.user_id, {
      password: body.password.trim(),
    });
    if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 });
    // إبطال أي جلسة قديمة بجهاز آخر بعد تغيير كلمة المرور
    try { await supabaseAdmin.rpc('revoke_user_sessions', { p_user_id: existing.user_id }); } catch { /* best-effort */ }
  }

  // تعطيل الحساب: لا يكفي منع دخول جديد — يجب إبطال الجلسة الحالية (JWT)
  // فوراً وإلا تبقى صالحة بجهاز الموظف لحد انتهاء صلاحيتها الطبيعية.
  if (body.is_active === false) {
    try { await supabaseAdmin.rpc('revoke_user_sessions', { p_user_id: existing.user_id }); } catch { /* best-effort */ }
  }

  if (Object.keys(update).length === 0 && body.password === undefined) {
    return NextResponse.json({ error: 'لا يوجد حقل لتحديثه' }, { status: 400 });
  }

  if (Object.keys(update).length === 0) {
    const { data } = await supabaseAdmin.from('user_roles').select(STAFF_SELECT).eq('id', id).single();
    return NextResponse.json({ staff: data });
  }

  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .update(update)
    .eq('id', id)
    .select(STAFF_SELECT)
    .single();

  if (error) {
    if (previousEmailForRollback) {
      try { await supabaseAdmin.auth.admin.updateUserById(existing.user_id, { email: previousEmailForRollback }); } catch { /* best-effort rollback */ }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ staff: data });
}
