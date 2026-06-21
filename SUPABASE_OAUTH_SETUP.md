# إعداد تسجيل الدخول بجوجل — Supabase OAuth

## سبب المشكلة

عند الضغط على "تسجيل الدخول بجوجل"، يحوّل المتصفح المستخدم إلى Google ثم يعيده إلى Supabase، والتي بدورها تعيد توجيهه إلى الموقع.

المشكلة تحدث لأن Supabase يحتاج أن يعرف **عناوين المواقع المسموح بها** مسبقاً. إذا لم يُضف عنوان الموقع الحقيقي في الإعدادات، يرجع Supabase إلى الـ **Site URL** الافتراضي — وهو غالباً `http://localhost:3000` إذا لم يُغيَّر — فيحوّل المستخدم إلى localhost التي لا تفتح على الإنترنت.

---

## الحل خطوة بخطوة

### الخطوة 1 — افتح إعدادات Supabase

1. اذهب إلى [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك
3. من القائمة الجانبية: **Authentication → URL Configuration**

---

### الخطوة 2 — عدّل الـ Site URL

في حقل **Site URL**، ضع عنوان موقعك الرئيسي:

```
https://your-domain.vercel.app
```

> هذا الحقل يقبل عنواناً واحداً فقط، اختر الموقع الأكثر استخداماً.

---

### الخطوة 3 — أضف عناوين الـ Redirect URLs

في قسم **Redirect URLs**، أضف كل موقع على سطر مستقل مع `/**` في النهاية:

```
https://site1.vercel.app/**
https://site2.vercel.app/**
https://custom-domain1.com/**
https://custom-domain2.com/**
```

> الـ `/**` ضروري — يعني "اقبل أي مسار تحت هذا الدومين"  
> مثال: `/cart` و `/profile` و `/track` كلها تُقبل تلقائياً.

---

### الخطوة 4 — احفظ التغييرات

اضغط **Save** في أسفل الصفحة.

---

## لماذا يعمل الكود بدون تعديل؟

الكود يستخدم `window.location.origin` في الـ `redirectTo`:

```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.origin + '/profile' },
});
```

`window.location.origin` يعطي عنوان الموقع الحالي تلقائياً — سواء كان `localhost` أو Vercel أو دومين خاص. الكود صحيح، المشكلة كانت فقط في إعدادات Supabase.

---

## ملاحظة — إضافة موقع جديد مستقبلاً

في كل مرة تضيف موقعاً جديداً، فقط أضف سطراً جديداً في **Redirect URLs**:

```
https://new-site.vercel.app/**
```

لا تحتاج لتعديل أي كود.
