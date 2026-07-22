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
    .select('status, created_at')
    .eq('phone', phone)
    .ilike('username', username)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: 'لم يتم العثور على طلب مطابق' }, { status: 404 });
  }

  return NextResponse.json({ status: data.status, created_at: data.created_at });
}
