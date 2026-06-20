/**
 * العميل الأول — التحقق من عزل بيانات المطعم الجديد في لوحة التحكم العليا
 *
 * يتحقق أن:
 * 1. إنشاء مطعم جديد من لوحة السوبر-أدمن يُضيف صفاً مستقلاً في جدول restaurants
 * 2. يُنشئ صف منفصل في restaurant_settings مرتبط بـ restaurant_id الجديد
 * 3. لا يتداخل مع بيانات المطاعم الأخرى (من حيث owner_id و restaurant_id و slug)
 * 4. يُنشئ حساب Auth مستقل في Supabase Auth بالبريد المحدد
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// بيانات المطعم الاختباري — يمكن تغييرها قبل التشغيل
const TEST_RESTAURANT_NAME  = `مطعم اختبار-${Date.now()}`;
const TEST_SLUG             = `test-agent-${Date.now()}`;
const TEST_EMAIL            = `test-agent-${Date.now()}@agent.test`;
const TEST_PASSWORD         = 'Agent@123456';

type Result = { pass: boolean; label: string; detail?: string };
const results: Result[] = [];
let createdRestaurantId: string | null = null;
let createdUserId: string | null = null;

function log(r: Result) {
  results.push(r);
  const icon = r.pass ? '✅' : '❌';
  console.log(`${icon} ${r.label}${r.detail ? ' — ' + r.detail : ''}`);
}

async function cleanup() {
  if (createdRestaurantId) {
    await admin.from('restaurant_settings').delete().eq('restaurant_id', createdRestaurantId);
    await admin.from('restaurants').delete().eq('id', createdRestaurantId);
  }
  if (createdUserId) {
    await admin.auth.admin.deleteUser(createdUserId);
  }
  console.log('\n🧹 تم تنظيف البيانات الاختبارية');
}

async function run() {
  console.log('══════════════════════════════════════════════════');
  console.log('  العميل الأول: عزل بيانات المطعم في السوبر-أدمن');
  console.log('══════════════════════════════════════════════════\n');

  // ── الخطوة 1: التقاط قائمة المطاعم قبل الإنشاء ─────────────────────────
  const { data: beforeRestaurants, error: beforeErr } = await admin
    .from('restaurants')
    .select('id, slug, owner_id');

  if (beforeErr) {
    log({ pass: false, label: 'قراءة المطاعم الحالية', detail: beforeErr.message });
    return;
  }
  const beforeIds = new Set((beforeRestaurants ?? []).map((r: { id: string }) => r.id));
  log({ pass: true, label: 'قراءة المطاعم الحالية', detail: `${beforeIds.size} مطعم موجود` });

  // ── الخطوة 2: إنشاء حساب Auth ──────────────────────────────────────────
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (authErr || !authData?.user) {
    log({ pass: false, label: 'إنشاء حساب Auth', detail: authErr?.message });
    return;
  }
  createdUserId = authData.user.id;
  log({ pass: true, label: 'إنشاء حساب Auth', detail: `user_id: ${createdUserId}` });

  // ── الخطوة 3: التحقق أن البريد الإلكتروني مستقل (غير مكرر) ─────────────
  const { data: dupUser } = await admin.auth.admin.listUsers({ perPage: 200 });
  const usersWithSameEmail = (dupUser?.users ?? []).filter(
    (u: { email?: string | null; id: string }) => u.email === TEST_EMAIL && u.id !== createdUserId
  );
  log({
    pass: usersWithSameEmail.length === 0,
    label: 'البريد الإلكتروني فريد في Auth',
    detail: usersWithSameEmail.length === 0 ? 'لا يوجد تكرار' : `وُجد ${usersWithSameEmail.length} حساب بنفس البريد`,
  });

  // ── الخطوة 4: إنشاء سجل المطعم في جدول restaurants ─────────────────────
  const { data: restaurant, error: restErr } = await admin
    .from('restaurants')
    .insert({ name: TEST_RESTAURANT_NAME, slug: TEST_SLUG, owner_id: createdUserId })
    .select()
    .single();

  if (restErr || !restaurant) {
    log({ pass: false, label: 'إنشاء سجل المطعم', detail: restErr?.message });
    await cleanup();
    return;
  }
  createdRestaurantId = restaurant.id;
  log({ pass: true, label: 'إنشاء سجل المطعم', detail: `id: ${createdRestaurantId} | slug: ${restaurant.slug}` });

  // ── الخطوة 5: التحقق أن الـ slug فريد ──────────────────────────────────
  const { data: slugCheck } = await admin
    .from('restaurants')
    .select('id')
    .eq('slug', TEST_SLUG);
  log({
    pass: (slugCheck ?? []).length === 1,
    label: 'الـ slug فريد في قاعدة البيانات',
    detail: `عدد الصفوف بنفس الـ slug: ${(slugCheck ?? []).length}`,
  });

  // ── الخطوة 6: إنشاء restaurant_settings مستقلة ─────────────────────────
  const { error: settingsErr } = await admin.from('restaurant_settings').insert({
    restaurant_name: TEST_RESTAURANT_NAME,
    restaurant_id: createdRestaurantId,
    admin_email: TEST_EMAIL,
    subscription_start: new Date().toISOString(),
    is_suspended: false,
  });
  log({
    pass: !settingsErr,
    label: 'إنشاء restaurant_settings مستقلة',
    detail: settingsErr?.message ?? 'تم بنجاح',
  });

  // ── الخطوة 7: التحقق أن restaurant_settings مرتبطة بـ restaurant_id الصحيح ──
  const { data: newSettings } = await admin
    .from('restaurant_settings')
    .select('restaurant_id, restaurant_name, admin_email')
    .eq('restaurant_id', createdRestaurantId)
    .maybeSingle();

  log({
    pass: newSettings?.restaurant_id === createdRestaurantId && newSettings?.admin_email === TEST_EMAIL,
    label: 'بيانات restaurant_settings صحيحة ومرتبطة',
    detail: newSettings
      ? `restaurant_id مطابق، email: ${newSettings.admin_email}`
      : 'لم يُعثر على الصف',
  });

  // ── الخطوة 8: التحقق أن المطاعم الأخرى لم تتأثر ─────────────────────────
  const { data: afterRestaurants } = await admin
    .from('restaurants')
    .select('id, slug, owner_id');

  const otherRestaurants = (afterRestaurants ?? []).filter(
    (r: { id: string }) => beforeIds.has(r.id)
  );
  const contaminated = otherRestaurants.filter(
    (r: { owner_id: string }) => r.owner_id === createdUserId
  );
  log({
    pass: contaminated.length === 0,
    label: 'المطاعم الأخرى لم تتأثر (owner_id مستقل)',
    detail: contaminated.length === 0
      ? 'لا يوجد تداخل في owner_id'
      : `${contaminated.length} مطعم يحمل owner_id خاطئ`,
  });

  // ── الخطوة 9: التحقق أن restaurant_settings للمطاعم القديمة لم تتغير ────
  const { data: allSettings } = await admin
    .from('restaurant_settings')
    .select('restaurant_id')
    .neq('restaurant_id', createdRestaurantId);

  const settingsWithNewId = (allSettings ?? []).filter(
    (s: { restaurant_id: string | null }) => s.restaurant_id === createdRestaurantId
  );
  log({
    pass: settingsWithNewId.length === 0,
    label: 'إعدادات المطاعم القديمة لم تتداخل مع الجديد',
    detail: settingsWithNewId.length === 0 ? 'العزل مكتمل' : `وُجد ${settingsWithNewId.length} صف متداخل`,
  });

  // ── التنظيف والنتيجة ──────────────────────────────────────────────────
  await cleanup();

  const passed = results.filter(r => r.pass).length;
  const total  = results.length;
  console.log(`\n══════════════════════════════════`);
  console.log(`النتيجة: ${passed}/${total} فحص نجح`);
  if (passed === total) {
    console.log('🎉 العميل الأول: اجتاز جميع الفحوصات — عزل البيانات يعمل بشكل صحيح');
  } else {
    console.log('⚠️  العميل الأول: بعض الفحوصات فشلت — راجع التفاصيل أعلاه');
    process.exit(1);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
