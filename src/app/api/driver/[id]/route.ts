import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyOwnerRequest } from '@/lib/auth/staff-auth';

// PATCH /api/driver/:id — { password } إعادة تعيين كلمة مرور السائق، مالك فقط
// (يحدّث حساب Supabase Auth الحقيقي — لا عمود password نصياً بعد الآن).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { data: driver, error: fetchError } = await supabaseAdmin
    .from('drivers')
    .select('id, restaurant_id, user_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!driver) return NextResponse.json({ error: 'السائق غير موجود' }, { status: 404 });

  const auth = await verifyOwnerRequest(req, driver.restaurant_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!body.password || body.password.trim().length < 4) {
    return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 4 أحرف/أرقام على الأقل' }, { status: 400 });
  }
  if (!driver.user_id) {
    return NextResponse.json({ error: 'هذا السائق بلا حساب دخول (سجل قديم لم يُنقَل) — راجع npm run migrate-drivers-to-auth' }, { status: 409 });
  }

  const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(driver.user_id, {
    password: body.password.trim(),
  });
  if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/driver/:id — يحذف صف السائق وحساب Auth المرتبط معاً، مالك فقط
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { data: driver, error: fetchError } = await supabaseAdmin
    .from('drivers')
    .select('id, restaurant_id, user_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!driver) return NextResponse.json({ ok: true }); // محذوف بالفعل

  const auth = await verifyOwnerRequest(req, driver.restaurant_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { error: deleteError } = await supabaseAdmin.from('drivers').delete().eq('id', id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (driver.user_id) await supabaseAdmin.auth.admin.deleteUser(driver.user_id).catch(() => {});

  return NextResponse.json({ ok: true });
}
