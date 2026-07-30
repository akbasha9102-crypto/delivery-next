import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/orders/by-phone?phone=<phone> — سجل طلبات الزبون (آخر 30) + عناصرها.
// يستبدل قراءة anon المباشرة من orders/order_items (كانت RLS مفتوحة بالكامل
// USING(true) — ثغرة حرجة #2 بالمراجعة الأمنية). لا تُرجع سوى الطلبات المطابقة
// فعلياً لرقم الهاتف المُرسَل، بنفس شكل البيانات السابق.
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone');
  if (!phone) return Response.json({ error: 'phone مطلوب' }, { status: 400 });

  const { data: orders } = await supabaseAdmin
    .from('orders').select('*')
    .eq('client_phone', phone)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!orders || orders.length === 0) return Response.json({ orders: [], items: [] });

  const ids = orders.map(o => o.id);
  const { data: items } = await supabaseAdmin
    .from('order_items').select('*').in('order_id', ids);

  return Response.json({ orders, items: items ?? [] });
}
