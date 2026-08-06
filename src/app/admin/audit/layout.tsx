import { OwnerOnly } from '@/components/guards/OwnerOnly';

// راجع التعليق التفصيلي بـ src/app/admin/dashboard/layout.tsx — نفس الإصلاح
// الأمني (منع mount الصفحة قبل تأكيد الدور، وليس فقط إخفاء العرض). حرجة
// خصوصاً هنا لأن هذه الصفحة تعرض staff_actions_log كاملاً. لم تعد مقيَّدة
// بالباقة — أُزيل RequireProfessionalPackage عمداً؛ راجع migration
// 20260806130000 لتعديل سياسة RLS المقابلة على staff_actions_log (كانت
// تمنع القراءة لباقة standard على مستوى قاعدة البيانات، وليس الواجهة فقط).
export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <OwnerOnly>{children}</OwnerOnly>
  );
}
