import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getClientIp, isRateLimited, recordAttempt } from '@/lib/utils/rate-limit';

// GET /api/track?id=<orderId>    — طلب واحد بمعرّفه (رابط التتبع مباشرة بعد الطلب)
// GET /api/track?phone=<phone>   — آخر طلب نشط، وإلا آخر طلب مكتمل خلال 24 ساعة، لهذا الرقم
//
// يستبدل قراءة anon المباشرة من جدول orders (كانت محمية بسياسة RLS مفتوحة
// بالكامل USING(true) تسمح بتفريغ REST مباشرة لكل طلبات كل الزبائن بكل
// المطاعم — ثغرة حرجة #2 بالمراجعة الأمنية). القراءة هنا تمر بمفتاح service-role
// على الخادم، ولا تُرجع سوى الصف المطابق فعلياً لما أرسله المستخدم (معرّف طلب
// يملكه بالفعل، أو رقم هاتفه) — نفس شكل البيانات والسلوك السابق تماماً، بلا
// أي إمكانية لتعداد/تفريغ الجدول بدون معرفة مسبقة بأحدهما.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const phone = req.nextUrl.searchParams.get('phone');

  if (id) {
    const { data } = await supabaseAdmin.from('orders').select('*, order_items(item_id, item_name, quantity, price)').eq('id', id).maybeSingle();
    if (!data) return Response.json({ order: null });
    const { data: priorEdit } = await supabaseAdmin.from('order_edits').select('id').eq('order_id', data.id).eq('edited_by', 'customer').limit(1).maybeSingle();
    return Response.json({ order: { ...data, has_used_customer_edit: !!priorEdit } });
  }

  if (phone) {
    const ip = getClientIp(req);
    if (await isRateLimited('track_lookup_by_phone', ip, 20, 10 * 60 * 1000)) {
      return Response.json({ error: 'محاولات كثيرة جداً، حاول لاحقاً' }, { status: 429 });
    }
    await recordAttempt('track_lookup_by_phone', ip);

    const { data: active } = await supabaseAdmin
      .from('orders').select('*, order_items(item_id, item_name, quantity, price)')
      .eq('client_phone', phone)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (active) {
      const { data: priorEdit } = await supabaseAdmin.from('order_edits').select('id').eq('order_id', active.id).eq('edited_by', 'customer').limit(1).maybeSingle();
      return Response.json({ order: { ...active, has_used_customer_edit: !!priorEdit } });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: completed } = await supabaseAdmin
      .from('orders').select('*, order_items(item_id, item_name, quantity, price)')
      .eq('client_phone', phone)
      .eq('status', 'completed')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (!completed) return Response.json({ order: null });
    const { data: priorEdit } = await supabaseAdmin.from('order_edits').select('id').eq('order_id', completed.id).eq('edited_by', 'customer').limit(1).maybeSingle();
    return Response.json({ order: { ...completed, has_used_customer_edit: !!priorEdit } });
  }

  return Response.json({ error: 'id أو phone مطلوب' }, { status: 400 });
}
