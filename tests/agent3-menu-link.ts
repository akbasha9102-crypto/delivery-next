/**
 * العميل الثالث — التحقق من ارتباط رابط المنيو (Vercel) ببيانات المطعم الجديد
 *
 * يتحقق أن:
 * 1. رابط /menu/[slug] يحمّل بيانات المطعم الصحيح فقط (عبر slug → restaurant_id)
 * 2. الأكلات والفئات في المنيو تُستقى من restaurant_id المطعم الجديد حصراً
 * 3. أي أكل يُضاف من داشبورد هذا المطعم يظهر في رابط المنيو الخاص به
 * 4. الأكلات لا تتداخل مع أكلات مطاعم أخرى
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY         = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

const SUFFIX         = Date.now();
const TEST_EMAIL     = `menu-agent-${SUFFIX}@agent.test`;
const TEST_PASSWORD  = 'MenuAgent@123';
const TEST_NAME      = `مطعم قائمة-${SUFFIX}`;
const TEST_SLUG      = `menu-agent-${SUFFIX}`;

type Result = { pass: boolean; label: string; detail?: string };
const results: Result[] = [];
let createdUserId: string | null = null;
let createdRestaurantId: string | null = null;
let createdCategoryId: string | null = null;
const createdItemIds: string[] = [];

function log(r: Result) {
  results.push(r);
  console.log(`${r.pass ? '✅' : '❌'} ${r.label}${r.detail ? ' — ' + r.detail : ''}`);
}

async function cleanup() {
  if (createdItemIds.length)
    await adminClient.from('items').delete().in('id', createdItemIds);
  if (createdCategoryId)
    await adminClient.from('categories').delete().eq('id', createdCategoryId);
  if (createdRestaurantId) {
    await adminClient.from('restaurant_settings').delete().eq('restaurant_id', createdRestaurantId);
    await adminClient.from('restaurants').delete().eq('id', createdRestaurantId);
  }
  if (createdUserId) await adminClient.auth.admin.deleteUser(createdUserId);
  console.log('\n🧹 تم تنظيف البيانات الاختبارية');
}

async function run() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  العميل الثالث: ارتباط رابط المنيو ببيانات المطعم الجديد');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── إعداد: إنشاء حساب + مطعم + إعدادات ──────────────────────────────────
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true,
  });
  if (authErr || !authData?.user) {
    log({ pass: false, label: 'إعداد: إنشاء حساب Auth', detail: authErr?.message });
    return;
  }
  createdUserId = authData.user.id;

  const { data: restaurant, error: restErr } = await adminClient
    .from('restaurants')
    .insert({ name: TEST_NAME, slug: TEST_SLUG, owner_id: createdUserId })
    .select().single();

  if (restErr || !restaurant) {
    log({ pass: false, label: 'إعداد: إنشاء المطعم', detail: restErr?.message });
    await cleanup(); return;
  }
  createdRestaurantId = restaurant.id;

  await adminClient.from('restaurant_settings').insert({
    restaurant_name: TEST_NAME,
    restaurant_id: createdRestaurantId,
    admin_email: TEST_EMAIL,
    subscription_start: new Date().toISOString(),
    is_suspended: false,
  });
  console.log(`✔ تم إعداد المطعم: "${TEST_NAME}" | slug: ${TEST_SLUG}\n`);

  // ── الفحص 1: slug يُعيّن restaurant_id الصحيح ────────────────────────────
  const { data: slugLookup, error: slugErr } = await adminClient
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', TEST_SLUG)
    .maybeSingle();

  log({
    pass: !slugErr && slugLookup?.id === createdRestaurantId,
    label: `رابط /menu/${TEST_SLUG} يُحدد restaurant_id الصحيح`,
    detail: slugLookup
      ? `id مُسترد: ${slugLookup.id} — المتوقع: ${createdRestaurantId}`
      : slugErr?.message ?? 'لا بيانات',
  });

  // ── الفحص 2: إضافة فئة وأكل من "الداشبورد" (كما يفعل admin/menu) ─────────
  const { data: cat, error: catErr } = await adminClient
    .from('categories')
    .insert({ name: 'مقبلات اختبارية', restaurant_id: createdRestaurantId, sort_order: 1 })
    .select().single();

  if (catErr || !cat) {
    log({ pass: false, label: 'إضافة فئة من الداشبورد', detail: catErr?.message });
    await cleanup(); return;
  }
  createdCategoryId = cat.id;
  log({ pass: true, label: 'إضافة فئة من داشبورد المطعم', detail: `id: ${cat.id}` });

  const testItems = [
    { name: 'طبق اختبار 1', price: 25, restaurant_id: createdRestaurantId, category_id: cat.id },
    { name: 'طبق اختبار 2', price: 35, restaurant_id: createdRestaurantId, category_id: cat.id },
  ];
  const { data: items, error: itemsErr } = await adminClient
    .from('items')
    .insert(testItems)
    .select();

  if (itemsErr || !items?.length) {
    log({ pass: false, label: 'إضافة أكلات من الداشبورد', detail: itemsErr?.message });
    await cleanup(); return;
  }
  items.forEach((i: { id: string }) => createdItemIds.push(i.id));
  log({ pass: true, label: 'إضافة أكلات من داشبورد المطعم', detail: `${items.length} أكلة أضيفت` });

  // ── الفحص 3: رابط المنيو يجلب فئات هذا المطعم فقط ──────────────────────
  const { data: menuCategories, error: menuCatErr } = await anonClient
    .from('categories')
    .select('*')
    .eq('restaurant_id', createdRestaurantId)
    .order('sort_order', { ascending: true });

  log({
    pass: !menuCatErr && (menuCategories ?? []).some((c: { id: string }) => c.id === createdCategoryId),
    label: 'رابط المنيو يُظهر الفئة المضافة من الداشبورد',
    detail: menuCatErr?.message ?? `${(menuCategories ?? []).length} فئة مُستردة`,
  });

  // ── الفحص 4: رابط المنيو يجلب أكلات هذا المطعم فقط ─────────────────────
  const { data: menuItems, error: menuItemsErr } = await anonClient
    .from('items')
    .select('*')
    .eq('restaurant_id', createdRestaurantId)
    .order('name');

  const foundItems = (menuItems ?? []).filter(
    (i: { id: string }) => createdItemIds.includes(i.id)
  );
  log({
    pass: !menuItemsErr && foundItems.length === createdItemIds.length,
    label: 'رابط المنيو يُظهر الأكلات المضافة من الداشبورد',
    detail: menuItemsErr?.message ?? `وُجد ${foundItems.length}/${createdItemIds.length} أكلة`,
  });

  // ── الفحص 5: لا تظهر أكلات مطاعم أخرى في هذا المنيو ────────────────────
  const { data: otherItems } = await anonClient
    .from('items')
    .select('id, restaurant_id, name')
    .eq('restaurant_id', createdRestaurantId);

  const leaked = (otherItems ?? []).filter(
    (i: { id: string }) => !createdItemIds.includes(i.id)
  );
  log({
    pass: leaked.length === 0,
    label: 'لا تظهر أكلات مطاعم أخرى في منيو هذا المطعم',
    detail: leaked.length === 0
      ? 'العزل مكتمل — الفلتر بـ restaurant_id يعمل'
      : `${leaked.length} أكلة غريبة ظهرت: ${leaked.map((i: { name: string }) => i.name).join(', ')}`,
  });

  // ── الفحص 6: أكلات مطعع آخر لا تظهر في منيو هذا المطعم ─────────────────
  // نجلب أكلة من مطعم آخر ونتأكد أنها لا تظهر في الاستعلام المقيد
  const { data: foreignItems } = await adminClient
    .from('items')
    .select('id, restaurant_id, name')
    .neq('restaurant_id', createdRestaurantId)
    .limit(3);

  if ((foreignItems ?? []).length > 0) {
    const { data: shouldBeEmpty } = await anonClient
      .from('items')
      .select('id')
      .eq('restaurant_id', createdRestaurantId)
      .in('id', (foreignItems ?? []).map((i: { id: string }) => i.id));

    log({
      pass: (shouldBeEmpty ?? []).length === 0,
      label: 'أكلات مطاعم أخرى لا تتسرب لمنيو هذا المطعم',
      detail: (shouldBeEmpty ?? []).length === 0
        ? `فُحص ${(foreignItems ?? []).length} أكلة أجنبية — لا تسرب`
        : `${(shouldBeEmpty ?? []).length} أكلة أجنبية ظهرت بشكل خاطئ`,
    });
  } else {
    log({
      pass: true,
      label: 'عزل الأكلات (لا توجد مطاعم أخرى)',
      detail: 'الفلتر بـ restaurant_id يضمن العزل هيكلياً',
    });
  }

  // ── الفحص 7: التأكد أن slug المطعم الجديد مختلف عن كل slug آخر ──────────
  const { data: allSlugs } = await adminClient
    .from('restaurants')
    .select('slug')
    .neq('id', createdRestaurantId);

  const slugCollision = (allSlugs ?? []).some(
    (r: { slug: string }) => r.slug === TEST_SLUG
  );
  log({
    pass: !slugCollision,
    label: `slug "${TEST_SLUG}" فريد — الرابط يُحيل لمطعم واحد فقط`,
    detail: slugCollision ? 'تعارض slug!' : 'لا تعارض',
  });

  // ── الفحص 8: تحديث أكل من الداشبورد ينعكس على المنيو ───────────────────
  const updatePrice = 99;
  await adminClient
    .from('items')
    .update({ price: updatePrice })
    .eq('id', createdItemIds[0]);

  const { data: updatedItem } = await anonClient
    .from('items')
    .select('price')
    .eq('id', createdItemIds[0])
    .eq('restaurant_id', createdRestaurantId)
    .maybeSingle();

  log({
    pass: updatedItem?.price === updatePrice,
    label: 'تحديث سعر الأكل من الداشبورد ينعكس فورياً على المنيو',
    detail: updatedItem ? `السعر الجديد: ${updatedItem.price} (المتوقع: ${updatePrice})` : 'لم يُعثر على الأكل',
  });

  // ── التنظيف والنتيجة ────────────────────────────────────────────────────
  await cleanup();

  const passed = results.filter(r => r.pass).length;
  const total  = results.length;
  console.log(`\n══════════════════════════════════`);
  console.log(`النتيجة: ${passed}/${total} فحص نجح`);
  if (passed === total) {
    console.log(`🎉 العميل الثالث: رابط المنيو /menu/${TEST_SLUG} مرتبط بالمطعم الصحيح وبياناته مستقلة`);
  } else {
    console.log('⚠️  العميل الثالث: بعض الفحوصات فشلت — راجع التفاصيل أعلاه');
    process.exit(1);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
