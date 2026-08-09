import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { dddmartAdmin } from '@/lib/supabase/dddmart-admin';
import { getClientIp } from '@/lib/utils/rate-limit';
import { logSuperAdminAction } from '@/lib/utils/super-admin-audit-log';

// نفس فحص الجلسة المنسوخ (لا مشترك) بباقي مسارات super-admin-dddmart —
// راجع تعليق العزل بـ stores/route.ts.
async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

// PATCH — تبديل حالة اشتراك متجر dddmart (is_active) فقط، لا شيء آخر
// (لا تعديل اسم/slug/باقات هنا — عمداً بحسب تصميم اللوحة المصغّرة).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { isActive } = await req.json();

  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive (boolean) مطلوب' }, { status: 400 });
  }

  const { data: store, error: fetchError } = await dddmartAdmin
    .from('stores')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!store) return NextResponse.json({ error: 'المتجر غير موجود' }, { status: 404 });

  const { error: updateError } = await dddmartAdmin
    .from('stores')
    .update({ is_active: isActive })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await logSuperAdminAction({
    action: isActive ? 'dddmart_store_activated' : 'dddmart_store_suspended',
    details: { store_id: store.id, store_name: store.name },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
