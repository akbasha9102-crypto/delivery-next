-- تمييز الطلبات التي أنشأها موظف من داخل لوحة التحكم (كاشير محلي POS، أو
-- مودال "الطلب للزبون" السريع بالداشبورد) عن الطلبات التي أنشأها الزبون
-- الحقيقي بنفسه من منيو الواجهة العامة. الغرض الوحيد حالياً: منع جرس
-- الإشعار الصوتي بـ admin/layout.tsx من الرنين على طلب أنشأه الموظف نفسه.
-- لا علاقة لهذا العمود بـ order_type ولا يُستخدم بأي تصنيف/تقرير آخر —
-- عمداً منفصل تماماً حتى لا يتأثر أي منطق موجود (راجع orders_order_type_check
-- والتصنيفات بـ admin/statistics و admin/archive و admin/kitchen).
-- آمن التكرار — انسخ الملف كاملاً وشغّله مرة واحدة بمحرر SQL بلوحة Supabase.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS created_by_staff boolean NOT NULL DEFAULT false;
