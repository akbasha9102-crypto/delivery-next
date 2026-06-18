# تقرير التدقيق الشامل — مشروع delivery-next
# Comprehensive Audit Report — delivery-next Project

> **تاريخ التقرير / Report Date:** 2026-06-18  
> **المشروع / Project:** delivery-next — تطبيق توصيل طعام (Next.js + Supabase)  
> **المنهجية / Methodology:** تحليل متوازٍ بـ 10 وكلاء بحث + 3 وكلاء نقد  
> **إجمالي الملفات المفحوصة / Files Audited:** 36 TypeScript/TSX + 11 SQL migrations

---

## جدول المحتويات / Table of Contents

1. [الملخص التنفيذي / Executive Summary](#-الملخص-التنفيذي--executive-summary)
2. [المشاكل الحرجة الفورية / Critical Issues](#-المشاكل-الحرجة-الفورية--critical-issues)
3. [أخطاء العلاقات في قاعدة البيانات / Database Relationship Errors](#-أخطاء-العلاقات-في-قاعدة-البيانات--database-relationship-errors)
4. [الثغرات الأمنية / Security Vulnerabilities](#-الثغرات-الأمنية--security-vulnerabilities)
5. [أخطاء الواجهات / UI Interface Errors](#-أخطاء-الواجهات--ui-interface-errors)
6. [مراجعة النقاد / Critics Review](#-مراجعة-النقاد--critics-review)
7. [خارطة الطريق / Action Roadmap](#-خارطة-الطريق--action-roadmap)

---

## 📊 الملخص التنفيذي / Executive Summary

### بالعربية — للقارئ غير المتخصص

تخيّل أن متجرك الإلكتروني كالغرفة التي فيها درج مقفل (قاعدة البيانات) — المفتاح معلّق على الباب الخارجي للجميع (مفتاح Supabase مكتوب في الكود)، وكلمات مرور موظفيك مكتوبة على ورقة بجانبه (كلمات مرور السائقين بدون تشفير). كل زبون يمكنه قراءة طلبات الزبائن الآخرين، وأي شخص يعرف رابط الإدارة يدخل لوحة التحكم مباشرة.

**الأرقام الإجمالية:**

| الفئة | عدد المشاكل المكتشفة |
|-------|---------------------|
| أخطاء العلاقات في قاعدة البيانات | 67 مشكلة |
| ثغرات أمنية | 19 ثغرة |
| أخطاء الواجهات | 25 مشكلة |
| **المجموع الكلي** | **~111 مشكلة** |
| المشاكل الفريدة (بعد حذف الازدواجية) | **~50 مشكلة** |

---

### In English — Technical Summary

A parallel audit using 10 specialized research agents and 3 critic agents revealed critical security, data integrity, and performance issues across the delivery-next application. The most severe finding is the complete absence of Row Level Security (RLS) on all Supabase tables combined with a hardcoded API key in source code — effectively making the entire database publicly readable and writable by anyone.

**Severity Distribution:**

| Severity | Count |
|----------|-------|
| 🔴 Critical | 5 |
| 🟠 High | 12 |
| 🟡 Medium | 18 |
| 🟢 Low / Improvement | 15+ |

---

## 🚨 المشاكل الحرجة الفورية / Critical Issues

> هذه المشاكل تحتاج إصلاحاً خلال 48 ساعة إذا كان التطبيق يعمل في بيئة الإنتاج.  
> These issues require immediate fix within 48 hours if the app is running in production.

---

### 🔴 CRITICAL-1 — غياب تام لـ Row Level Security | Missing RLS on All Tables

**للمتخصص / Technical:**
لا يوجد في أي من ملفات migration أو إعدادات Supabase `ENABLE ROW LEVEL SECURITY` أو `CREATE POLICY`. جميع الجداول (`orders`, `drivers`, `order_items`, `items`, `categories`, `restaurant_settings`) مكشوفة بالكامل لأي طلب HTTP يحمل الـ anon key.

**للمبتدئ / Non-Technical:**
قاعدة بياناتك بلا قفل. أي شخص يعرف عنوان موقعك يستطيع قراءة جميع طلبات عملائك وأرقام هواتفهم وعناوينهم، وحتى تعديلها أو حذفها.

**الاستغلال المحتمل / Exploit:**
```http
GET https://gbmwrvnmvobvieembxmf.supabase.co/rest/v1/orders?select=*
Authorization: Bearer <anon_key_من_المصدر>
```
→ يُعيد جميع الطلبات مع بيانات العملاء كاملة.

**الإصلاح / Fix:**
```sql
-- في Supabase SQL Editor
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة العامة للمنيو
CREATE POLICY "items_public_read" ON items FOR SELECT USING (true);
CREATE POLICY "categories_public_read" ON categories FOR SELECT USING (true);

-- سياسة الطلبات: كل عميل يرى طلباته فقط
CREATE POLICY "orders_by_phone" ON orders FOR SELECT
  USING (client_phone = current_setting('request.jwt.claims', true)::json->>'phone');
```

---

### 🔴 CRITICAL-2 — مفتاح Supabase مكتوب في الكود | Hardcoded Supabase Key

**للمتخصص / Technical:**
المفتاح `sb_publishable_DB8lKUjdnAah-jNbpFV22w_7Id2Eggr` وعنوان المشروع مُضمَّنان في 5 ملفات:

| الملف | السطر |
|-------|-------|
| `src/lib/supabase.ts` | 3-4 |
| `src/app/api/cron/expire-orders/route.ts` | 4-5 |
| `src/app/api/push/notify/route.ts` | 5-6 |
| `src/app/api/push/broadcast/route.ts` | 5-6 |
| `src/app/api/push/subscribe/route.ts` | 4-5 |

**للمبتدئ / Non-Technical:**
مفتاح قاعدة بياناتك مكتوب مباشرة في الكود — مثل كتابة كلمة سر البنك على الغلاف الخارجي للدفتر.

**الإصلاح / Fix:**
```bash
# 1. أنشئ ملف .env.local
echo "NEXT_PUBLIC_SUPABASE_URL=https://gbmwrvnmvobvieembxmf.supabase.co" >> .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_..." >> .env.local

# 2. تأكد من وجود .env.local في .gitignore
echo ".env.local" >> .gitignore
```
```typescript
// src/lib/supabase.ts — بعد الإصلاح
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
```
> ⚠️ **مهم:** يجب تدوير (rotate) المفتاح الحالي من Supabase Dashboard فوراً لأنه ظهر في git history.

---

### 🔴 CRITICAL-3 — AdminGuard غير مفعّل في Layout | AdminGuard Not Used in Admin Layout

**للمتخصص / Technical:**
`src/components/AdminGuard.tsx` موجود كـ component لكنه **لا يُستدعى في `src/app/admin/layout.tsx`**. صفحات الإدارة تعتمد على استدعاء `AdminGuard` الفردي في كل صفحة — لكن `admin/settings/page.tsx` لا يستخدمه أصلاً. النتيجة: `/admin/settings` مفتوح لأي زائر.

علاوة على ذلك، `AdminGuard` يتحقق فقط من وجود `session` دون التحقق من أن المستخدم `admin`:
```typescript
// src/components/AdminGuard.tsx — المشكلة الحالية
if (!session) router.replace('/login');
else setChecking(false); // أي جلسة تُمرَّر!
```

**للمبتدئ / Non-Technical:**
باب غرفة المدير مفتوح — أي شخص يعرف الرابط يدخل مباشرة.

**الإصلاح / Fix:**
```typescript
// src/app/admin/layout.tsx — أضف هذا
import { AdminGuard } from '@/components/AdminGuard';

export default function AdminLayout({ children }) {
  return <AdminGuard>{children}</AdminGuard>;
}
```
```typescript
// src/components/AdminGuard.tsx — تحقق من الدور
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
if (!session || session.user.email !== ADMIN_EMAIL) {
  router.replace('/login');
}
```

---

### 🔴 CRITICAL-4 — كلمات مرور السائقين بدون تشفير | Driver Passwords Stored as Plain Text

**للمتخصص / Technical:**
```sql
-- supabase_migration_driver_password.sql
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS password TEXT;
```
المقارنة في `src/app/driver/page.tsx` السطر 29:
```typescript
.eq('password', password.trim()) // مقارنة نصية مباشرة!
```

**للمبتدئ / Non-Technical:**
كلمات مرور سائقيك مكتوبة كنص عادي في قاعدة البيانات — أي شخص يصل للقاعدة يرى كلمات المرور مباشرة.

**الإصلاح / Fix:**
```typescript
// API Route جديدة: /api/driver/login
import bcrypt from 'bcryptjs';

const { data: driver } = await supabase
  .from('drivers')
  .select('id, name, phone, password')
  .eq('phone', phone)
  .single();

const isValid = await bcrypt.compare(password, driver.password);
if (!isValid) return Response.json({ error: 'invalid' }, { status: 401 });
```
```sql
-- ترقية كلمات المرور الموجودة
UPDATE drivers SET password = crypt(password, gen_salt('bf')) WHERE password IS NOT NULL;
```

---

### 🔴 CRITICAL-5 — إنشاء الطلب بدون Transaction | Order Creation Without Transaction

**للمتخصص / Technical:**
في `src/app/cart/page.tsx` السطور 470-494:
```typescript
// الخطوة 1 — تنجح
const { data: order } = await supabase.from('orders').insert({...}).select().single();

// الخطوة 2 — قد تفشل بصمت!
await supabase.from('order_items').insert(items.map(i => ({ order_id: order.id, ... })));
// لا يوجد: if (error) — لا rollback!

// تستمر دائماً حتى عند الفشل
clearCart();
router.push('/track');
```

نفس النمط في `src/app/orders/page.tsx` السطر 266 و `src/app/admin/local/page.tsx` السطر 65.

**للمبتدئ / Non-Technical:**
عند طلب الطعام، إذا انقطع الاتصال بعد تسجيل الطلب ولم تُحفظ الوجبات — يرى المطعم طلباً فارغاً بمبلغ مالي دون أي وجبات. العميل يُدفع ولا يستلم ما طلبه.

**الإصلاح / Fix:**
```sql
-- إنشاء Supabase RPC Function للعملية الذرية
CREATE OR REPLACE FUNCTION create_order_with_items(
  order_data jsonb,
  items_data jsonb[]
) RETURNS uuid AS $$
DECLARE
  new_order_id uuid;
BEGIN
  INSERT INTO orders SELECT * FROM jsonb_populate_record(null::orders, order_data)
  RETURNING id INTO new_order_id;

  INSERT INTO order_items (order_id, item_name, quantity, price)
  SELECT new_order_id, (item->>'item_name'), (item->>'quantity')::int, (item->>'price')::numeric
  FROM unnest(items_data) AS item;

  RETURN new_order_id;
END;
$$ LANGUAGE plpgsql;
```
```typescript
// استخدام الـ RPC
const { data, error } = await supabase.rpc('create_order_with_items', {
  order_data: orderPayload,
  items_data: cartItems,
});
if (error) { showErrorToUser('فشل إرسال الطلب، يرجى المحاولة مجدداً'); return; }
```

---

## 🗄️ أخطاء العلاقات في قاعدة البيانات / Database Relationship Errors

### DB-1 — المفاتيح الخارجية المفقودة / Missing Foreign Keys

**للمتخصص / Technical:**
لا توجد في المشروع ملفات `CREATE TABLE` — جميع الـ migrations هي `ALTER TABLE` فقط. هذا يعني أن قيود العلاقات بين الجداول غائبة تماماً على مستوى قاعدة البيانات.

| الحقل | الجدول | يجب أن يشير لـ | الحالة |
|-------|--------|---------------|--------|
| `order_id` | `order_items` | `orders.id` | ❌ لا يوجد FK |
| `order_id` | `order_feedback` | `orders.id` | ❌ لا يوجد FK |
| `category_id` | `items` | `categories.id` | ❌ لا يوجد FK |
| `driver_id` | `orders` | `drivers.id` | ❌ لا يوجد FK |

> **ملاحظة هامة (من Critic-1):** تخزين `item_name` كنص في `order_items` هو **snapshot pattern مقصود وصحيح** في أنظمة الـ e-commerce — يحفظ اسم الوجبة وقت الطلب حتى لو تغيّر الاسم لاحقاً. هذه ليست مشكلة.

**للمبتدئ / Non-Technical:**
الجداول غير مربوطة رسمياً ببعض — مثل دفاتر محاسبة منفصلة دون أرقام مرجعية. يمكن حذف طلب ويبقى بنوده معلقة في الهواء.

**الإصلاح / Fix:**
```sql
-- تشغيل في Supabase SQL Editor
ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_order
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE order_feedback
  ADD CONSTRAINT fk_feedback_order
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE items
  ADD CONSTRAINT fk_items_category
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;

-- تغيير driver_id من text إلى uuid أولاً
ALTER TABLE orders ALTER COLUMN driver_id TYPE uuid USING driver_id::uuid;
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_driver
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
```

---

### DB-2 — الفهارس المفقودة / Missing Database Indexes

**للمتخصص / Technical:**
الأعمدة الأكثر استخداماً في الفلترة والبحث تفتقر لفهارس، مما يُجبر قاعدة البيانات على **Full Table Scan** عند كل استعلام.

| الجدول | العمود | الاستخدام | الأولوية |
|--------|--------|-----------|---------|
| `orders` | `status` | كل استعلام في التطبيق | 🔴 حرج |
| `orders` | `driver_id` | لوحة السائق + الإدارة | 🔴 حرج |
| `order_items` | `order_id` | كل عرض للطلبات | 🔴 حرج |
| `orders` | `client_phone` | صفحة التتبع (polling) | 🟠 عالي |
| `orders` | `created_at` | الإحصاءات والأرشيف | 🟠 عالي |
| `drivers` | `phone` | تسجيل دخول السائق | 🟠 عالي |
| `items` | `category_id` | عرض المنيو | 🟡 متوسط |

**للمبتدئ / Non-Technical:**
بدون فهارس، قاعدة البيانات تقرأ كل الطلبات بالكامل للعثور على طلب واحد — مثل البحث عن اسم في دليل هاتف بدون ترتيب أبجدي.

**الإصلاح / Fix (ملف جاهز للتطبيق):**
```sql
-- تشغيل هذا الملف مرة واحدة في Supabase SQL Editor
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id    ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_phone ON orders(client_phone);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_driver_status ON orders(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_drivers_phone       ON drivers(phone);
CREATE INDEX IF NOT EXISTS idx_items_category_id   ON items(category_id);
```

---

### DB-3 — قواعد الحذف المتسلسل / CASCADE Rules Issues

**للمتخصص / Technical:**

**مشكلة 1:** حذف السائق بدون حماية (`src/app/admin/drivers/page.tsx` السطر 82):
```typescript
await supabase.from('drivers').delete().eq('id', id);
// لا يوجد: تحقق من طلبات نشطة
// لا يوجد: ON DELETE CASCADE/RESTRICT على قاعدة البيانات
```

**مشكلة 2:** حذف القسم وعناصره في خطوتين منفصلتين بدون transaction (`admin/menu/page.tsx` السطر 103):
```typescript
await supabase.from('items').delete().eq('category_id', cat.id); // قد تنجح
await supabase.from('categories').delete().eq('id', cat.id);     // قد تفشل
// إذا نجحت الأولى وفشلت الثانية: items محذوفة لكن category موجودة فارغة
```

**للمبتدئ / Non-Technical:**
حذف سائق لديه طلبات نشطة يتركها بلا سائق — الطلب معلق ولا أحد يوصله.

**الإصلاح / Fix:**
```typescript
// فحص قبل حذف السائق
const { count } = await supabase
  .from('orders')
  .select('id', { count: 'exact', head: true })
  .eq('driver_id', id)
  .in('status', ['preparing', 'ready', 'pickup']);

if (count && count > 0) {
  alert(`لا يمكن حذف السائق — لديه ${count} طلب نشط`);
  return;
}
```

---

### DB-4 — مشاكل البنية العلائقية / Structural Relationship Issues

**للمتخصص / Technical:**

**مشكلة رئيسية:** الإضافات (extras) مخزنة كـ JSON نصي وتُدمج في اسم الوجبة عند الطلب:
```typescript
// src/app/cart/page.tsx السطر 489
item_name: extraNames ? `${i.name} (${extraNames})` : i.name,
// النتيجة في قاعدة البيانات: "برغر (جبن، صوص)"
```

هذا يمنع:
- الإحصاء على الإضافات الأكثر طلباً
- تسعير الإضافات بشكل مستقل في التقارير
- الاستعلام عنها بأي JOIN

> **ملاحظة من Critic-1:** تحقق من أن عمود `extras_json` من نوع `jsonb` وليس `text` في Supabase — إذا كان `jsonb` فالمشكلة أقل حدة لأن PostgreSQL يدعم فهرسة GIN عليه.

**للمبتدئ / Non-Technical:**
لا يمكن معرفة أي إضافة تُطلب أكثر لأنها مخزنة كنص غير منظم.

---

### DB-5 — السجلات اليتيمة وتناسق البيانات / Orphaned Records

**للمتخصص / Technical:**

**Race Condition في تعيين السائق** (`admin/orders/page.tsx` السطر 178):
```typescript
const driver = drivers.find(d => d.id === driverId); // قائمة محلية قديمة!
if (!driver) return;
await supabase.from('orders').update({ driver_id: driverId, ... });
// إذا حذف مدير آخر هذا السائق في نفس الوقت → تعيين لسائق محذوف
```

**الحل:** `SELECT FOR UPDATE` أو التحقق من الخادم:
```typescript
// استخدام Supabase RPC لتعيين آمن
const { error } = await supabase.rpc('assign_driver_to_order', {
  p_order_id: orderId,
  p_driver_id: driverId,
});
```

---

### DB-6 — مشاكل الاستعلامات N+1 / N+1 Query Problems

**للمتخصص / Technical:**
النمط الخطير موجود في 4 صفحات (`admin/orders`, `admin/dashboard`, `admin/statistics`, `admin/archive`):
```typescript
// ❌ خطأ: 1 + N استعلام (حتى 501 استعلام لـ 500 طلب)
const withItems = await Promise.all(data.map(async order => {
  const { data: items } = await supabase
    .from('order_items').select('*').eq('order_id', order.id);
  return { ...order, items };
}));

// ✅ صح: استعلام واحد فقط
const { data: orders } = await supabase
  .from('orders')
  .select('*, order_items(*)') // Supabase يجلب العلاقة في استعلام واحد
  .order('created_at', { ascending: false })
  .limit(100);
```

**للمبتدئ / Non-Technical:**
بدلاً من سؤال واحد "أعطني 100 طلب مع وجباتها"، البرنامج يسأل قاعدة البيانات 101 مرة. مع 200 طلب يصبح 201 سؤال. هذا يُبطئ الصفحة بشدة.

**الأماكن المتأثرة:**
- `src/app/admin/orders/page.tsx` — السطر 150
- `src/app/admin/dashboard/page.tsx` — السطر 337
- `src/app/admin/statistics/page.tsx` — السطر 63
- `src/app/admin/archive/page.tsx` — السطر 93

---

### DB-7 — عدم تطابق أنواع البيانات / Data Type Mismatches

**للمتخصص / Technical:**

| المشكلة | الملف | السطر | الخطورة |
|---------|-------|-------|---------|
| `driver_id` نوع `text` بينما `drivers.id` من نوع `uuid` | migration SQL | 4 | 🟠 عالي |
| `order_type` غائب من `Order` interface في `admin/orders` | `admin/orders/page.tsx` | 9 | 🟡 متوسط |
| `client_phone` قد يُخزَّن بـ/بدون بادئة `+964` | `cart/page.tsx`, `track/page.tsx` | — | 🟡 متوسط |
| `timestamp` يُعامَل كـ `string` في localStorage | `NewOrdersContext.tsx` | 23 | 🟢 منخفض |

---

## 🔒 الثغرات الأمنية / Security Vulnerabilities

### SEC-1 — ثغرات المصادقة والتفويض / Auth & Authorization Vulnerabilities

#### SEC-1-A: جلسة السائق في localStorage
**للمتخصص / Technical:**
```typescript
// src/app/driver/page.tsx السطر 32
localStorage.setItem('driver_session', JSON.stringify({ id, name, phone }));

// src/app/driver/dashboard/page.tsx السطر 77
const s = JSON.parse(localStorage.getItem('driver_session')) as Session;
// لا يوجد تحقق من الخادم — أي شخص يعدّل localStorage ينتحل هوية أي سائق
```

**الإصلاح:** إصدار JWT موقّع من الخادم عند تسجيل الدخول، والتحقق منه في كل API call.

#### SEC-1-B: /delivery/[orderId] مكشوفة
**للمتخصص / Technical:**
```typescript
// src/app/delivery/[orderId]/page.tsx السطر 388-403
// أي شخص يعرف orderId يستطيع:
await supabase.from('orders').update({ status: 'ready' });    // تغيير الحالة
await supabase.from('orders').update({ status: 'completed' }); // إغلاق الطلب
await supabase.from('drivers').update({ status: 'available' }); // تحرير السائق
// لا يوجد: تحقق من أن session.id === order.driver_id
```

**الإصلاح:**
```typescript
const { data: order } = await supabase
  .from('orders').select('driver_id').eq('id', orderId).single();

if (order.driver_id !== session.id) {
  router.replace('/driver');
  return;
}
```

#### SEC-1-C: /orders تُعرض بيانات أي عميل
**للمتخصص / Technical:**
```typescript
// src/app/orders/page.tsx السطر 102
const ph = localStorage.getItem('deliveryPhone');
supabase.from('orders').select('*').eq('client_phone', ph);
// أي شخص يضع رقم هاتف في localStorage يرى كل طلبات ذلك الرقم
```

---

### SEC-2 — أمان الـ API / API Security Issues

#### SEC-2-A: Cron Job بدون مصادقة
**للمتخصص / Technical:**
```typescript
// src/app/api/cron/expire-orders/route.ts
export async function GET() {
  // لا يوجد فحص للمصادقة!
  await supabase.from('orders').update({ status: 'rejected' })...
}
```
أي شخص يستطيع إرسال `GET /api/cron/expire-orders` وإلغاء جميع الطلبات المعلقة.

> **مشكلة إضافية (اكتشفها Critic-3):** `vercel.json` فارغ تماماً `{}` — الـ cron غير مجدوَل! الطلبات لن تنتهي صلاحيتها أبداً تلقائياً.

**الإصلاح:**
```typescript
// فحص السر
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  ...
}
```
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/expire-orders",
    "schedule": "*/15 * * * *"
  }]
}
```

#### SEC-2-B: Push APIs بدون حماية
**للمتخصص / Technical:**
- `POST /api/push/broadcast` — أي شخص يرسل إشعارات لجميع السائقين
- `POST /api/push/subscribe` — أي شخص يختطف اشتراك أي سائق
- `POST /api/push/notify` — أي شخص يرسل إشعاراً لأي سائق بأي محتوى

#### SEC-2-C: Service Worker XSS
**للمتخصص / Technical (اكتشفه Critic-3 حصراً):**
```javascript
// public/sw.js
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, { ... })
  );
});

self.addEventListener('notificationclick', event => {
  clients.openWindow(data.url); // ⚠️ URL غير مُتحقق منه
});
```
إذا تمكن مهاجم من إرسال push notification (ممكن عبر `/api/push/broadcast`)، يستطيع وضع URL خبيث يُفتح تلقائياً عند نقر المستخدم على الإشعار.

**الإصلاح:**
```javascript
// التحقق من أن URL ينتمي للدومين المعتمد
const allowedOrigin = 'https://yourdomain.com';
const url = new URL(data.url);
if (url.origin === allowedOrigin) {
  clients.openWindow(data.url);
}
```

---

### ثغرة غاب عن جميع الوكلاء — Realtime Data Leak

**للمتخصص / Technical (اكتشفه Critic-3):**
```typescript
// src/context/NewOrdersContext.tsx
supabase.channel('new-orders')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, fetchCount)
  .subscribe();
// بدون RLS، أي مستخدم يفتح أي صفحة يستقبل إشعارات بكل الطلبات الجديدة!
```

```typescript
// src/app/track/page.tsx
supabase.channel(`track-order-${id}`)
  .on('postgres_changes', { ... }, handler) // يكشف driver_lat, driver_lng, driver_phone
```

**للمبتدئ / Non-Technical:**
التطبيق يُرسل تحديثات فورية عن الطلبات الجديدة لكل متصفح مفتوح على الموقع — بما فيه موقع السائق الحي.

---

## 🖥️ أخطاء الواجهات / UI Interface Errors

### UI-1 — أخطاء حرجة في الواجهة

#### UI-1-A: فشل صامت عند إنشاء الطلب
**الملف:** `src/app/cart/page.tsx` السطر 480، `src/app/orders/page.tsx` السطر 277  
**المشكلة:** `order_items.insert` بدون معالجة خطأ — العميل يُحوَّل لصفحة التتبع حتى لو فشلت عملية الحفظ.

#### UI-2-B: سلة التسوق تُفقد عند إعادة تحميل الصفحة
**اكتشفه Critic-3 حصراً**  
**الملف:** `src/context/CartContext.tsx`  
**المشكلة:** `CartContext` لا يحفظ السلة في `localStorage`. إذا أعاد المستخدم تحميل الصفحة، تُمحى السلة كلياً.

**الإصلاح:**
```typescript
// في CartContext.tsx — حفظ السلة تلقائياً
useEffect(() => {
  localStorage.setItem('cart', JSON.stringify(cartItems));
}, [cartItems]);

// استعادة السلة عند التحميل
const [cartItems, setCartItems] = useState<CartItem[]>(() => {
  const saved = localStorage.getItem('cart');
  return saved ? JSON.parse(saved) : [];
});
```

#### UI-1-C: بيانات حساسة في URL Parameters
**اكتشفه Critic-3 حصراً**  
**الملف:** `src/components/InAppBrowserBanner.tsx`  
```typescript
url.searchParams.set('_name', formData.name);   // اسم العميل في URL
url.searchParams.set('_phone', formData.phone);  // رقم الهاتف في URL
url.searchParams.set('_cart', btoa(...));        // السلة في URL
// هذا يظهر في: logs الخادم، تاريخ المتصفح، أدوات التحليل
```

#### UI-1-D: مشاكل أخرى في الواجهة

| المشكلة | الملف | السطر | الخطورة |
|---------|-------|-------|---------|
| `key={idx}` في قوائم العناصر | `orders/page.tsx` | 332, 400 | 🟡 متوسط |
| تجمد loading عند فشل الاتصال | `statistics/page.tsx` | 48 | 🟡 متوسط |
| لا validation لرقم الهاتف | `cart/page.tsx` | 448 | 🟡 متوسط |
| بدون `dir="rtl"` في dashboard السائق | `driver/dashboard/page.tsx` | — | 🟡 متوسط |
| لا empty state في المنيو | `HomeClient.tsx` | 284 | 🟡 متوسط |
| `setInterval` فارغ بدون `clearInterval` | `driver/dashboard/page.tsx` | 74 | 🟢 منخفض |

---

## 🎯 مراجعة النقاد / Critics Review

### Critic-1 — الدقة التقنية / Technical Accuracy

**المشاكل الحقيقية مقابل المُبلَّغ عنها:**

| المعيار | الرقم |
|---------|-------|
| إجمالي المشاكل المُبلَّغة | ~111 |
| المشاكل الفريدة الحقيقية | **~40-50** |
| نسبة الازدواجية | **35-40%** |

**أبرز التصحيحات:**
1. `item_name` كنص في `order_items` هو **snapshot pattern صحيح ومقصود** — ليس خطأ
2. `UNIQUE` على `order_items(order_id, item_id)` **ليست دائماً مطلوبة** — المستخدم قد يطلب نفس الصنف مرتين
3. **تحقق من نوع `extras_json`:** إذا كان `jsonb` وليس `text`، المشكلة أقل حدة بكثير
4. الفهارس المركبة المقترحة مفيدة لملايين السجلات — لمشروع ناشئ الفهارس البسيطة تكفي

**المشاكل الحرجة الحقيقية (3 فقط):**
> **غياب RLS + كلمات مرور plain text + غياب transaction عند الطلب**

---

### Critic-2 — الأولويات والخطورة / Priority Assessment

**أهم درس:**
> "عندما يصبح كل شيء حرجاً، لا شيء يُصلح"

**نتائج بالغ الوكلاء في تصنيفها:**

| المشكلة | التصنيف المبالَغ | التصنيف الصحيح |
|---------|-----------------|----------------|
| `dir="rtl"` | متوسط | ملاحظة تحسين |
| `key={idx}` | متوسط | منخفض في هذا السياق |
| CORS مفتوح | عالي | تحسين (ليس ثغرة فعلية بدون auth) |
| فهارس مركبة | عالي | متوسط-منخفض لحجم المشروع الحالي |

---

### Critic-3 — الاكتمال والنقاط المفقودة / Blind Spots

**ما فات الوكلاء العشرة جميعاً:**

1. **تسرب Realtime** — كل زائر يستقبل إشعارات الطلبات الجديدة
2. **غياب تام للاختبارات** — لا Jest، لا Vitest، لا Cypress في المشروع كله
3. **سلة التسوق تُفقد عند إعادة التحميل** — CartContext لا يحفظ في localStorage
4. **XSS في Service Worker** — `clients.openWindow(data.url)` بدون تحقق
5. **بيانات حساسة في URL** — اسم وهاتف العميل في query parameters
6. **`vercel.json` فارغ** — Cron لا يُجدوَل أبداً
7. **`next.config.ts` فارغ** — لا Security Headers (CSP, X-Frame-Options, إلخ)
8. **`storage.ts` غير مستخدم** — الملف موجود لكن لا يُمرر لـ `createClient`

---

## 🗺️ خارطة الطريق / Action Roadmap

### الأسبوع الأول — طوارئ أمنية 🚨
> الهدف: إيقاف النزيف الأمني الفوري

| # | المهمة | الملف | الوقت المقدر |
|---|--------|-------|-------------|
| 1 | تفعيل RLS على كل الجداول | Supabase Dashboard | يوم كامل |
| 2 | نقل Supabase key لـ ENV + تدوير المفتاح | `src/lib/supabase.ts` | ساعة |
| 3 | إضافة AdminGuard لـ `admin/layout.tsx` | `src/app/admin/layout.tsx` | ساعتان |
| 4 | تشفير كلمات مرور السائقين بـ bcrypt | `driver/page.tsx` + DB | نصف يوم |
| 5 | إصلاح `sw.js` — تحقق من URL | `public/sw.js` | ساعة |

---

### الأسبوع الثاني — سلامة البيانات ⚠️
> الهدف: ضمان صحة البيانات المحفوظة

| # | المهمة | الملف | الوقت المقدر |
|---|--------|-------|-------------|
| 1 | إنشاء RPC للطلب ذري (order + items) | Supabase + `cart/page.tsx` | يوم كامل |
| 2 | إضافة error handling صريح مع رسالة للمستخدم | `cart/page.tsx`, `orders/page.tsx` | نصف يوم |
| 3 | تفعيل FKs على جميع الجداول | Supabase SQL | نصف يوم |
| 4 | إضافة الفهارس الأساسية (9 فهارس) | Supabase SQL | ساعة |
| 5 | حماية `/delivery/[orderId]` بالتحقق من السائق | `delivery/[orderId]/page.tsx` | ساعتان |
| 6 | جدولة الـ Cron في `vercel.json` | `vercel.json` | 30 دقيقة |
| 7 | حفظ السلة في localStorage | `CartContext.tsx` | ساعة |

---

### الأسبوع الثالث — الجودة والأداء 📈
> الهدف: جعل النظام قابلاً للتوسع

| # | المهمة | الملف | الوقت المقدر |
|---|--------|-------|-------------|
| 1 | حل N+1 في 4 صفحات الإدارة | `admin/*` | يومان |
| 2 | حماية cron وPush APIs بـ secret | `api/cron`, `api/push/*` | نصف يوم |
| 3 | إزالة بيانات الهاتف من URL params | `InAppBrowserBanner.tsx` | ساعة |
| 4 | إضافة Security Headers | `next.config.ts` | ساعة |
| 5 | إصلاح الـ setInterval الفارغ | `driver/dashboard/page.tsx` | 30 دقيقة |
| 6 | إضافة pagination على قوائم الطلبات | `admin/orders/page.tsx` | يوم |
| 7 | تصحيح driver_id من text إلى uuid | Supabase SQL | نصف يوم |

---

## 📋 ملحق: قائمة الملفات الأكثر تأثراً / Most Affected Files

| الملف | عدد المشاكل | أعلى خطورة |
|-------|------------|------------|
| `src/app/cart/page.tsx` | 6 | 🔴 حرج |
| `src/components/AdminGuard.tsx` | 2 | 🔴 حرج |
| `src/app/admin/orders/page.tsx` | 4 | 🟠 عالي |
| `src/app/admin/dashboard/page.tsx` | 4 | 🟠 عالي |
| `src/app/driver/page.tsx` | 3 | 🔴 حرج |
| `src/app/delivery/[orderId]/page.tsx` | 3 | 🟠 عالي |
| `src/app/api/cron/expire-orders/route.ts` | 3 | 🟠 عالي |
| `src/lib/supabase.ts` | 1 | 🔴 حرج |
| `public/sw.js` | 1 | 🟠 عالي |
| `vercel.json` | 1 | 🟠 عالي |

---

## 🔑 الخلاصة النهائية / Final Summary

### للمتخصص
المشروع يعاني من ثلاث مشاكل بنيوية حرجة: (1) غياب RLS الكامل مع مفتاح Supabase مكشوف يجعل قاعدة البيانات متاحة للقراءة والكتابة لأي شخص، (2) كلمات مرور plain text تُشكّل خطراً قانونياً وأمنياً، (3) عدم استخدام transactions عند إنشاء الطلبات يتسبب في طلبات فارغة في الإنتاج. الباقي ديون تقنية وتحسينات أداء مهمة لكن غير طارئة.

### للمبتدئ
التطبيق يعمل لكن بابه الخلفي مفتوح. تخيّل محل به خزنة (قاعدة البيانات) مفتوحة القفل، ومفتاحها موضوع على الشباك الخارجي، وكلمات سر موظفيه على ورقة بجانبه. الإصلاح ممكن وخطواته واضحة — الأسبوع الأول هو الأهم.

---

*تم إعداد هذا التقرير بواسطة 13 وكيل ذكاء اصطناعي متخصص (10 وكلاء بحث + 3 وكلاء نقد) في 2026-06-18*  
*Generated by 13 specialized AI agents (10 research + 3 critics) on 2026-06-18*
