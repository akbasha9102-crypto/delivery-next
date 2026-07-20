import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notifyOwnerPush } from '@/lib/api/notify-owner-push';

async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

const MAX_TITLE = 120;
const MAX_BODY  = 2000;

// GET — سجل آخر الرسائل المُرسَلة
export async function GET() {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('super_admin_notifications')
    .select('id, restaurant_id, title, body, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

// POST — إرسال رسالة لمطعم محدد أو بث لكل المطاعم
export async function POST(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, body, restaurantId } = await req.json().catch(() => ({}));

  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  const trimmedBody  = typeof body  === 'string' ? body.trim()  : '';

  if (!trimmedTitle) return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 });
  if (!trimmedBody)  return NextResponse.json({ error: 'نص الرسالة مطلوب' }, { status: 400 });
  if (trimmedTitle.length > MAX_TITLE) return NextResponse.json({ error: `العنوان أطول من ${MAX_TITLE} حرف` }, { status: 400 });
  if (trimmedBody.length  > MAX_BODY)  return NextResponse.json({ error: `النص أطول من ${MAX_BODY} حرف` },  { status: 400 });

  let targetRestaurantId: string | null = null;
  if (restaurantId !== null && restaurantId !== undefined) {
    if (typeof restaurantId !== 'string') {
      return NextResponse.json({ error: 'restaurantId غير صالح' }, { status: 400 });
    }
    const { data: exists } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .maybeSingle();
    if (!exists) return NextResponse.json({ error: 'المطعم غير موجود' }, { status: 404 });
    targetRestaurantId = restaurantId;
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('super_admin_notifications')
    .insert({ restaurant_id: targetRestaurantId, title: trimmedTitle, body: trimmedBody })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (targetRestaurantId) {
    await notifyOwnerPush(targetRestaurantId, { title: trimmedTitle, body: trimmedBody, url: '/admin/settings', tag: 'super-admin-msg' }).catch(() => {});
  } else {
    const { data: allRestaurants } = await supabaseAdmin.from('restaurants').select('id');
    await Promise.allSettled(
      (allRestaurants ?? []).map(r =>
        notifyOwnerPush(r.id, { title: trimmedTitle, body: trimmedBody, url: '/admin/settings', tag: 'super-admin-msg' })
      )
    );
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
