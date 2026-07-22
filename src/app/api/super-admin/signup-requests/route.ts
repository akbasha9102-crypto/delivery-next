import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

// GET — قائمة طلبات إنشاء الحساب
export async function GET() {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('account_creation_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ requests: data ?? [] });
}

// PATCH — قبول أو رفض طلب
export async function PATCH(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, action } = await req.json().catch(() => ({}));

  if (!id || !action) {
    return NextResponse.json({ error: 'id و action مطلوبان' }, { status: 400 });
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action غير صالح' }, { status: 400 });
  }

  const { data: request, error: fetchError } = await supabaseAdmin
    .from('account_creation_requests')
    .select('id, status, auth_user_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!request)   return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'تم التعامل مع هذا الطلب مسبقاً' }, { status: 409 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const { error: updateError } = await supabaseAdmin
    .from('account_creation_requests')
    .update({ status: newStatus })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (action === 'reject' && request.auth_user_id) {
    await supabaseAdmin.auth.admin.deleteUser(request.auth_user_id).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
