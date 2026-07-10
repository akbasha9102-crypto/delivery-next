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

  // ليست جلسة المالك؟ جرّب موظف (كاشير/مدير) دخل بحساب Auth مستقل (كود+كلمة مرور)
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
    .select('is_suspended')
    .eq('restaurant_id', restaurant?.id ?? '')
    .maybeSingle();

  return NextResponse.json({
    restaurant: restaurant ?? null,
    is_suspended: settings?.is_suspended ?? false,
  });
}
