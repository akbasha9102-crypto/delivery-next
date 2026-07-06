import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPin, isValidPinFormat, verifyOwnerRequest, type StaffRole } from '@/lib/staff-auth';

const STAFF_SELECT_NO_PIN =
  'id, restaurant_id, display_name, role, is_active, auth_user_id, max_discount_pct, max_void_amount, failed_pin_attempts, locked_until, created_at, updated_at';

// GET /api/staff?restaurant_id= — قائمة الموظفين، مالك فقط، لا يُرجع pin_hash أبداً
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id') ?? '';
  const auth = await verifyOwnerRequest(req, restaurantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin
    .from('restaurant_staff')
    .select(STAFF_SELECT_NO_PIN)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}

// POST /api/staff — إضافة موظف جديد (كاشير/مدير)، مالك فقط
export async function POST(req: NextRequest) {
  let body: {
    restaurant_id?: string;
    display_name?: string;
    role?: StaffRole;
    pin?: string;
    max_discount_pct?: number;
    max_void_amount?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { restaurant_id, display_name, role, pin, max_discount_pct, max_void_amount } = body;

  const auth = await verifyOwnerRequest(req, restaurant_id ?? '');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!display_name?.trim()) {
    return NextResponse.json({ error: 'display_name مطلوب' }, { status: 400 });
  }
  if (!role || !['owner', 'manager', 'cashier'].includes(role)) {
    return NextResponse.json({ error: 'role غير صالح' }, { status: 400 });
  }
  if (!isValidPinFormat(pin)) {
    return NextResponse.json({ error: 'PIN يجب أن يكون 4-6 أرقام' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('restaurant_staff')
    .insert({
      restaurant_id,
      display_name: display_name.trim(),
      role,
      pin_hash: hashPin(pin),
      max_discount_pct: max_discount_pct ?? 0,
      max_void_amount: max_void_amount ?? 0,
    })
    .select(STAFF_SELECT_NO_PIN)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data }, { status: 201 });
}
