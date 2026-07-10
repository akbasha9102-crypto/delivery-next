import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { findStaffContextByUserId } from '@/lib/auth/staff-auth';
import { verifyRequestClaims } from '@/lib/auth/verify-session';

// GET /api/staff/my-context — Authorization: Bearer <supabase access_token>
// يرجع دور/حدود الجلسة الحالية (owner/manager/cashier/driver — كلها حسابات
// Supabase Auth حقيقية الآن). الدور يُستعلَم مباشرة (Direct Query) من
// restaurants.owner_id / user_roles حيّ من القاعدة — لا من claims الـ JWT
// (custom_access_token_hook مقفلة على خطة Supabase المجانية، راجع staff-auth.ts).
export async function GET(req: NextRequest) {
  const claims = await verifyRequestClaims(req);
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('owner_id', claims.userId)
    .maybeSingle();

  if (restaurant) {
    return NextResponse.json({
      staff_id: claims.userId,
      restaurant_id: restaurant.id,
      display_name: 'المالك',
      role: 'owner',
      max_discount_pct: 100,
      max_void_amount: Number.MAX_SAFE_INTEGER,
    });
  }

  const staff = await findStaffContextByUserId(claims.userId);
  if (!staff) return NextResponse.json({ error: 'لا يوجد دور معروف لهذه الجلسة' }, { status: 404 });

  return NextResponse.json({
    staff_id: claims.userId,
    restaurant_id: staff.restaurant_id,
    display_name: staff.display_name,
    role: staff.role,
    max_discount_pct: staff.max_discount_pct,
    max_void_amount: staff.max_void_amount,
  });
}
