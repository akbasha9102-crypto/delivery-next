import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { RESERVED_RESTAURANT_SLUGS, MIN_STAFF_PASSWORD_LENGTH } from '@/lib/auth/staff-auth';
import { getClientIp } from '@/lib/utils/rate-limit';
import { logSuperAdminAction } from '@/lib/utils/super-admin-audit-log';

async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

function generateSlug(name: string, suffix?: string): string {
  const base = name.replace(/^مطعم\s*/u, '').trim();
  const latin = base.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().trim();
  if (latin.length >= 2) return latin.replace(/\s+/g, '-');
  if (suffix) return suffix.toLowerCase().replace(/\s+/g, '-');
  return `restaurant-${Date.now()}`;
}

// الإيميل الداخلي مولود من الـ slug — لا يُعرض للمستخدم أبداً
function slugToEmail(slug: string) {
  return `${slug}@dasha.app`;
}

// GET — قائمة المطاعم
export async function GET() {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // دمج معلومات صاحب المطعم الخاصة (اسم/هاتف) — جدول منفصل بلا أي سياسة
  // RLS عامة، يُقرأ هنا فقط عبر service role داخل route محمي بـ isAuthed().
  const { data: contacts } = await supabaseAdmin
    .from('restaurant_owner_contacts')
    .select('restaurant_id, owner_name, owner_phone');

  const contactMap = new Map((contacts ?? []).map(c => [c.restaurant_id, c]));
  const restaurants = (data ?? []).map(r => ({
    ...r,
    owner_name:  contactMap.get(r.id)?.owner_name  ?? null,
    owner_phone: contactMap.get(r.id)?.owner_phone ?? null,
  }));

  return NextResponse.json({ restaurants });
}

// زرع restaurant_settings + inventory_categories الافتراضية لمطعم جديد —
// مشتركة بين مسار الإنشاء المستقل ومسار الربط (signupRequestId). ترجع رسالة
// خطأ واضحة إن فشل أي إدراج بدل الفشل الصامت (خطأ #10 بتقرير الفحص).
async function seedNewRestaurant(restaurantId: string, name: string): Promise<string | null> {
  const { error: settingsError } = await supabaseAdmin.from('restaurant_settings').insert({
    restaurant_name: name,
    restaurant_id: restaurantId,
    subscription_start: new Date().toISOString(),
    is_suspended: false,
  });
  if (settingsError) return `تعذّر إنشاء إعدادات المطعم: ${settingsError.message}`;

  // زرع فئات المخزون الافتراضية للمطعم الجديد (نفس الفئات المزروعة
  // للمطاعم الموجودة بـ migration 20260715090000_inventory_categories_system_seed)
  const { error: categoriesError } = await supabaseAdmin.from('inventory_categories').insert([
    { restaurant_id: restaurantId, name: 'عام',      color: '#64748b', is_active: true, is_system: true, sort_order: 0 },
    { restaurant_id: restaurantId, name: 'مشروبات',  color: '#3b82f6', is_active: true, is_system: true, sort_order: 1 },
    { restaurant_id: restaurantId, name: 'لحوم',     color: '#ef4444', is_active: true, is_system: true, sort_order: 2 },
    { restaurant_id: restaurantId, name: 'خبز',      color: '#a16207', is_active: true, is_system: true, sort_order: 3 },
    { restaurant_id: restaurantId, name: 'خضار',     color: '#22c55e', is_active: true, is_system: true, sort_order: 4 },
    { restaurant_id: restaurantId, name: 'توابل',    color: '#eab308', is_active: true, is_system: true, sort_order: 5 },
    { restaurant_id: restaurantId, name: 'زيوت',     color: '#a855f7', is_active: true, is_system: true, sort_order: 6 },
    { restaurant_id: restaurantId, name: 'تغليف',    color: '#14b8a6', is_active: true, is_system: true, sort_order: 7 },
  ]);
  if (categoriesError) return `تعذّر إنشاء فئات المخزون الافتراضية: ${categoriesError.message}`;

  return null;
}

// POST — إنشاء مطعم جديد، بوضعين:
//  1) مستقل (بدون signupRequestId): يُنشئ حساب Auth جديد بالكامل، يتطلب
//     password — هذا هو السلوك الأصلي، بلا أي تغيير.
//  2) مربوط (signupRequestId): إعادة استخدام حساب Auth "الخامل" الذي
//     أُنشئ مسبقاً عند التقديم بـ /signup (انظر migration
//     20260725100000) بدل إنشاء حساب جديد قد يتصادم أو يُهدر الحساب
//     الحقيقي الذي اختار العميل كلمة سره فيه بنفسه. password غير مطلوب
//     هنا لأن كلمة السر موجودة أصلاً بـ Supabase Auth ولا تُطلب أبداً من
//     سوبر أدمن (نلتزم بقاعدة عدم تخزين/تمرير كلمات السر — راجع خلفية
//     migration 20260725100000).
export async function POST(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, slug: customSlug, password, signupRequestId } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: 'name مطلوب' }, { status: 400 });

  const slug  = (customSlug?.trim() || generateSlug(name.trim())).toLowerCase().replace(/\s+/g, '-');
  const email = slugToEmail(slug);

  // slug يصبح أول segment بالرابط العام (mashee.net/<slug>/menu) — يجب ألا
  // يصطدم بأسماء مجلدات ثابتة على مستوى جذر src/app (مثل admin, api, menu...).
  if (RESERVED_RESTAURANT_SLUGS.has(slug)) {
    return NextResponse.json({ error: `الـ slug "${slug}" محجوز ولا يمكن استخدامه` }, { status: 409 });
  }

  // ── وضع الربط: signupRequestId موجود ──────────────────────────────────
  if (signupRequestId) {
    const { data: signupRequest, error: fetchError } = await supabaseAdmin
      .from('account_creation_requests')
      .select('id, status, username, auth_user_id, linked_restaurant_id, full_name, phone')
      .eq('id', signupRequestId)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!signupRequest) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    if (signupRequest.status !== 'approved') {
      return NextResponse.json({ error: 'يجب قبول الطلب أولاً' }, { status: 400 });
    }
    if (signupRequest.linked_restaurant_id) {
      // حارس منع الازدواج: يحمي من نقرتين متزامنتين (تبويبين مفتوحين مثلاً)
      // يحاولان ربط نفس الطلب بمطعمين مختلفين.
      return NextResponse.json({ error: 'هذا الطلب مرتبط بمطعم مسبقاً' }, { status: 409 });
    }
    if (!signupRequest.auth_user_id) {
      // صفوف قديمة سابقة لـ migration 20260725100000 لا تملك حساب Auth
      // خامل لإعادة استخدامه — لا يوجد ما يُربَط.
      return NextResponse.json({ error: 'هذا الطلب لا يملك حساب مرتبط قابلاً للربط، استخدم الإنشاء المستقل' }, { status: 400 });
    }

    const ownerId = signupRequest.auth_user_id;

    // نفس فحوصات التصادم بالمسار المستقل
    const { data: existing } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: `اسم المستخدم "${slug}" مستخدم بالفعل` }, { status: 409 });
    }
    const { data: staffClash } = await supabaseAdmin.from('user_roles').select('id').ilike('code', slug).maybeSingle();
    if (staffClash) {
      return NextResponse.json({ error: `اسم المستخدم "${slug}" مستخدم بالفعل` }, { status: 409 });
    }

    // لو الأدمن غيّر الـ slug عن اسم المستخدم الأصلي المحجوز عند التسجيل،
    // يجب تحديث إيميل حساب Auth ليطابق — Auth أولاً (نفس ترتيب PATCH
    // بهذا الملف): لو فشل، نتوقف قبل أي كتابة بالداتابيس.
    let emailChanged = false;
    if (slug !== signupRequest.username) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(ownerId, { email });
      if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
      emailChanged = true;
    }

    // إنشاء المطعم في جدول restaurants
    const { data: restaurant, error: restError } = await supabaseAdmin
      .from('restaurants')
      .insert({ name: name.trim(), slug, owner_id: ownerId })
      .select()
      .single();

    if (restError) {
      // لا نحذف الحساب هنا إطلاقاً تحت أي ظرف — هذا حساب العميل الحقيقي
      // الحي، وليس حساباً أُنشئ للتو بهذا الطلب (كما بالمسار المستقل).
      // نكتفي بمحاولة إرجاع الإيميل كما كان (best-effort) ونترك
      // linked_restaurant_id فارغاً ليعيد الأدمن المحاولة بأمان.
      if (emailChanged) {
        try { await supabaseAdmin.auth.admin.updateUserById(ownerId, { email: slugToEmail(signupRequest.username!) }); } catch { /* best-effort rollback */ }
      }
      return NextResponse.json({ error: restError.message }, { status: 500 });
    }

    const seedError = await seedNewRestaurant(restaurant.id, name.trim());

    // حفظ بيانات تواصل صاحب المطعم التي التُقطت أصلاً عند التسجيل —
    // يوفر على الأدمن إعادة كتابتها يدوياً (نفس جدول/نمط PATCH بهذا الملف).
    await supabaseAdmin.from('restaurant_owner_contacts').upsert(
      { restaurant_id: restaurant.id, owner_name: signupRequest.full_name, owner_phone: signupRequest.phone },
      { onConflict: 'restaurant_id' },
    );

    // هذا التحديث هو ما يمنع تكرار الربط لاحقاً (الحارس بالسطر 120 أعلاه) —
    // إن فشل هذا التحديث تحديداً بعد نجاح إنشاء المطعم، الحارس لن يعمل بالمحاولة
    // التالية وقد يُنشأ مطعم مكرر لنفس الحساب لو أعاد الأدمن المحاولة ظناً منه
    // أنها فشلت بالكامل (خطأ #21 بتقرير الفحص). نُرجع خطأ صريحاً بدل الاستمرار بصمت.
    const { error: linkError } = await supabaseAdmin
      .from('account_creation_requests')
      .update({ linked_restaurant_id: restaurant.id, linked_at: new Date().toISOString() })
      .eq('id', signupRequestId);

    if (linkError) {
      return NextResponse.json({
        error: `المطعم "${restaurant.name}" (${slug}) أُنشئ بنجاح فعلياً، لكن تعذّر تسجيل ربطه بطلب التسجيل: ${linkError.message} — لا تُعِد المحاولة (سيُنشئ مطعماً مكرراً)، بل حدّث linked_restaurant_id يدوياً لهذا الطلب بمعرّف المطعم ${restaurant.id}`,
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
      username: slug,
      ...(seedError ? { warning: `المطعم أُنشئ بنجاح لكن: ${seedError} — راجع إعدادات/مخزون المطعم يدوياً` } : {}),
    });
  }

  // ── الوضع المستقل: بدون signupRequestId (السلوك الأصلي، بلا تغيير) ────
  if (!password?.trim()) return NextResponse.json({ error: 'password مطلوب' }, { status: 400 });

  // التحقق من أن الـ slug غير مكرر
  const { data: existing } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: `اسم المستخدم "${slug}" مستخدم بالفعل` }, { status: 409 });
  }

  // نفس اسم المستخدم قد يكون مستخدَماً كـ code موظف بمطعم آخر (user_roles) —
  // الإيميلان الداخليان مختلفان (dasha.app مقابل cashier.dasha.app) لكن
  // slug/code يُعرَضان للمستخدم كاسم دخول واحد، فيجب منع التصادم البصري.
  const { data: staffClash } = await supabaseAdmin.from('user_roles').select('id').ilike('code', slug).maybeSingle();
  if (staffClash) {
    return NextResponse.json({ error: `اسم المستخدم "${slug}" مستخدم بالفعل` }, { status: 409 });
  }

  // إنشاء حساب Auth في Supabase
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: password.trim(),
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const ownerId = authData.user.id;

  // إنشاء المطعم في جدول restaurants
  const { data: restaurant, error: restError } = await supabaseAdmin
    .from('restaurants')
    .insert({ name: name.trim(), slug, owner_id: ownerId })
    .select()
    .single();

  if (restError) {
    await supabaseAdmin.auth.admin.deleteUser(ownerId);
    return NextResponse.json({ error: restError.message }, { status: 500 });
  }

  const seedError = await seedNewRestaurant(restaurant.id, name.trim());

  return NextResponse.json({
    ok: true,
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    username: slug,
    ...(seedError ? { warning: `المطعم أُنشئ بنجاح لكن: ${seedError} — راجع إعدادات/مخزون المطعم يدوياً` } : {}),
  });
}

// PATCH — تعديل slug أو كلمة مرور مطعم موجود
export async function PATCH(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { restaurantDbId, newSlug, newPassword, ownerName, ownerPhone, suspend, subscriptionTier } = await req.json();

  if (!restaurantDbId) {
    return NextResponse.json({ error: 'restaurantDbId مطلوب' }, { status: 400 });
  }
  const hasOwnerContactFields = ownerName !== undefined || ownerPhone !== undefined;
  const hasSuspendField = typeof suspend === 'boolean';
  const hasTierField = typeof subscriptionTier === 'string';
  if (!newSlug && !newPassword && !hasOwnerContactFields && !hasSuspendField && !hasTierField) {
    return NextResponse.json({ error: 'يجب تقديم newSlug أو newPassword أو ownerName/ownerPhone أو suspend أو subscriptionTier على الأقل' }, { status: 400 });
  }
  if (hasTierField && !['standard', 'professional'].includes(subscriptionTier)) {
    return NextResponse.json({ error: 'قيمة subscriptionTier غير صالحة' }, { status: 400 });
  }

  // جلب المطعم الحالي
  const { data: restaurant, error: fetchError } = await supabaseAdmin
    .from('restaurants')
    .select('id, slug, owner_id')
    .eq('id', restaurantDbId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!restaurant) return NextResponse.json({ error: 'المطعم غير موجود' }, { status: 404 });

  const ownerId: string = restaurant.owner_id;
  const authUpdates: { email?: string; password?: string } = {};

  // تحديث الـ slug إذا كان مختلفاً
  if (newSlug && newSlug !== restaurant.slug) {
    if (RESERVED_RESTAURANT_SLUGS.has(newSlug)) {
      return NextResponse.json({ error: `الـ slug "${newSlug}" محجوز ولا يمكن استخدامه` }, { status: 409 });
    }

    const { data: existing } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('slug', newSlug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: `اسم المستخدم "${newSlug}" مستخدم بالفعل` }, { status: 409 });
    }

    const { data: staffClash } = await supabaseAdmin.from('user_roles').select('id').ilike('code', newSlug).maybeSingle();
    if (staffClash) {
      return NextResponse.json({ error: `اسم المستخدم "${newSlug}" مستخدم بالفعل` }, { status: 409 });
    }

    authUpdates.email = slugToEmail(newSlug);
  }

  // تحديث كلمة المرور — كانت هذه أول نقطة بلا أي حد أدنى لطول كلمة المرور
  // بكامل الكودبيس (ثغرة حقيقية وليست مجرد محاذاة، راجع تقرير الفحص الأمني).
  if (newPassword) {
    if (String(newPassword).trim().length < MIN_STAFF_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `كلمة المرور يجب أن تكون ${MIN_STAFF_PASSWORD_LENGTH} أحرف/أرقام على الأقل` }, { status: 400 });
    }
    authUpdates.password = newPassword.trim();
  }

  // Auth أولاً — لو فشل نوقف قبل تغيير الداتابيس
  if (Object.keys(authUpdates).length > 0) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(ownerId, authUpdates);
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

    // سجل تدقيق: تغيير سوبر أدمن لبيانات دخول مالك مطعم (إيميل و/أو كلمة
    // مرور) — لا نُدرج قيمة كلمة المرور نفسها إطلاقاً هنا، فقط أسماء
    // الحقول التي تغيّرت (راجع تعليق super-admin-audit-log.ts).
    await logSuperAdminAction({
      action: 'restaurant_owner_credentials_changed',
      targetUserId: ownerId,
      targetRestaurantId: restaurantDbId,
      details: { fields_changed: Object.keys(authUpdates), new_email: authUpdates.email ?? null },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    });
  }

  // بعد نجاح Auth نحدّث slug في الداتابيس
  if (newSlug && newSlug !== restaurant.slug) {
    const { error: slugError } = await supabaseAdmin
      .from('restaurants')
      .update({ slug: newSlug })
      .eq('id', restaurantDbId);

    if (slugError) return NextResponse.json({ error: slugError.message }, { status: 500 });
  }

  // تحديث ملاحظة صاحب المطعم الخاصة بسوبر أدمن (اسم/هاتف) — جدول منفصل
  // بلا أي سياسة RLS عامة، الكتابة هنا فقط عبر service role.
  if (hasOwnerContactFields) {
    const contactUpdate: { restaurant_id: string; owner_name?: string | null; owner_phone?: string | null } = {
      restaurant_id: restaurantDbId,
    };
    if (ownerName !== undefined) {
      const trimmed = typeof ownerName === 'string' ? ownerName.trim() : '';
      contactUpdate.owner_name = trimmed || null;
    }
    if (ownerPhone !== undefined) {
      const trimmed = typeof ownerPhone === 'string' ? ownerPhone.trim() : '';
      contactUpdate.owner_phone = trimmed || null;
    }

    const { error: contactError } = await supabaseAdmin
      .from('restaurant_owner_contacts')
      .upsert(contactUpdate, { onConflict: 'restaurant_id' });

    if (contactError) return NextResponse.json({ error: contactError.message }, { status: 500 });
  }

  // تبديل تعليق الاشتراك (is_suspended) — عبر service role حصراً (بعد migration
  // 20260723100000 الذي يسمح لـ auth.role() = 'service_role' بتجاوز trigger
  // trg_restaurant_settings_suspend_guard). restaurant_settings.restaurant_id
  // هو الـ FK الصحيح لـ restaurants.id (وليس id الخاص بجدول الإعدادات نفسه).
  if (hasSuspendField) {
    // عند إلغاء التعليق يجب إعادة فتح المطعم فعلياً (is_closed:false) وإلا يبقى
    // مخفياً عن الزبائن رغم إلغاء التعليق، حتى يلاحظ المالك ويفتحه يدوياً بنفسه
    // من الإعدادات (خطأ #9 بتقرير الفحص).
    const { error: suspendError } = await supabaseAdmin
      .from('restaurant_settings')
      .update({ is_suspended: suspend, is_closed: suspend })
      .eq('restaurant_id', restaurantDbId);

    if (suspendError) return NextResponse.json({ error: suspendError.message }, { status: 500 });
  }

  // تبديل باقة الاشتراك (subscription_tier) — نفس مسار is_suspended أعلاه:
  // service role يتجاوز trg_restaurant_settings_suspend_guard الموسَّع
  // ليشمل subscription_tier (راجع migration 20260729100000).
  if (hasTierField) {
    const { error: tierError } = await supabaseAdmin
      .from('restaurant_settings')
      .update({ subscription_tier: subscriptionTier })
      .eq('restaurant_id', restaurantDbId);

    if (tierError) return NextResponse.json({ error: tierError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — حذف منطقي (أرشفة) كامل لمطعم: يحظر (ban) حسابات Auth لكل
// المرتبطين (مالك + موظفون + سائقون)، يعطّل user_roles، ثم يعلّم
// restaurant_settings.is_deleted = true. لا يُنفَّذ أي DELETE FROM فعلي
// على أي جدول بيانات — البيانات (طلبات، فواتير، سجلات) تبقى محفوظة
// بالكامل بالقاعدة لأغراض الأرشفة والتدقيق.
export async function DELETE(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { restaurantDbId, confirmSlug } = await req.json();

  if (typeof restaurantDbId !== 'string' || !restaurantDbId.trim()) {
    return NextResponse.json({ error: 'restaurantDbId مطلوب' }, { status: 400 });
  }
  if (typeof confirmSlug !== 'string' || !confirmSlug.trim()) {
    return NextResponse.json({ error: 'confirmSlug مطلوب' }, { status: 400 });
  }

  // جلب المطعم
  const { data: restaurant, error: fetchError } = await supabaseAdmin
    .from('restaurants')
    .select('id, slug, owner_id')
    .eq('id', restaurantDbId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!restaurant) return NextResponse.json({ error: 'المطعم غير موجود' }, { status: 404 });

  // دفاع في العمق: تأكيد نصي مطابق للـ slug قبل أي شيء آخر — يحمي من
  // استدعاء مباشر للـ API متجاوزاً واجهة التأكيد.
  if (confirmSlug.trim().toLowerCase() !== restaurant.slug.toLowerCase()) {
    return NextResponse.json({ error: 'نص التأكيد غير مطابق' }, { status: 400 });
  }

  // فحص idempotency — لو محذوف بالفعل، لا داعي لأي خطوة إضافية.
  const { data: existingSettings } = await supabaseAdmin
    .from('restaurant_settings')
    .select('is_deleted')
    .eq('restaurant_id', restaurantDbId)
    .maybeSingle();

  if (existingSettings?.is_deleted === true) {
    return NextResponse.json({ ok: true, alreadyDeleted: true });
  }

  // جمع كل الحسابات المرتبطة: مالك + موظفون (user_roles) + سائقون (drivers)
  const ownerId: string = restaurant.owner_id;

  const { data: staffRows, error: staffFetchError } = await supabaseAdmin
    .from('user_roles')
    .select('id, user_id')
    .eq('restaurant_id', restaurantDbId);
  if (staffFetchError) return NextResponse.json({ error: staffFetchError.message }, { status: 500 });

  const { data: driverRows, error: driverFetchError } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id')
    .eq('restaurant_id', restaurantDbId);
  if (driverFetchError) return NextResponse.json({ error: driverFetchError.message }, { status: 500 });

  const staffUserIds  = (staffRows  ?? []).map(s => s.user_id).filter((id): id is string => !!id);
  const driverUserIds = (driverRows ?? []).map(d => d.user_id).filter((id): id is string => !!id);

  const allUserIds = [ownerId, ...staffUserIds, ...driverUserIds].filter((id): id is string => !!id);

  // حظر Auth لكل الحسابات بالتتابع — أي فشل واحد يوقف العملية فوراً قبل
  // أي تعديل على user_roles أو restaurant_settings. عملية idempotent
  // (إعادة حظر حساب محظور أصلاً غير ضارة).
  for (const userId of allUserIds) {
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    });
    if (banError) return NextResponse.json({ error: banError.message }, { status: 500 });
  }

  // تعطيل كل صفوف user_roles دفعة واحدة
  const { error: deactivateError } = await supabaseAdmin
    .from('user_roles')
    .update({ is_active: false })
    .eq('restaurant_id', restaurantDbId);
  if (deactivateError) return NextResponse.json({ error: deactivateError.message }, { status: 500 });

  // أخيراً: تعليم المطعم كمحذوف منطقياً (أرشفة) — إيقاف كامل + إخفاء نهائي
  const { error: deleteFlagError } = await supabaseAdmin
    .from('restaurant_settings')
    .update({
      is_deleted: true,
      is_suspended: true,
      is_closed: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('restaurant_id', restaurantDbId);
  if (deleteFlagError) return NextResponse.json({ error: deleteFlagError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
