/**
 * يحذف الصفوف المكررة في restaurant_settings
 * يُبقي الصف الأحدث لكل مطعم ويحذف الباقي
 *
 * تشغيل: npm run fix-duplicates
 */

import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  const { data, error } = await admin
    .from('restaurant_settings')
    .select('id, restaurant_id, restaurant_name, admin_email, updated_at')
    .order('updated_at', { ascending: false });

  if (error) { console.error('خطأ:', error.message); process.exit(1); }

  // تجميع الصفوف حسب restaurant_id
  const grouped = new Map<string, typeof data>();
  for (const row of data ?? []) {
    const key = row.restaurant_id ?? 'null';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  let totalDeleted = 0;
  for (const [restId, rows] of grouped) {
    if (rows.length <= 1) continue;
    // الأول هو الأحدث (مرتب تنازلياً) — نحذف الباقي
    const toDelete = rows.slice(1).map(r => r.id);
    console.log(`مطعم ${rows[0].restaurant_name ?? restId}: حذف ${toDelete.length} صف مكرر`);
    const { error: delErr } = await admin.from('restaurant_settings').delete().in('id', toDelete);
    if (delErr) console.error('  خطأ في الحذف:', delErr.message);
    else { console.log('  ✅ تم'); totalDeleted += toDelete.length; }
  }

  if (totalDeleted === 0) console.log('✅ لا توجد صفوف مكررة');
  else console.log(`\n✅ تم حذف ${totalDeleted} صف مكرر`);
}

run().catch(e => { console.error(e); process.exit(1); });
