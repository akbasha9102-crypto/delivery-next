import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import HomeClient from '@/app/home/HomeClient';

type Props = { params: Promise<{ slug: string }> };

export default async function MenuPage({ params }: Props) {
  const { slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // البحث عن المطعم بالـ slug
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!restaurant) notFound();

  // جلب فئات وأصناف هذا المطعم فقط
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order', { ascending: true, nullsFirst: false }),
    supabase
      .from('items')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('name'),
  ]);

  return (
    <HomeClient
      initialCategories={categories || []}
      initialItems={items || []}
      restaurantId={restaurant.id}
      restaurantSlug={slug}
    />
  );
}
