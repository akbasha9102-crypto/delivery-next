import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getStaffContext, isPrivilegedRole } from '@/lib/staff-auth';

// GET /api/shifts?restaurant_id=&staff_id= — المالك/المدير يرى كل ورديات
// المطعم، الكاشير يرى وردياته فقط. staff_id هنا يحدّد هوية "من يسأل" ويُفرض
// دوره من القاعدة (وليس ثقة بأي دور من العميل).
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id') ?? '';
  const staffId = req.nextUrl.searchParams.get('staff_id') ?? '';

  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id مطلوب' }, { status: 400 });
  if (!staffId) return NextResponse.json({ error: 'staff_id مطلوب' }, { status: 400 });

  const staff = await getStaffContext(staffId);
  if (!staff || staff.restaurant_id !== restaurantId) {
    return NextResponse.json({ error: 'موظف غير صالح لهذا المطعم' }, { status: 403 });
  }

  let query = supabaseAdmin
    .from('cashier_shifts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('opened_at', { ascending: false });

  if (!isPrivilegedRole(staff.role)) {
    query = query.eq('staff_id', staffId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ shifts: data ?? [] });
}
