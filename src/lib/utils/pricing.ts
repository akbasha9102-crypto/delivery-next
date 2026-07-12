// دوال حساب الخصم المشتركة — تُستخدم بقائمة الزبون (HomeClient) ولوحة تحكم المطعم (إعدادات الخصومات)

/** يطبّق نسبة خصم على سعر ويقرّب الناتج. لا خصم إن كانت النسبة صفر أو أقل. */
export function applyDiscountPct(price: number, pct: number): number {
  return pct > 0 ? Math.round(price * (1 - pct / 100)) : price;
}

/** نسبة الخصم الفعّالة: خصم العنصر نفسه له الأولوية على خصم القسم — لا يُجمعان أبداً */
export function getEffectivePct(itemPct: number | null | undefined, categoryPct: number | null | undefined): number {
  if (itemPct && itemPct > 0) return itemPct;
  if (categoryPct && categoryPct > 0) return categoryPct;
  return 0;
}
