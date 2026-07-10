import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getStaffContext } from '@/lib/auth/staff-auth';
import { verifyRequestClaims } from '@/lib/auth/verify-session';

// GET /api/staff/my-context — Authorization: Bearer <supabase access_token>
// يرجع دور/حدود الجلسة الحالية (owner/manager/cashier/driver — كلها حسابات
// Supabase Auth حقيقية الآن). الدور يُقرأ من claims الـ JWT الموثَّقة
// (custom_access_token_hook)، لا من أي جدول يُثَق بمعرّف يرسله العميل.
export async function GET(req: NextRequest) {
  const claims = verifyRequestClaims(req);
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (claims.role === 'owner') {
    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('owner_id', claims.userId)
      .maybeSingle();
    if (!restaurant) return NextResponse.json({ error: 'لا يوجد مطعم لهذا الحساب' }, { status: 404 });
    return NextResponse.json({
      staff_id: claims.userId,
      restaurant_id: restaurant.id,
      display_name: 'المالك',
      role: 'owner',
      max_discount_pct: 100,
      max_void_amount: Number.MAX_SAFE_INTEGER,
    });
  }

  if (!claims.role || !claims.restaurantId) {
    return NextResponse.json({ error: 'لا يوجد دور معروف لهذه الجلسة' }, { status: 404 });
  }

  const staff = await getStaffContext(claims.userId, claims.restaurantId);
  if (!staff) return NextResponse.json({ error: 'حساب غير صالح أو معطّل' }, { status: 404 });

  return NextResponse.json({
    staff_id: claims.userId,
    restaurant_id: staff.restaurant_id,
    display_name: staff.display_name,
    role: staff.role,
    max_discount_pct: staff.max_discount_pct,
    max_void_amount: staff.max_void_amount,
  });
}
