import { OwnerOnly } from '@/components/guards/OwnerOnly';

// إدارة الموظفين تبقى owner-only حتى بعد فتح /admin/settings العامة
// للكاشير — راجع src/app/admin/dashboard/layout.tsx للتفصيل الأمني الكامل.
// لم تعد مقيَّدة بالباقة (متاحة لكل الباقات standard/professional) —
// أُزيل RequireProfessionalPackage عمداً؛ راجع migration
// 20260806130000 لإزالة قيد الباقة المقابل عن API الموظفين وRLS سجل التدقيق.
export default function StaffManagementLayout({ children }: { children: React.ReactNode }) {
  return (
    <OwnerOnly>{children}</OwnerOnly>
  );
}
