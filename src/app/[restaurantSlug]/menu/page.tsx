import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import HomeClient from '@/app/home/HomeClient';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabase as anonClient } from '@/lib/supabase/client';

// ISR برقم صريح بدل force-dynamic (بطيء دائماً) أو الافتراضي المحذوف (revalidate=false
// = كاش بلا نهاية عبر عمليات نشر Vercel، وهو السبب الأرجح لمشكلة الـ404 القديمة الملتصقة —
// راجع: عملاء Supabase هنا يستخدمون fetch العام الذي يعترضه Next تلقائياً بالكاش).
// رقم صريح ⇒ شفاء ذاتي تلقائي خلال 30 ثانية كحد أقصى مهما حدث، بدل تعليق أبدي.
export const revalidate = 30;

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

type Props = { params: Promise<{ restaurantSlug: string }> };

// "الأكثر مبيعاً" مفصول بكاش مستقل بمهلة أطول (10 دقائق): هو الجزء الثقيل حسابياً
// (استعلامان متتاليان + تجميع بالذاكرة)، ولا يحتاج دقة أعلى من دقائق قليلة.
// فصله عن revalidate=30 الخاص بالصفحة يعني أن إعادة الحساب الثقيلة تحدث مرة كل
// 10 دقائق لكل مطعم فقط، لا كل 30 ثانية ولا كل تنقل.
const getBestSellerItemIds = unstable_cache(
  async (restaurantId: string): Promise<string[]> => {
    const since = daysAgoISO(60);
    const { data: recentOrders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'completed')
      .gte('created_at', since)
      .limit(1000);

    const orderIds = (recentOrders || []).map((o) => o.id as string);
    if (orderIds.length === 0) return [];

    const { data: orderItems } = await supabaseAdmin
      .from('order_items')
      .select('item_id, quantity')
      .in('order_id', orderIds)
      .not('item_id', 'is', null);

    const qtyByItem = new Map<string, number>();
    (orderItems || []).forEach((row) => {
      const id = row.item_id as string | null;
      if (!id) return;
      qtyByItem.set(id, (qtyByItem.get(id) || 0) + (row.quantity as number));
    });

    return [...qtyByItem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);
  },
  ['best-seller-item-ids'],
  { revalidate: 600 }
);

export default async function MenuPage({ params }: Props) {
  const { restaurantSlug } = await params;

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', restaurantSlug)
    .maybeSingle();

  if (restaurantError) {
    // خطأ حقيقي (مفتاح خاطئ، مشكلة اتصال...) يجب أن يظهر كخطأ سيرفر
    // وليس صفحة 404 مضلِّلة تخفي المشكلة الحقيقية
    throw new Error(`Failed to fetch restaurant "${restaurantSlug}": ${restaurantError.message}`);
  }
  if (!restaurant) notFound();

  // مطعم محذوف منطقياً (أرشفة من super-admin) — يُخفى نهائياً من الرابط
  // العام، نفس سلوك مطعم غير موجود إطلاقاً.
  const { data: settingsRow } = await supabaseAdmin
    .from('restaurant_settings')
    .select('show_best_sellers, is_deleted')
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();

  if (settingsRow?.is_deleted) notFound();

  const [{ data: categories }, { data: items }] = await Promise.all([
    anonClient
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order', { ascending: true, nullsFirst: false }),
    anonClient
      .from('items')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('name'),
  ]);

  const showBestSellers = settingsRow?.show_best_sellers ?? true;
  const bestSellerItemIds = showBestSellers
    ? await getBestSellerItemIds(restaurant.id)
    : [];

  return (
    <HomeClient
      initialCategories={categories || []}
      initialItems={items || []}
      restaurantId={restaurant.id}
      restaurantSlug={restaurantSlug}
      showBestSellers={showBestSellers}
      bestSellerItemIds={bestSellerItemIds}
    />
  );
}
