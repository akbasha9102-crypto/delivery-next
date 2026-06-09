import { createClient } from '@supabase/supabase-js';
import HomeClient from './HomeClient';

const supabase = createClient(
  'https://gbmwrvnmvobvieembxmf.supabase.co',
  'sb_publishable_DB8lKUjdnAah-jNbpFV22w_7Id2Eggr'
);

export const revalidate = 0;

export default async function HomePage() {
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order', { ascending: true, nullsFirst: false }),
    supabase.from('items').select('*').order('name'),
  ]);

  return (
    <HomeClient
      initialCategories={categories || []}
      initialItems={items || []}
    />
  );
}
