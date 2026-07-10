import { OwnerOnly } from '@/components/guards/OwnerOnly';

// راجع التعليق التفصيلي بـ src/app/admin/dashboard/layout.tsx — نفس الإصلاح
// الأمني (منع mount الصفحة قبل تأكيد الدور، وليس فقط إخفاء العرض). حرجة
// خصوصاً هنا لأن هذه الصفحة تعرض staff_actions_log كاملاً.
export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return <OwnerOnly>{children}</OwnerOnly>;
}
