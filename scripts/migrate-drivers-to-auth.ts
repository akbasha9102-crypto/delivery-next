/**
 * RBAC v2 — نقل السائقين من (هاتف + كلمة مرور نصية صريحة، RLS معطّل)
 * إلى حساب Supabase Auth حقيقي، تمهيداً لتفعيل RLS على جدول drivers.
 *
 * لكل صف بـ drivers لا يملك user_id بعد:
 *   1. ينشئ حساب Supabase Auth (بريد صناعي driver-<id>@driver.dasha.app،
 *      وكلمة المرور الحالية للسائق كما هي — حتى لا يُفاجَأ أي سائق بتغيّر
 *      كلمة مروره؛ يمكنه تغييرها لاحقاً من داخل التطبيق إن أُضيفت شاشة لذلك).
 *   2. يحدّث drivers.user_id بمعرّف الحساب الجديد.
 *   3. يُدرج صفاً بـ user_roles (role='driver') لنفس المطعم.
 *
 * تشغيل يدوي فقط (لا يُشغَّل تلقائياً): npx tsx --env-file=.env.local scripts/migrate-drivers-to-auth.ts
 * شرط مسبق: تشغيل migrations 20260710120000 و 20260710121000 بـ SQL Editor أولاً.
 * آمن للتكرار (idempotent) — يتخطى أي سائق عنده user_id مسبقاً.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function driverEmail(driverId: string) {
  return `driver-${driverId}@driver.dasha.app`;
}

async function main() {
  const { data: drivers, error } = await admin
    .from('drivers')
    .select('id, name, phone, password, restaurant_id, user_id')
    .is('user_id', null);

  if (error) throw error;
  if (!drivers || drivers.length === 0) {
    console.log('لا يوجد سائقون بحاجة لنقل — كل السائقين مربوطون بحساب Auth بالفعل.');
    return;
  }

  console.log(`سيتم نقل ${drivers.length} سائق...`);

  for (const d of drivers) {
    if (!d.restaurant_id) {
      console.log(`⚠️  تخطّي السائق ${d.name} (${d.id}) — لا يملك restaurant_id، راجعه يدوياً.`);
      continue;
    }
    const password = d.password && d.password.length >= 6 ? d.password : randomBytes(9).toString('base64url');

    const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
      email: driverEmail(d.id),
      password,
      email_confirm: true,
      user_metadata: { driver_id: d.id, name: d.name },
    });

    if (createErr) {
      console.log(`❌ فشل إنشاء حساب Auth للسائق ${d.name} (${d.id}): ${createErr.message}`);
      continue;
    }

    const { error: updateErr } = await admin
      .from('drivers')
      .update({ user_id: authUser.user.id })
      .eq('id', d.id);

    if (updateErr) {
      console.log(`❌ فشل تحديث drivers.user_id للسائق ${d.name} (${d.id}): ${updateErr.message}`);
      continue;
    }

    const { error: roleErr } = await admin.from('user_roles').upsert(
      {
        user_id: authUser.user.id,
        restaurant_id: d.restaurant_id,
        role: 'driver',
        display_name: d.name,
        is_active: true,
      },
      { onConflict: 'user_id,restaurant_id' }
    );

    if (roleErr) {
      console.log(`❌ فشل إدراج user_roles للسائق ${d.name} (${d.id}): ${roleErr.message}`);
      continue;
    }

    console.log(`✅ ${d.name} (${d.id}) → ${driverEmail(d.id)}`);
  }

  console.log('\nانتهى. تحقق من تسجيل دخول سائق واحد فعلياً عبر /drivers قبل حذف عمود password.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
