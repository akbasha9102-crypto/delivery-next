import { OwnerOnly } from '@/components/OwnerOnly';

// حارس مستوى الـ layout — يمنع mount صفحة المالك بالكامل (وبالتالي أي
// useEffect بداخلها يجيب بيانات حساسة) حتى تأكيد أن الدور النشط ليس
// كاشيراً. إصلاح ثغرة أمنية حرجة اكتشفتها مراجعة مستقلة: <OwnerOnly>
// المُستخدَم *داخل* الصفحة نفسها يمنع العرض البصري فقط، لكن الـ hooks
// بجسم مكوّن الصفحة تُنفَّذ دائماً عند mount بصرف النظر عمّا تُقرِّر
// إرجاعه — فكان استعلام البيانات الفعلي يصل عبر الشبكة لجهاز الكاشير
// قبل إعادة توجيهه. الحارس هنا على مستوى layout يمنع mount الصفحة
// (وبالتالي الـ hooks) من الأساس.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <OwnerOnly>{children}</OwnerOnly>;
}
