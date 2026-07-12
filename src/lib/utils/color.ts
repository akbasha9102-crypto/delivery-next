// دوال ألوان مشتركة — تُستخدم بصفحات الزبون لحساب تباين النص فوق لون العلامة التجارية وتوليد ظلال منه

/** يحسب سطوع اللون (WCAG relative luminance) ويعيد أسود أو أبيض — أيهما أوضح فوق هذا اللون */
export function getTextColor(hexColor: string): string {
  const h = hexColor.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? '#000000' : '#ffffff';
}

/** يُغمّق (أو يُفتّح إن كانت amt سالبة بالسالب) لوناً بمقدار amt لكل قناة RGB */
export function darken(hex: string, amt: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** يستخرج أول حرفين من اسم لعرضهما داخل شارة الأفاتار الدائرية */
export function getInitials(n: string): string {
  const parts = n.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[1][0];
}
