import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getStaffContext, isPrivilegedRole } from '@/lib/staff-auth';

// GET|POST /api/inventory/list?restaurant_id=&staff_id=
// نقطة جديدة (لا تعدّل أي شيء بصفحة المخزون الحالية) تُرجع المخزون بدون
// cost_per_unit/supplier إذا كان دور staff_id = cashier. الوضع الافتراضي
// الآمن (fail-safe deny): أي staff_id غير مُرسَل أو غير صالح أو دوره غير
// معروف = يُخفى السعر (نفس معاملة الكاشير) — لا نُظهر التكلفة إلا لدور
// owner/manager مؤكَّد من القاعدة.
async function handle(restaurantId: string, staffId: string | null) {
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id مطلوب' }, { status: 400 });

  let showCost = false;
  if (staffId) {
    const staff = await getStaffContext(staffId);
    if (staff && staff.restaurant_id === restaurantId && isPrivilegedRole(staff.role)) {
      showCost = true;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('inventory_items')
    .select(
      'id, restaurant_id, name, category, unit, current_stock, min_alert_stock, reorder_quantity, cost_per_unit, supplier, barcode, notes, is_active, created_at, updated_at'
    )
    .eq('restaurant_id', restaurantId)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((item) => {
    if (showCost) return item;
    const masked: Partial<typeof item> = { ...item };
    delete masked.cost_per_unit;
    delete masked.supplier;
    return masked;
  });

  return NextResponse.json({ items });
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id') ?? '';
  const staffId = req.nextUrl.searchParams.get('staff_id');
  return handle(restaurantId, staffId);
}

export async function POST(req: NextRequest) {
  let body: { restaurant_id?: string; staff_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }
  return handle(body.restaurant_id ?? '', body.staff_id ?? null);
}
