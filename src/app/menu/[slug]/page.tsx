import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import HomeClient from '@/app/home/HomeClient';

export const revalidate = 60; // يعيد بناء الصفحة كل 60 ثانية على السيرفر

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

type Props = { params: Promise<{ slug: string }> };

export default async function MenuPage({ params }: Props) {
  const { slug } = await params;

  // نستخدم service role للبحث عن المطعم (RLS مفعّل على جدول restaurants)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // البحث عن المطعم بالـ slug
  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!restaurant) notFound();

  // جلب فئات وأصناف هذا المطعم فقط
  const [{ data: categories }, { data: items }, { data: settings }] = await Promise.all([
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
    supabaseAdmin
      .from('restaurant_settings')
      .select('show_best_sellers')
      .eq('restaurant_id', restaurant.id)
      .maybeSingle(),
  ]);

  const showBestSellers = settings?.show_best_sellers ?? true;

  // أفضل 3 وجبات مبيعاً (حسب الكمية) من آخر 60 يوم من الطلبات المكتملة لهذا المطعم فقط
  let bestSellerItemIds: string[] = [];
  if (showBestSellers) {
    const since = daysAgoISO(60);
    const { data: recentOrders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .eq('status', 'completed')
      .gte('created_at', since)
      .limit(1000);

    const orderIds = (recentOrders || []).map((o) => o.id as string);
    if (orderIds.length > 0) {
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

      bestSellerItemIds = [...qtyByItem.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);
    }
  }

  return (
    <HomeClient
      initialCategories={categories || []}
      initialItems={items || []}
      restaurantId={restaurant.id}
      restaurantSlug={slug}
      showBestSellers={showBestSellers}
      bestSellerItemIds={bestSellerItemIds}
    />
  );
}
