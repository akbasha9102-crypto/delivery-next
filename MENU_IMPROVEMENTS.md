# اقتراحات تطوير صفحة المنيو (Customer Menu)

> هذا الملف يوثّق جميع النقاط الناقصة والمشاكل الوظيفية في صفحة المنيو (`/menu/[slug]`)
> مرتبة حسب الأولوية من الأعلى للأدنى.

---

## 🔴 أولوية عالية جداً — مشاكل وظيفية تؤثر على المبيعات

### 1. الإضافات (Extras) غائبة من نافذة تفصيل الصنف

**الملف:** `src/app/home/HomeClient.tsx` — Modal الصنف (حوالي سطر 540)

**المشكلة:** عند الضغط على أي كارد تفتح نافذة تفصيلية جميلة بالصورة والوصف والسعر — لكنها لا تعرض الإضافات المتاحة للصنف. الزبون لا يعلم بوجود إضافات حتى يصل لصفحة السلة.

**المطلوب:** إضافة قسم الإضافات داخل Modal الصنف قبل زر "إضافة للسلة":

```tsx
{/* Extras in modal */}
{getExtras(selectedItem.extras_json).length > 0 && (
  <div className="px-6 sm:px-10 pb-4">
    <p className="text-sm font-black text-right mb-3 text-gray-500">الإضافات</p>
    <div className="flex flex-wrap gap-2 justify-end">
      {getExtras(selectedItem.extras_json).map(e => {
        const on = modalSelectedExtras.has(e.id);
        return (
          <button key={e.id}
            onClick={() => toggleModalExtra(e.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold border transition-all"
            style={on
              ? { backgroundColor: modalColor, borderColor: modalColor, color: modalTextColor }
              : { backgroundColor: 'transparent', borderColor: '#d1d5db', color: '#6b7280' }
            }
          >
            {e.name}
            {e.price > 0 && <span className="opacity-70">+{e.price.toLocaleString()} د.ع</span>}
          </button>
        );
      })}
    </div>
  </div>
)}
```

يحتاج state جديد:
```tsx
const [modalSelectedExtras, setModalSelectedExtras] = useState<Set<string>>(new Set());
// reset عند فتح صنف جديد
useEffect(() => { setModalSelectedExtras(new Set()); }, [selectedItem?.id]);
```

وتمرير الإضافات المختارة عند الضغط على "إضافة للسلة":
```tsx
addItem({
  id: selectedItem.id,
  name: selectedItem.name,
  price: selectedItem.price,
  image_url: selectedItem.image_url,
  extras_json: selectedItem.extras_json,
  preSelectedExtras: [...modalSelectedExtras], // ← جديد
})
```

---

### 2. زر `+` الصغير في الكارد لا يمرر `extras_json`

**الملف:** `src/app/home/HomeClient.tsx` — سطر 434

**المشكلة:**
```tsx
// ❌ الحالي — extras_json مفقود
onClick={(e) => { e.stopPropagation(); addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url }); }}
```

**الحل:**
```tsx
// ✅ المطلوب
onClick={(e) => { e.stopPropagation(); addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url, extras_json: item.extras_json }); }}
```

---

### 3. زر "إتمام الطلب" في شريط السلة يتجاوز نافذة المراجعة

**الملف:** `src/app/home/HomeClient.tsx` — سطر 513

**المشكلة:** زر "إتمام الطلب" داخل شريط السلة العائم يوجه الزبون مباشرة لـ `/cart` متجاوزاً نافذة المراجعة التي فيها الإضافات والملاحظات.

```tsx
// ❌ الحالي
<Link href="/cart">إتمام الطلب</Link>
```

**الحل المقترح:** استبدال الـ Link بزر يفتح نافذة مراجعة مصغّرة أو على الأقل ينبّه الزبون إذا كان هناك أصناف تحتوي على إضافات غير محددة:
```tsx
// ✅ المطلوب — فتح نافذة المراجعة بدلاً من الانتقال المباشر
<button onClick={() => setShowCartPanel(false)} /* ثم فتح mini-review */>
  إتمام الطلب
</button>
```

---

## 🟠 أولوية عالية — ميزات ناقصة مهمة

### 4. لا يوجد بحث عن الأصناف

**المطلوب:** شريط بحث بسيط أعلى الـ pills أو ضمنها:

```tsx
const [searchQuery, setSearchQuery] = useState('');

const filteredItems = searchQuery.trim()
  ? items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
  : items;
```

وعند وجود نص في البحث، إخفاء الـ pills وعرض نتائج البحث مباشرة:
```tsx
{/* Search Bar */}
<div className="px-4 pb-2">
  <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 border border-gray-100 dark:border-slate-700 shadow-sm">
    <Search size={16} className="text-gray-400"/>
    <input
      type="text"
      value={searchQuery}
      onChange={e => setSearchQuery(e.target.value)}
      placeholder="ابحث عن وجبة..."
      dir="rtl"
      className="flex-1 bg-transparent text-right text-sm outline-none text-gray-900 dark:text-white placeholder-gray-400"
    />
    {searchQuery && (
      <button onClick={() => setSearchQuery('')}><X size={14} className="text-gray-400"/></button>
    )}
  </div>
</div>
```

---

### 5. لا يوجد عرض لرسوم/وقت التوصيل في المنيو

**المطلوب:** إضافة حقول في جدول `settings` أو `restaurants`:
- `delivery_fee` — رسوم التوصيل
- `delivery_time_min` — وقت التوصيل التقديري

وعرضها في هيدر المنيو أسفل الاسم:
```tsx
<div className="flex items-center justify-center gap-4 text-xs text-gray-500 mt-1">
  {delivery_fee > 0 && <span>🛵 {delivery_fee.toLocaleString()} د.ع توصيل</span>}
  {delivery_time && <span>⏱ {delivery_time} دقيقة</span>}
</div>
```

---

### 6. لا يوجد badge "الأكثر طلباً" أو "جديد"

**المطلوب:** إضافة حقل `item_badge` في جدول `items` (قيمه: `popular`, `new`, `offer`, `null`):

```tsx
// في كارد المنتج
{item.item_badge === 'popular' && (
  <div className="absolute top-3 right-3 bg-amber-400 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-md z-10">
    🔥 الأكثر طلباً
  </div>
)}
{item.item_badge === 'new' && (
  <div className="absolute top-3 right-3 bg-green-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-md z-10">
    ✨ جديد
  </div>
)}
```

---

## 🟡 أولوية متوسطة — تحسينات UX

### 7. عرض عدد الأصناف على كل فئة (pill)

```tsx
// الحالي
{cat.name}

// المطلوب
{cat.name}
<span className="ml-1 opacity-60 text-[10px]">
  {items.filter(i => i.category_id === cat.id && getStatus(i) === 'available').length}
</span>
```

---

### 8. شريط السلة العائم يغطي آخر كارد على الشاشات الصغيرة

**الملف:** `src/app/home/HomeClient.tsx` — الـ wrapper الرئيسي

**الحالي:**
```tsx
<div className="min-h-screen bg-gray-50/50 dark:bg-slate-950 pb-36">
```

**المطلوب:** زيادة الـ padding عند وجود أصناف في السلة:
```tsx
<div className={`min-h-screen bg-gray-50/50 dark:bg-slate-950 ${cartItems.length > 0 ? 'pb-52' : 'pb-36'}`}>
```

---

### 9. صورة غلاف (Cover Banner) للمطعم

**المطلوب:** إضافة حقل `cover_url` في جدول `settings`، وعرض صورة الغلاف أسفل الهيدر مباشرة:

```tsx
{cover_url && (
  <div className="relative w-full h-40 overflow-hidden">
    <Image src={cover_url} alt={brandName} fill className="object-cover" unoptimized/>
    <div className="absolute inset-0 bg-gradient-to-t from-gray-50/80 dark:from-slate-950/80 to-transparent"/>
  </div>
)}
```

---

### 10. حد أدنى للطلب (Minimum Order)

**المطلوب:** إضافة حقل `min_order_amount` في جدول `settings`، وعرض تحذير في شريط السلة إذا لم يُبلَّغ الحد:

```tsx
{min_order_amount > 0 && total < min_order_amount && (
  <p className="text-xs text-amber-500 font-bold text-center mb-2">
    الحد الأدنى للطلب {min_order_amount.toLocaleString()} د.ع
    (ناقص {(min_order_amount - total).toLocaleString()} د.ع)
  </p>
)}
```

---

### 11. مشاركة رابط المنيو (Share Button)

**المطلوب:** زر Share في الهيدر يستخدم Web Share API:

```tsx
{navigator.share && (
  <button onClick={() => navigator.share({ title: brandName, url: window.location.href })}>
    <Share2 size={18} className="text-gray-400"/>
  </button>
)}
```

---

## 🟢 أولوية منخفضة — تحسينات بصرية

### 12. تحريك الـ pill النشط بشكل أكثر سلاسة

**المطلوب:** استخدام `layoutId` من Framer Motion بدلاً من تغيير الـ styles يدوياً:
```tsx
{isActive && (
  <motion.div layoutId="activePill" className="absolute inset-0 rounded-[1.2rem]"
    style={{ backgroundColor: catColor }}
    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
  />
)}
```

---

### 13. Skeleton لكارد الصنف يختلف عن الشكل الفعلي

**المطلوب:** تعديل الـ skeleton ليطابق نسب الكارد الحقيقي تماماً (الـ `h-32 sm:h-56` للصورة).

---

### 14. لا يوجد "لا نتائج" عند البحث

عند تطبيق البحث (اقتراح #4)، يجب عرض رسالة واضحة عند عدم وجود نتائج:
```tsx
{searchQuery && filteredItems.length === 0 && (
  <div className="flex flex-col items-center py-16 gap-3">
    <span className="text-4xl">🔍</span>
    <p className="text-gray-400 font-bold">لا توجد نتائج لـ "{searchQuery}"</p>
  </div>
)}
```

---

## 📋 ملخص التغييرات المطلوبة في قاعدة البيانات

| الجدول | الحقل الجديد | النوع | الوصف |
|--------|------------|-------|-------|
| `items` | `item_badge` | `text` nullable | قيمة: `popular`, `new`, `offer` |
| `settings` | `delivery_fee` | `integer` | رسوم التوصيل بالدينار |
| `settings` | `delivery_time` | `text` | مثال: "30-45" |
| `settings` | `min_order_amount` | `integer` | الحد الأدنى للطلب |
| `settings` | `cover_url` | `text` | رابط صورة الغلاف |

---

## 📁 الملفات المتأثرة بالتغييرات

| الملف | التغييرات |
|-------|-----------|
| `src/app/home/HomeClient.tsx` | الإضافات في Modal، بحث، badges، padding، share |
| `src/app/cart/page.tsx` | استقبال preSelectedExtras من الـ modal |
| `src/context/CartContext.tsx` | دعم preSelectedExtras عند addItem |
| `src/context/SettingsContext.tsx` | إضافة حقول delivery_fee, delivery_time, min_order, cover_url |
| `supabase/migrations/` | إضافة الحقول الجديدة |
