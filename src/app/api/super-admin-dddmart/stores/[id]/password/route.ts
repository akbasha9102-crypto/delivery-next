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

// PATCH — إعادة تعيين كلمة مرور حساب أدمن المتجر (Auth password) فقط، لا شيء
// آخر. ملف منفصل عمداً عن [id]/route.ts (الذي يبدّل is_active فقط) حتى يبقى
// كل ملف بمسؤولية واحدة بحسب تصميم اللوحة المصغّرة.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { newPassword } = await req.json();

  if (typeof newPassword !== 'string' || !newPassword.trim()) {
    return NextResponse.json({ error: 'كلمة المرور الجديدة مطلوبة' }, { status: 400 });
  }
  const trimmedPassword = newPassword.trim();
  if (trimmedPassword.length < 6) {
    return NextResponse.json({ error: 'كلمة المرور قصيرة جداً، لازم تكون 6 أحرف على الأقل' }, { status: 400 });
  }

  const { data: store, error: storeError } = await dddmartAdmin
    .from('stores')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();
  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 500 });
  if (!store) return NextResponse.json({ error: 'المتجر غير موجود' }, { status: 404 });

  // نأخذ أقدم ملف تعريف admin بحسب created_at (= صاحب المتجر الأصلي) —
  // حماية دفاعية للحالة غير المتوقعة لوجود أكثر من admin واحد لنفس المتجر.
  const { data: adminProfiles, error: profilesError } = await dddmartAdmin
    .from('profiles')
    .select('id')
    .eq('store_id', id)
    .eq('role', 'admin')
    .order('created_at', { ascending: true });
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });
  if (!adminProfiles || adminProfiles.length === 0) {
    return NextResponse.json({ error: 'لا يوجد حساب أدمن لهذا المتجر' }, { status: 404 });
  }
  const adminProfileId = adminProfiles[0].id;

  const { data: userData, error: getUserError } = await dddmartAdmin.auth.admin.getUserById(adminProfileId);
  if (getUserError || !userData?.user?.email) {
    return NextResponse.json({ error: 'تعذّر جلب بيانات حساب الأدمن' }, { status: 500 });
  }
  const adminEmail = userData.user.email;

  const { error: updateError } = await dddmartAdmin.auth.admin.updateUserById(adminProfileId, {
    password: trimmedPassword,
  });
  if (updateError) {
    const msg = updateError.message.toLowerCase();
    if (msg.includes('password') && msg.includes('least')) {
      return NextResponse.json({ error: 'كلمة المرور قصيرة جداً، لازم تكون 6 أحرف على الأقل' }, { status: 400 });
    }
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث كلمة المرور' }, { status: 500 });
  }

  await logSuperAdminAction({
    action: 'dddmart_store_password_reset',
    details: { store_id: store.id, store_name: store.name, admin_email: adminEmail },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.json({ ok: true, adminEmail });
}
