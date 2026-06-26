import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import HomeClient from '@/app/home/HomeClient';

export const revalidate = 60; // يعيد بناء الصفحة كل 60 ثانية على السيرفر

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

  return (
    <HomeClient
      initialCategories={categories || []}
      initialItems={items || []}
      restaurantId={restaurant.id}
      restaurantSlug={slug}
    />
  );
}
