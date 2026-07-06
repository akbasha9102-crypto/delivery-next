import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveStaffIdentity } from '@/lib/staff-auth';
import { logStaffAction } from '@/lib/staff-actions-log';
import { notifyOwnerPush } from '@/lib/notify-owner-push';

// فرق كاش أعلى من هذا الحد (بنفس عملة النظام) يُنبَّه المالك فوراً — قيمة
// افتراضية حسب مثال الخطة (القسم 5)، يمكن تحويلها لإعداد بالمطعم لاحقاً.
const VARIANCE_ALERT_THRESHOLD = 5000;

// POST /api/shifts/:id/close — { actual_closing_cash } + ترويسة x-staff-token
// إصلاح ثغرة أمنية (H3): سابقاً لم يكن هناك أي تحقق هوية — أي طرف يملك
// الجلسة المشتركة يقدر يغلق وردية أي كاشير آخر ويفرض actual_closing_cash
// كيفما شاء. الآن: يجب أن يكون المُغلِق إما صاحب الوردية نفسه (staff_id
// مطابق)، أو مالك/مدير (إشراف).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const identityRes = await resolveStaffIdentity(req);
  if (!identityRes.ok) return NextResponse.json({ error: identityRes.error }, { status: identityRes.status });
  const requester = identityRes.identity;

  let body: { actual_closing_cash?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const actualClosingCash = Number(body.actual_closing_cash);
  if (Number.isNaN(actualClosingCash) || actualClosingCash < 0) {
    return NextResponse.json({ error: 'actual_closing_cash يجب أن يكون رقماً غير سالب' }, { status: 400 });
  }

  const { data: shift, error: shiftError } = await supabaseAdmin
    .from('cashier_shifts')
    .select('id, restaurant_id, staff_id, opening_cash, opened_at, status')
    .eq('id', id)
    .maybeSingle();

  if (shiftError) return NextResponse.json({ error: shiftError.message }, { status: 500 });
  if (!shift) return NextResponse.json({ error: 'الوردية غير موجودة' }, { status: 404 });
  if (shift.restaurant_id !== requester.restaurant_id) {
    return NextResponse.json({ error: 'الوردية غير موجودة' }, { status: 404 });
  }
  if (!requester.is_privileged && requester.staff_id !== shift.staff_id) {
    return NextResponse.json({ error: 'لا يمكنك إغلاق وردية موظف آخر' }, { status: 403 });
  }
  if (shift.status !== 'open') return NextResponse.json({ error: 'الوردية مغلقة بالفعل' }, { status: 409 });

  const closedAt = new Date();

  // مجموع الطلبات "المكتملة" خلال فترة الوردية — يُعتبر مبلغاً نقدياً (cash)
  // ملاحظة مهمة للفريق: لا يوجد حالياً أي عمود payment_method على جدول
  // orders (تحقّقنا بالكود، لا وجود لمفهوم "دفع نقدي/إلكتروني" إطلاقاً)،
  // ولا عمود يربط الطلب بموظف مُعيّن نفّذه. لذلك expected_closing_cash هنا
  // = مجموع كل طلبات المطعم المكتملة بفترة الوردية (زمنياً)، بافتراض أن كل
  // الطلبات اليوم نقدية (COD) كما يبدو من غياب أي بديل بالكود الحالي. إذا
  // أُضيف لاحقاً دفع إلكتروني/عبر البطاقة، يجب تصفية هذا الاستعلام بعمود
  // payment_method جديد (migration إضافية) قبل الاعتماد عليه فعلياً.
  const { data: completedOrders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('total_amount')
    .eq('restaurant_id', shift.restaurant_id)
    .eq('status', 'completed')
    .gte('created_at', shift.opened_at)
    .lte('created_at', closedAt.toISOString());

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  const ordersTotal = (completedOrders ?? []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const expectedClosingCash = Number(shift.opening_cash) + ordersTotal;
  const variance = actualClosingCash - expectedClosingCash;

  const { data: updatedShift, error: updateError } = await supabaseAdmin
    .from('cashier_shifts')
    .update({
      actual_closing_cash: actualClosingCash,
      expected_closing_cash: expectedClosingCash,
      variance,
      status: 'closed',
      closed_at: closedAt.toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await logStaffAction({
    restaurant_id: shift.restaurant_id,
    staff_id: shift.staff_id,
    action_type: 'shift_close',
    entity_type: 'cashier_shift',
    entity_id: shift.id,
    before_data: { opening_cash: shift.opening_cash, status: 'open' },
    after_data: { expected_closing_cash: expectedClosingCash, actual_closing_cash: actualClosingCash, variance },
  });

  if (Math.abs(variance) > VARIANCE_ALERT_THRESHOLD) {
    await notifyOwnerPush(shift.restaurant_id, {
      title: 'فرق كاش عند إغلاق وردية',
      body: `فرق قدره ${variance.toFixed(2)} عند إغلاق الوردية (المتوقع ${expectedClosingCash.toFixed(2)}، الفعلي ${actualClosingCash.toFixed(2)})`,
      url: '/admin/dashboard',
      tag: 'shift-variance',
    });
  }

  const zReport = {
    orders_count: completedOrders?.length ?? 0,
    orders_total: ordersTotal,
    opening_cash: Number(shift.opening_cash),
    expected_closing_cash: expectedClosingCash,
    actual_closing_cash: actualClosingCash,
    variance,
  };

  return NextResponse.json({ shift: updatedShift, z_report: zReport });
}
