import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let restaurant = (await supabaseAdmin
    .from('restaurants')
    .select('id, name')
    .eq('owner_id', user.id)
    .maybeSingle()).data;

  // ليست جلسة المالك؟ جرّب موظف (manager/cashier/driver) دخل بحساب Auth مستقل.
  // user_roles أولاً (النموذج الجديد)، ثم restaurant_staff (موظفون لم تُرحَّل
  // صلاحياتهم بعد — مؤقت حتى حذف الجدول القديم).
  if (!restaurant) {
    const { data: roleRow } = await supabaseAdmin
      .from('user_roles')
      .select('restaurant_id, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleRow?.is_active) {
      restaurant = (await supabaseAdmin
        .from('restaurants')
        .select('id, name')
        .eq('id', roleRow.restaurant_id)
        .maybeSingle()).data;
    }
  }

  if (!restaurant) {
    const { data: staff } = await supabaseAdmin
      .from('restaurant_staff')
      .select('restaurant_id, is_active')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (staff?.is_active) {
      restaurant = (await supabaseAdmin
        .from('restaurants')
        .select('id, name')
        .eq('id', staff.restaurant_id)
        .maybeSingle()).data;
    }
  }

  const { data: settings } = await supabaseAdmin
    .from('restaurant_settings')
    .select('is_suspended, subscription_tier')
    .eq('restaurant_id', restaurant?.id ?? '')
    .maybeSingle();

  return NextResponse.json({
    restaurant: restaurant ?? null,
    is_suspended: settings?.is_suspended ?? false,
    subscription_tier: settings?.subscription_tier ?? 'professional',
  });
}
