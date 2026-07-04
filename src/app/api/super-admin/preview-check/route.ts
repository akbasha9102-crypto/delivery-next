import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const jar = await cookies();
  const preview = jar.get('sa_preview')?.value;
  const session = jar.get('sa_session')?.value;
  const previewRestaurantId = jar.get('sa_preview_restaurant')?.value;
  const expected = process.env.SUPER_ADMIN_SESSION_TOKEN;

  const ok = !!expected && preview === expected && session === expected;

  let restaurant: { id: string; name: string } | null = null;
  if (ok && previewRestaurantId) {
    const { data } = await supabaseAdmin
      .from('restaurants')
      .select('id, name')
      .eq('id', previewRestaurantId)
      .maybeSingle();
    restaurant = data ?? null;
  }

  return NextResponse.json({ ok: ok && !!restaurant, restaurant: restaurant ?? null });
}
