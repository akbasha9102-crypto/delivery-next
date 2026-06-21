# مبادئ التطوير — delivery-next

## القاعدة الذهبية — لا تقبل نقاشاً

> قبل إضافة أي ميزة أو تعديل في قاعدة البيانات، يجب المرور بالخطوات الثلاث التالية بالترتيب.
> هذه القاعدة **غير قابلة للتجاوز**.

---

## الخطوة 1 — تحليل التأثير على قاعدة البيانات

قبل أي ميزة جديدة، أجب على هذه الأسئلة:

- هل الميزة تحتاج عموداً جديداً؟ → هل هو nullable؟ هل له FK؟
- هل تعدّل جدولاً موجوداً؟ → هل التعديل يكسر البيانات الحالية؟
- هل تضيف علاقة جديدة؟ → هل العلاقة مدعومة بـ FK فعلي في قاعدة البيانات؟
- هل الاستعلامات الجديدة لها indexes؟

---

## الخطوة 2 — إرسال وكيل تحليل المخاطر

**قبل تنفيذ أي تعديل على قاعدة البيانات أو منطق الاستعلام، أطلق وكيل تحليل مستقل يجيب على:**

1. هل هذا التعديل يكسر وظيفة قائمة؟
2. هل يؤثر على بيانات حقيقية موجودة؟
3. هل هناك edge case يسبب بيانات فارغة أو تناقض؟
4. ما درجة الخطورة: منخفض / متوسط / عالٍ؟

إذا كانت الدرجة **عالٍ** → وقّف التنفيذ وارجع للمطوّر أولاً.

---

## الخطوة 3 — تنفيذ آمن بالترتيب

1. **Code changes أولاً** (additive دائماً — لا تحذف عموداً يُستخدم في الكود)
2. **Database migrations ثانياً** (فحص البيانات اليتيمة قبل أي FK)
3. **RLS آخراً** (أكثر العمليات خطورة — تحتاج تصميم كامل)

---

## الجداول والعلاقات الحالية (2026-06-21)

```
restaurants (id, name, slug, owner_id)
    ↓ restaurant_id
categories (id, name, restaurant_id)
    ↓ category_id
items (id, name, price, category_id, restaurant_id, extras_json)
    ↓ item_id
extras (id, name, price, item_id)
order_items (id, order_id, item_id, quantity, price, item_name)

orders (id, user_id→auth.users, client_name, client_phone,
        restaurant_id, driver_fk→drivers, driver_id[legacy],
        status, total_amount, client_lat, client_lng,
        driver_lat, driver_lng, driver_arrived)
    ↓ order_id
order_feedback (id, order_id, client_name, client_phone, type, message)

restaurant_settings (id, restaurant_id, primary_color, logo_url,
                     is_closed, schedule, admin_email, admin_password)
drivers (id, name, phone, password, status, restaurant_id)
profiles (id, role, name, phone)
```

### ملاحظات حرجة تعرفها:
- `orders.user_id` ← يُحفظ الآن عند تسجيل الدخول، لكن الطلبات القديمة لا تملكه
- `orders.driver_id` ← مستخدم في الكود (9+ مكان)، بدون FK — لا تضف FK عليه بدون مراجعة كاملة
- `orders.driver_fk` ← له FK لكن الكود لا يستخدمه — inconsistency معلّق
- RLS ← مفتوح تماماً على كل الجداول (`qual: true`) — تضييقه يكسر الداشبورد والسائق
- كلمات مرور الأدمن والسائق مخزّنة plain text — مشكلة أمنية معروفة ومؤجّلة

---

## عند إضافة ميزة تخص الزبون (customer)

- تأكد أن الطلب يحفظ `user_id` إذا الزبون مسجّل
- تأكد أن الاستعلام يدعم **كلا الحالتين**: زبون مسجّل (user_id) وزبون ضيف (client_phone)
- لا تستبدل `client_phone` بـ `user_id` — استخدم OR: `.or('user_id.eq.X,client_phone.eq.Y')`

---

## Indexes الموجودة على orders (2026-06-21)

- `idx_orders_user_id` — على `user_id`
- `idx_orders_client_phone` — على `client_phone`
- `idx_orders_restaurant_id` — على `restaurant_id`
- `idx_orders_restaurant` — على `restaurant_id` (مكرر، موجود مسبقاً)
