import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveStaffIdentity } from '@/lib/staff-auth';
import { logStaffAction } from '@/lib/staff-actions-log';

// POST /api/shifts/open — { opening_cash } + ترويسة x-staff-token → صف جديد بـ cashier_shifts
// الهوية تُستخرَج من توكن موقَّع (راجع resolveStaffIdentity)، لا من staff_id بجسم الطلب.
export async function POST(req: NextRequest) {
  const identityRes = await resolveStaffIdentity(req);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const staff = identityRes.identity;
  if (!staff.staff_id) return NextResponse.json({ error: 'المالك لا يفتح وردية كاشير' }, { status: 400 });
  const staff_id = staff.staff_id;

  let body: { opening_cash?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const openingCash = Number(body.opening_cash ?? 0);
  if (Number.isNaN(openingCash) || openingCash < 0) {
    return NextResponse.json({ error: 'opening_cash غير صالح' }, { status: 400 });
  }

  // لا يفتح نفس الموظف أكثر من وردية مفتوحة بنفس الوقت
  const { data: existingOpen } = await supabaseAdmin
    .from('cashier_shifts')
    .select('id')
    .eq('staff_id', staff_id)
    .eq('status', 'open')
    .maybeSingle();

  if (existingOpen) {
    return NextResponse.json({ error: 'يوجد لديك وردية مفتوحة بالفعل', shift_id: existingOpen.id }, { status: 409 });
  }

  const { data: shift, error } = await supabaseAdmin
    .from('cashier_shifts')
    .insert({
      restaurant_id: staff.restaurant_id,
      staff_id,
      opening_cash: openingCash,
      status: 'open',
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logStaffAction({
    restaurant_id: staff.restaurant_id,
    staff_id,
    action_type: 'shift_open',
    entity_type: 'cashier_shift',
    entity_id: shift.id,
    after_data: { opening_cash: openingCash },
  });

  return NextResponse.json({ shift }, { status: 201 });
}
