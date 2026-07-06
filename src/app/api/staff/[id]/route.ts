import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPin, isValidPinFormat, verifyOwnerRequest, type StaffRole } from '@/lib/staff-auth';

const STAFF_SELECT_NO_PIN =
  'id, restaurant_id, display_name, role, is_active, auth_user_id, max_discount_pct, max_void_amount, failed_pin_attempts, locked_until, created_at, updated_at';

// PATCH /api/staff/:id — تحديث جزئي (تعطيل، تغيير حدود، إعادة تعيين PIN)، مالك فقط
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: {
    display_name?: string;
    role?: StaffRole;
    is_active?: boolean;
    pin?: string;
    max_discount_pct?: number;
    max_void_amount?: number;
    locked_until?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('restaurant_staff')
    .select('id, restaurant_id')
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
    if (!['owner', 'manager', 'cashier'].includes(body.role)) {
      return NextResponse.json({ error: 'role غير صالح' }, { status: 400 });
    }
    update.role = body.role;
  }
  if (body.is_active !== undefined) update.is_active = !!body.is_active;
  if (body.max_discount_pct !== undefined) update.max_discount_pct = body.max_discount_pct;
  if (body.max_void_amount !== undefined) update.max_void_amount = body.max_void_amount;
  if (body.locked_until !== undefined) update.locked_until = body.locked_until;

  if (body.pin !== undefined) {
    if (!isValidPinFormat(body.pin)) {
      return NextResponse.json({ error: 'PIN يجب أن يكون 4-6 أرقام' }, { status: 400 });
    }
    update.pin_hash = hashPin(body.pin);
    // إعادة تعيين PIN تُصفّر أي soft-lock سابق
    update.failed_pin_attempts = 0;
    update.locked_until = null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'لا يوجد حقل لتحديثه' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('restaurant_staff')
    .update(update)
    .eq('id', id)
    .select(STAFF_SELECT_NO_PIN)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}
