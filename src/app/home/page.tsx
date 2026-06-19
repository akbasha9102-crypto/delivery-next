import { createClient } from '@supabase/supabase-js';
import HomeClient from './HomeClient';

export default async function HomePage() {
  let categories: { id: string; name: string; color?: string; card_color?: string; color_dark?: string; card_color_dark?: string }[] = [];
  let items: { id: string; name: string; price: number; description: string; image_url: string | null; category_id: string; is_available: boolean; item_status?: string; extras_json?: string }[] = [];

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const [{ data: cats }, { data: its }] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true, nullsFirst: false }),
      supabase.from('items').select('*').order('name'),
    ]);
    categories = cats || [];
    items = its || [];
  } catch {
    // سيتم الجلب من طرف العميل
  }

  return <HomeClient initialCategories={categories} initialItems={items} />;
}
