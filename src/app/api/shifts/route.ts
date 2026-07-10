import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';

// GET /api/shifts?restaurant_id= + ترويسة x-staff-token — المالك/المدير
// يرى كل ورديات المطعم، الكاشير يرى وردياته فقط. الهوية تُستخرَج حصراً من
// التوكن الموقَّع (وليس من staff_id بالـ query كما كان سابقاً — إصلاح ثغرة
// أمنية: أي كاشير كان يقدر يمرّر staff_id تبع كاشير/مالك آخر ليطّلع على
// ورديات وأرصدة الآخرين).
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id') ?? '';
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id مطلوب' }, { status: 400 });

  const identityRes = await resolveStaffIdentity(req, restaurantId);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const staff = identityRes.identity;

  let query = supabaseAdmin
    .from('cashier_shifts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('opened_at', { ascending: false });

  if (!staff.is_privileged) {
    query = query.eq('staff_user_id', staff.user_id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ shifts: data ?? [] });
}
