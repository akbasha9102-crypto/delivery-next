// تحويل وحدات القياس بين وحدة المخزون ووحدة سطر الوصفة — يُستخدم بإدارة المكونات وبخصم المخزون التلقائي

type UnitDimension = 'mass' | 'volume' | 'count';

const UNIT_INFO: Record<string, { dim: UnitDimension; toBase: number }> = {
  'غرام':   { dim: 'mass',   toBase: 1 },
  'كيلو':   { dim: 'mass',   toBase: 1000 },
  'مل':     { dim: 'volume', toBase: 1 },
  'لتر':    { dim: 'volume', toBase: 1000 },
  'عدد':    { dim: 'count',  toBase: 1 },
  'علبة':   { dim: 'count',  toBase: 1 },
  'كيس':    { dim: 'count',  toBase: 1 },
  'صندوق':  { dim: 'count',  toBase: 1 },
};

/** الوحدات القابلة للاختيار لسطر وصفة يرتبط بمادة مخزون بوحدة inventoryUnit — نفس البُعد فقط (وحدات العدّ لا تُحوَّل فيما بينها لأن حجمها غير موحّد) */
export function compatibleUnits(inventoryUnit: string): string[] {
  const info = UNIT_INFO[inventoryUnit];
  if (!info || info.dim === 'count') return [inventoryUnit];
  return Object.entries(UNIT_INFO).filter(([, v]) => v.dim === info.dim).map(([u]) => u);
}

/** يحوّل كمية مُدخلة بوحدة سطر الوصفة (recipeUnit) إلى مقياس وحدة المخزون (inventoryUnit) لخصمها من current_stock */
export function convertToInventoryUnit(qty: number, recipeUnit: string | null | undefined, inventoryUnit: string | null | undefined): number {
  if (!recipeUnit || !inventoryUnit || recipeUnit === inventoryUnit) return qty;
  const from = UNIT_INFO[recipeUnit];
  const to = UNIT_INFO[inventoryUnit];
  if (!from || !to || from.dim !== to.dim) return qty; // غير قابل للتحويل — نفترض تطابق الوحدتين كالسابق
  return (qty * from.toBase) / to.toBase;
}
