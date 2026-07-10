import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyOwnerRequest, type StaffRole } from '@/lib/auth/staff-auth';

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
    .select('id, restaurant_id, user_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });

  const auth = await verifyOwnerRequest(req, existing.restaurant_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const update: Record<string, unknown> = {};

  if (body.display_name !== undefined) {
    if (!body.display_name.trim()) return NextResponse.json({ error: 'display_name لا يمكن أن يكون فارغاً' }, { status: 400 });
    update.display_name = body.display_name.trim();
  }
  if (body.role !== undefined) {
    if (!['manager', 'cashier', 'driver'].includes(body.role)) {
      return NextResponse.json({ error: 'role غير صالح' }, { status: 400 });
    }
    update.role = body.role;
  }
  if (body.is_active !== undefined) update.is_active = !!body.is_active;
  if (body.max_discount_pct !== undefined) update.max_discount_pct = body.max_discount_pct;
  if (body.max_void_amount !== undefined) update.max_void_amount = body.max_void_amount;

  if (body.password !== undefined) {
    if (body.password.trim().length < 4) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 4 أحرف/أرقام على الأقل' }, { status: 400 });
    }
    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(existing.user_id, {
      password: body.password.trim(),
    });
    if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 });
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}
