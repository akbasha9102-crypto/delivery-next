import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveStaffIdentity } from '@/lib/staff-auth';
import { logStaffAction } from '@/lib/staff-actions-log';

// POST /api/inventory/waste — { item_id, quantity, reason } + ترويسة x-staff-token
// الهوية تُستخرَج حصراً من توكن موقَّع (راجع resolveStaffIdentity)، لا من
// staff_id بجسم الطلب. "السبب" إلزامي دائماً (خطة RBAC قسم 4).
export async function POST(req: NextRequest) {
  const identityRes = await resolveStaffIdentity(req);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const staff = identityRes.identity;

  let body: { item_id?: string; quantity?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { item_id, quantity, reason } = body;
  if (!item_id) return NextResponse.json({ error: 'item_id مطلوب' }, { status: 400 });
  if (!reason?.trim()) return NextResponse.json({ error: 'سبب الهدر إلزامي' }, { status: 400 });
  if (typeof quantity !== 'number' || !(quantity > 0)) {
    return NextResponse.json({ error: 'quantity يجب أن تكون رقماً أكبر من صفر' }, { status: 400 });
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from('inventory_items')
    .select('id, restaurant_id, name')
    .eq('id', item_id)
    .maybeSingle();

  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  if (!item || item.restaurant_id !== staff.restaurant_id) {
    return NextResponse.json({ error: 'المادة غير موجودة' }, { status: 404 });
  }

  const { data: movement, error: movementError } = await supabaseAdmin
    .from('stock_movements')
    .insert({
      inventory_item_id: item_id,
      restaurant_id: staff.restaurant_id,
      movement_type: 'WASTE',
      quantity_changed: Math.abs(quantity),
      reference_type: 'manual',
      performed_by_staff_id: staff.staff_id,
      notes: `${reason.trim()} (بواسطة: ${staff.display_name})`,
    })
    .select('*')
    .single();

  if (movementError) {
    const insufficientStock = movementError.message.includes('المخزون غير كافٍ');
    return NextResponse.json(
      { error: insufficientStock ? '⚠️ المخزون غير كافٍ' : movementError.message },
      { status: insufficientStock ? 409 : 500 }
    );
  }

  await logStaffAction({
    restaurant_id: staff.restaurant_id,
    staff_id: staff.staff_id,
    action_type: 'inventory_waste',
    entity_type: 'inventory_item',
    entity_id: item_id,
    after_data: { quantity: Math.abs(quantity), reason: reason.trim(), item_name: item.name },
  });

  return NextResponse.json({ ok: true, movement });
}
