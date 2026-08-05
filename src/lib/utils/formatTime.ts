// تنسيق وقت بصيغة 12 ساعة بالعربي — "7:22 صباحاً" (بدون صفر بادئ للساعة،
// أرقام لاتينية عادية، و"صباحاً"/"مساءً" كاملتين وليس اختصار ص/م). لا نعتمد
// على toLocaleTimeString(..., { hour12: true }) لأن شكل الناتج (ص/م أو AM/PM
// أو ترتيب مختلف) غير مضمون عبر بيئات Node/متصفحات مختلفة.
export function formatTime12h(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours24 < 12 ? 'صباحاً' : 'مساءً';
  return `${hours12}:${minutes} ${period}`;
}
