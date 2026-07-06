import { OwnerOnly } from '@/components/OwnerOnly';

// راجع التعليق التفصيلي بـ src/app/admin/dashboard/layout.tsx — نفس الإصلاح
// الأمني (منع mount الصفحة قبل تأكيد الدور، وليس فقط إخفاء العرض).
export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return <OwnerOnly>{children}</OwnerOnly>;
}
