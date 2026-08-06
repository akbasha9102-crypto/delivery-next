import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isRestaurantSuspended } from '@/lib/auth/staff-auth';
import { getClientIp, isRateLimited, recordAttempt } from '@/lib/utils/rate-limit';

type EditItem = { item_id: string | null; item_name: string; quantity: number; price: number };
type EditBody = { order_id?: string; client_phone?: string; items?: EditItem[] };

// POST /api/track/edit — تعديل طلب توصيل (order_type='delivery') من صفحة تتبع
// الزبون العامة. لا يلمس order_items مباشرة — يُنشئ صف order_edits بحالة
// 'pending' وحسب، وينتظر مراجعة/قبول الكاشير من لوحة التحكم قبل أن يُطبَّق
// فعلياً على الطلب الحي (نفس نمط /api/track: service-role على الخادم، بلا
// أي RLS مباشر لـ anon، والتحقق من الهوية عبر رقم الهاتف المطابق للطلب).
export async function POST(req: NextRequest) {
  let body: EditBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const { order_id, client_phone, items } = body;

  if (!order_id || !client_phone) {
    return Response.json({ error: 'order_id و client_phone مطلوبان' }, { status: 400 });
  }

  const ip = getClientIp(req);
  if (await isRateLimited('track_edit', ip, 20, 10 * 60 * 1000)) {
    return Response.json({ error: 'محاولات كثيرة جداً، حاول لاحقاً' }, { status: 429 });
  }
  await recordAttempt('track_edit', ip);

  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'يجب اختيار صنف واحد على الأقل' }, { status: 400 });
  }

  for (const it of items) {
    if (!it || typeof it.item_name !== 'string' || !it.item_name.trim()) {
      return Response.json({ error: 'اسم الصنف مطلوب لكل عنصر' }, { status: 400 });
    }
    if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 50) {
      return Response.json({ error: 'الكمية يجب أن تكون بين 1 و50' }, { status: 400 });
    }
    if (!Number.isFinite(it.price) || it.price < 0) {
      return Response.json({ error: 'سعر غير صالح لأحد العناصر' }, { status: 400 });
    }
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, restaurant_id, status, order_type, client_phone, total_amount, pending_edit_id, discount_amount')
    .eq('id', order_id)
    .maybeSingle();

  if (orderError) return Response.json({ error: orderError.message }, { status: 500 });
  if (!order) return Response.json({ error: 'الطلب غير موجود' }, { status: 404 });

  if (order.client_phone !== client_phone) {
    return Response.json({ error: 'رقم الهاتف غير مطابق' }, { status: 403 });
  }

  if (order.order_type !== 'delivery') {
    return Response.json({ error: 'التعديل من صفحة التتبع متاح فقط لطلبات التوصيل' }, { status: 409 });
  }

  if (!['pending', 'preparing'].includes(order.status)) {
    return Response.json({ error: 'لا يمكن تعديل الطلب بهذه المرحلة' }, { status: 409 });
  }

  if (order.pending_edit_id) {
    return Response.json({ error: 'يوجد تعديل سابق بانتظار موافقة المطعم' }, { status: 409 });
  }

  if ((order.discount_amount ?? 0) > 0) {
    return Response.json({ error: 'لا يمكن تعديل طلب فيه خصم مطبّق — تواصل مع المطعم مباشرة' }, { status: 409 });
  }

  // زبون واحد = تعديل واحد فقط طوال عمر الطلب، بغض النظر عن نتيجته (قُبِل/
  // رُفِض) — الحد لا يشمل تعديلات الكاشير (edited_by='cashier') من لوحة
  // التحكم، فقط تعديلات الزبون من هذه الصفحة العامة.
  const { data: priorCustomerEdit, error: priorEditError } = await supabaseAdmin
    .from('order_edits')
    .select('id')
    .eq('order_id', order_id)
    .eq('edited_by', 'customer')
    .limit(1)
    .maybeSingle();

  if (priorEditError) return Response.json({ error: priorEditError.message }, { status: 500 });
  if (priorCustomerEdit) {
    return Response.json({ error: 'يمكنك تعديل الطلب مرة واحدة فقط' }, { status: 409 });
  }

  // تحقق من أن المطعم غير موقوف — نفس شرط is_restaurant_active() المستخدَم
  // بسياسات RLS لإنشاء الطلبات (20260720090000_suspend_restaurant_enforcement.sql).
  if (await isRestaurantSuspended(order.restaurant_id)) {
    return Response.json({ error: 'هذا المطعم متوقف مؤقتاً عن استقبال الطلبات' }, { status: 409 });
  }

  const { data: currentItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('item_id, item_name, quantity, price')
    .eq('order_id', order_id);

  if (itemsError) return Response.json({ error: itemsError.message }, { status: 500 });

  // لا نثق بسعر العنصر المُرسَل من الزبون (غير موثَّق) — نتحقق من السعر الحيّ
  // بجدول items لكل عنصر وله item_id، ونستخدمه بدلاً من سعر الطلب. زبون
  // لا يملك أي طريقة مشروعة لإرسال صنف مخصَّص/خارج القائمة عبر هذا المسار
  // (خلافاً لتدفق الكاشير الخاص بنقطة البيع الذي قد يحوي أصنافاً احتياطية
  // مُصطنَعة لطلبات موجودة سلفاً تشير لأصناف محذوفة — سيناريو مختلف تماماً
  // وغير ذي صلة هنا).
  if (items.some(i => !i.item_id)) {
    return Response.json({ error: 'صنف غير موجود بقائمة الطعام' }, { status: 400 });
  }

  const itemIds = [...new Set(items.map(i => i.item_id as string))];
  const { data: liveItems, error: liveItemsError } = await supabaseAdmin
    .from('items')
    .select('id, price')
    .in('id', itemIds)
    .eq('restaurant_id', order.restaurant_id);

  if (liveItemsError) return Response.json({ error: liveItemsError.message }, { status: 500 });

  const livePriceById = new Map((liveItems || []).map(i => [i.id, Number(i.price)]));
  if (itemIds.some(id => !livePriceById.has(id))) {
    return Response.json({ error: 'صنف غير موجود بقائمة الطعام' }, { status: 400 });
  }

  const verifiedItems = items.map(i => ({
    ...i,
    price: livePriceById.get(i.item_id as string) as number,
  }));

  const newTotal = verifiedItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const { data: edit, error: editError } = await supabaseAdmin
    .from('order_edits')
    .insert({
      order_id,
      restaurant_id: order.restaurant_id,
      edited_by: 'customer',
      status: 'pending',
      previous_items: currentItems || [],
      new_items: verifiedItems,
      previous_total: order.total_amount,
      new_total: newTotal,
    })
    .select('id')
    .single();

  if (editError) {
    // انتهاك القيد الفريد الجزئي idx_order_edits_one_pending_per_order —
    // سباق نادر بين فحص pending_edit_id أعلاه وهذا الإدراج (مثلاً تبويبان
    // مفتوحان بنفس الجهاز). نعرض نفس رسالة الفحص المسبق بدل خطأ 500 عام.
    if ((editError as { code?: string }).code === '23505') {
      return Response.json({ error: 'يوجد تعديل سابق بانتظار موافقة المطعم' }, { status: 409 });
    }
    return Response.json({ error: editError.message || 'تعذّر حفظ طلب التعديل' }, { status: 500 });
  }
  if (!edit) {
    return Response.json({ error: 'تعذّر حفظ طلب التعديل' }, { status: 500 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ pending_edit_id: edit.id })
    .eq('id', order_id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true, pending_edit_id: edit.id });
}
