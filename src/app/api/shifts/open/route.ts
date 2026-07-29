import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';
import { logStaffAction } from '@/lib/utils/staff-actions-log';

// POST /api/shifts/open — { opening_cash } + ترويسة x-staff-token → صف جديد بـ cashier_shifts
// الهوية تُستخرَج من توكن موقَّع (راجع resolveStaffIdentity)، لا من staff_id بجسم الطلب.
export async function POST(req: NextRequest) {
  let body: { opening_cash?: number; restaurant_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const restaurantId = body.restaurant_id ?? '';
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id مطلوب' }, { status: 400 });

  const identityRes = await resolveStaffIdentity(req, restaurantId);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const staff = identityRes.identity;
  if (staff.role === 'owner') return NextResponse.json({ error: 'المالك لا يفتح وردية كاشير' }, { status: 400 });

  const openingCash = Number(body.opening_cash ?? 0);
  if (Number.isNaN(openingCash) || openingCash < 0) {
    return NextResponse.json({ error: 'opening_cash غير صالح' }, { status: 400 });
  }

  // لا تُفتح أكثر من وردية مفتوحة بنفس الوقت لنفس المطعم إطلاقاً — لا لنفس
  // الموظف فقط، بل حتى لموظف آخر. العقد الحالي لا يربط أي طلب بوردية/كاشير
  // محدد، فلو تداخلت ورديتان زمنياً يُحتسب "الكاش المتوقع" لكل واحدة منهما
  // من كل طلبات المطعم بالفترة — أي مضاعفة وهمية (خطأ #16 بتقرير الفحص).
  const { data: existingOpen } = await supabaseAdmin
    .from('cashier_shifts')
    .select('id, staff_user_id')
    .eq('restaurant_id', staff.restaurant_id)
    .eq('status', 'open')
    .maybeSingle();

  if (existingOpen) {
    const sameStaff = existingOpen.staff_user_id === staff.user_id;
    return NextResponse.json({
      error: sameStaff ? 'يوجد لديك وردية مفتوحة بالفعل' : 'يوجد وردية أخرى مفتوحة حالياً بهذا المطعم — يجب إغلاقها أولاً',
      shift_id: existingOpen.id,
    }, { status: 409 });
  }

  const { data: shift, error } = await supabaseAdmin
    .from('cashier_shifts')
    .insert({
      restaurant_id: staff.restaurant_id,
      staff_user_id: staff.user_id,
      opening_cash: openingCash,
      status: 'open',
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logStaffAction({
    restaurant_id: staff.restaurant_id,
    performed_by_auth_id: staff.user_id,
      performed_by_label: staff.display_name,
    action_type: 'shift_open',
    entity_type: 'cashier_shift',
    entity_id: shift.id,
    after_data: { opening_cash: openingCash },
  });

  return NextResponse.json({ shift }, { status: 201 });
}
