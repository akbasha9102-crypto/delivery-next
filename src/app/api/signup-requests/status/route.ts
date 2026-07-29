import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/signup-requests/status?phone=...&username=... — عام بالكامل،
// يتطلب تطابق الهاتف واسم المستخدم معاً قبل إرجاع أي شيء. عند عدم
// التطابق نُرجع "غير موجود" عام دون تفصيل أي حقل كان غير مطابق (نفس
// موقف عدم كشف التفاصيل المتبع بـ resolve-login).
export async function GET(req: NextRequest) {
  const phone    = req.nextUrl.searchParams.get('phone')?.trim() ?? '';
  const username = req.nextUrl.searchParams.get('username')?.trim().toLowerCase() ?? '';

  if (!phone || !username) {
    return NextResponse.json({ error: 'رقم الهاتف واسم المستخدم مطلوبان' }, { status: 400 });
  }

  const { data } = await supabaseAdmin
    .from('account_creation_requests')
    .select('status, created_at, linked_restaurant_id')
    .eq('phone', phone)
    .ilike('username', username)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: 'لم يتم العثور على طلب مطابق' }, { status: 404 });
  }

  // "approved" تعني فقط أن السوبر أدمن وافق مبدئياً — ربط المطعم الفعلي
  // (linked_restaurant_id) خطوة ثانية منفصلة يدوية قد لا تكتمل فوراً. بدون
  // تمييزهما يرى الزبون "حسابك جاهز، سجّل دخولك" قبل أن يكون فعلاً جاهزاً
  // فتفشل محاولة الدخول برسالة غامضة (خطأ #20 بتقرير الفحص).
  return NextResponse.json({ status: data.status, created_at: data.created_at, linked: !!data.linked_restaurant_id });
}
