import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveStaffIdentity } from '@/lib/auth/staff-auth';

// GET|POST /api/inventory/list?restaurant_id= + ترويسة x-staff-token اختيارية
// نقطة جديدة (لا تعدّل أي شيء بصفحة المخزون الحالية) تُرجع المخزون بدون
// cost_per_unit/supplier إذا لم يكن الطالب مالك/مدير مؤكَّداً. الوضع
// الافتراضي الآمن (fail-safe deny): أي توكن غائب/غير صالح/دوره غير معروف
// = يُخفى السعر (نفس معاملة الكاشير). إصلاح ثغرة أمنية: كانت هذه النقطة
// تثق بـ staff_id من الـ query مباشرة بدون أي توقيع — أي كاشير يعرف
// staff_id تبع المالك (مثلاً عبر تخمين/تسريب) يقدر يمرّره ليرى التكلفة.
// الآن الهوية تُستخرَج فقط من توكن موقَّع بترويسة x-staff-token.
async function handle(restaurantId: string, req: NextRequest) {
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id مطلوب' }, { status: 400 });

  let showCost = false;
  const identityRes = await resolveStaffIdentity(req, restaurantId);
  if (identityRes.ok && identityRes.identity.is_privileged) {
    showCost = true;
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
  return handle(restaurantId, req);
}

export async function POST(req: NextRequest) {
  let body: { restaurant_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }
  return handle(body.restaurant_id ?? '', req);
}
