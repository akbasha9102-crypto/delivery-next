import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyPin } from '@/lib/staff-auth';

// عدد المحاولات الخاطئة المتتالية قبل القفل المؤقت (Soft Lock)، ومدة القفل.
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

// ملاحظة أمن مهمة للفريق: العقد هنا { restaurant_id, pin } فقط (بدون
// تعريف مسبق لهوية الموظف)، لذلك عند PIN خاطئ لا نعرف تقنياً "لمن" كانت
// المحاولة — الـ hash لا يكشف تطابقاً جزئياً. الحل المطبَّق: نجرّب الـ PIN
// ضد كل موظف نشط غير مقفل بهذا المطعم؛ إذا لم يطابق أي أحد، تُحتسب محاولة
// فاشلة على **كل** الموظفين النشطين غير المقفلين بهذا المطعم دفعة واحدة
// (قفل جماعي مؤقت بدل قفل فردي دقيق). هذا trade-off معروف لتصميم
// "PIN بدون اسم مستخدم" المعتمد بالخطة (قسم 2) — يستحق مراجعة أمنية:
// يمكن لأي شخص يطلب إغلاق كل الكاشيرية مؤقتاً بإدخال PIN خاطئ 5 مرات.
export async function POST(req: NextRequest) {
  let body: { restaurant_id?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { restaurant_id, pin } = body;
  if (!restaurant_id || !pin) {
    return NextResponse.json({ error: 'restaurant_id و pin مطلوبان' }, { status: 400 });
  }

  const now = new Date();

  const { data: staffList, error } = await supabaseAdmin
    .from('restaurant_staff')
    .select('id, display_name, role, pin_hash, max_discount_pct, max_void_amount, is_active, locked_until')
    .eq('restaurant_id', restaurant_id)
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: 'خطأ بجلب بيانات الموظفين' }, { status: 500 });
  }

  const allActive = staffList ?? [];
  const unlocked = allActive.filter((s) => !s.locked_until || new Date(s.locked_until) <= now);

  // كل الموظفين النشطين مقفلون حالياً — لا داعي لتجربة الـ PIN إطلاقاً
  if (allActive.length > 0 && unlocked.length === 0) {
    const soonestUnlock = allActive
      .map((s) => s.locked_until)
      .filter(Boolean)
      .sort()[0];
    return NextResponse.json(
      { error: 'الحساب مقفل مؤقتاً بسبب محاولات خاطئة متكررة', locked_until: soonestUnlock },
      { status: 423 }
    );
  }

  const match = unlocked.find((s) => verifyPin(pin, s.pin_hash));

  if (match) {
    // نجاح: صفّر عدّاد المحاولات لهذا الموظف تحديداً
    await supabaseAdmin
      .from('restaurant_staff')
      .update({ failed_pin_attempts: 0, locked_until: null })
      .eq('id', match.id);

    return NextResponse.json({
      staff_id: match.id,
      display_name: match.display_name,
      role: match.role,
      max_discount_pct: match.max_discount_pct,
      max_void_amount: match.max_void_amount,
    });
  }

  // فشل: احتسب محاولة فاشلة على كل الموظفين النشطين غير المقفلين (راجع الملاحظة أعلى الملف)
  // نجلب العدّاد الحالي لكل موظف غير مقفل ونحدّثه
  const ids = unlocked.map((s) => s.id);
  if (ids.length > 0) {
    const { data: counters } = await supabaseAdmin
      .from('restaurant_staff')
      .select('id, failed_pin_attempts')
      .in('id', ids);

    for (const c of counters ?? []) {
      const nextAttempts = (c.failed_pin_attempts ?? 0) + 1;
      if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000).toISOString();
        await supabaseAdmin
          .from('restaurant_staff')
          .update({ failed_pin_attempts: 0, locked_until: lockedUntil })
          .eq('id', c.id);
      } else {
        await supabaseAdmin
          .from('restaurant_staff')
          .update({ failed_pin_attempts: nextAttempts })
          .eq('id', c.id);
      }
    }
  }

  return NextResponse.json({ error: 'PIN غير صحيح' }, { status: 401 });
}
