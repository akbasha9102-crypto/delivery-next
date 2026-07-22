import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const PHONE_REGEX = /^[0-9+\-\s]+$/;

// POST — إنشاء طلب حساب جديد (عام بالكامل، بدون أي مصادقة — يُملأ من
// صفحة الهبوط العامة). يُخزَّن كطلب pending بانتظار مراجعة سوبر أدمن.
export async function POST(req: NextRequest) {
  const { fullName, phone, restaurantName } = await req.json().catch(() => ({}));

  const trimmedFullName       = typeof fullName === 'string' ? fullName.trim() : '';
  const trimmedPhone          = typeof phone === 'string' ? phone.trim() : '';
  const trimmedRestaurantName = typeof restaurantName === 'string' ? restaurantName.trim() : '';

  if (!trimmedFullName) {
    return NextResponse.json({ error: 'الاسم الكامل مطلوب' }, { status: 400 });
  }
  if (trimmedFullName.length < 2 || trimmedFullName.length > 120) {
    return NextResponse.json({ error: 'الاسم الكامل يجب أن يكون بين 2 و120 حرفاً' }, { status: 400 });
  }

  if (!trimmedPhone) {
    return NextResponse.json({ error: 'رقم الهاتف مطلوب' }, { status: 400 });
  }
  if (trimmedPhone.length < 6 || trimmedPhone.length > 30) {
    return NextResponse.json({ error: 'رقم الهاتف يجب أن يكون بين 6 و30 رقماً' }, { status: 400 });
  }
  if (!PHONE_REGEX.test(trimmedPhone)) {
    return NextResponse.json({ error: 'رقم الهاتف غير صالح' }, { status: 400 });
  }

  if (!trimmedRestaurantName) {
    return NextResponse.json({ error: 'اسم المطعم مطلوب' }, { status: 400 });
  }
  if (trimmedRestaurantName.length < 2 || trimmedRestaurantName.length > 120) {
    return NextResponse.json({ error: 'اسم المطعم يجب أن يكون بين 2 و120 حرفاً' }, { status: 400 });
  }

  // فحص تكرار: طلب pending بنفس رقم الهاتف خلال آخر 10 دقائق
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existing } = await supabaseAdmin
    .from('account_creation_requests')
    .select('id')
    .eq('phone', trimmedPhone)
    .eq('status', 'pending')
    .gte('created_at', tenMinutesAgo)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'لديك طلب قيد المراجعة بالفعل، الرجاء الانتظار قليلاً' }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from('account_creation_requests').insert({
    full_name:       trimmedFullName,
    phone:           trimmedPhone,
    restaurant_name: trimmedRestaurantName,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
