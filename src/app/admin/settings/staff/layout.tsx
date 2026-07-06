import { OwnerOnly } from '@/components/OwnerOnly';

// إدارة الموظفين تبقى owner-only حتى بعد فتح /admin/settings العامة
// للكاشير — راجع src/app/admin/dashboard/layout.tsx للتفصيل الأمني الكامل.
export default function StaffManagementLayout({ children }: { children: React.ReactNode }) {
  return <OwnerOnly>{children}</OwnerOnly>;
}
