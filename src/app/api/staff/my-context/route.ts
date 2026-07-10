import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { signStaffToken } from '@/lib/auth/staff-auth';

// GET /api/staff/my-context — Authorization: Bearer <supabase access_token>
// يتحقق هل الجلسة الحالية تخص موظفاً (كاشير/مدير) دخل مباشرة بكود+كلمة
// مرور من /login (حساب Auth حقيقي مستقل، auth_user_id)، لا حساب المطعم
// الأساسي (owner). إن كانت كذلك يرجع هويته + staff_token موقَّع جاهز
// للاستخدام مباشرة بكل نقاط RBAC الحساسة (نفس شكل استجابة verify-pin).
// 404 يعني: هذه الجلسة ليست موظفاً — على الأغلب هي جلسة المالك نفسه.
export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: staff } = await supabaseAdmin
    .from('restaurant_staff')
    .select('id, restaurant_id, display_name, role, is_active, max_discount_pct, max_void_amount')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!staff || !staff.is_active) {
    return NextResponse.json({ error: 'ليست جلسة موظف' }, { status: 404 });
  }

  const staff_token = signStaffToken({ sid: staff.id, rid: staff.restaurant_id, role: staff.role });

  return NextResponse.json({
    staff_id: staff.id,
    restaurant_id: staff.restaurant_id,
    display_name: staff.display_name,
    role: staff.role,
    max_discount_pct: staff.max_discount_pct,
    max_void_amount: staff.max_void_amount,
    staff_token,
  });
}
