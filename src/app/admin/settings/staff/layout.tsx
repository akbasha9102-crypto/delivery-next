import { OwnerOnly } from '@/components/guards/OwnerOnly';
import { RequireProfessionalPackage } from '@/components/guards/RequireProfessionalPackage';

// إدارة الموظفين تبقى owner-only حتى بعد فتح /admin/settings العامة
// للكاشير — راجع src/app/admin/dashboard/layout.tsx للتفصيل الأمني الكامل.
// مقيَّدة أيضاً بالباقة المحترفين (RequireProfessionalPackage) — طبقة
// إضافية داخل OwnerOnly، لا تستبدله.
export default function StaffManagementLayout({ children }: { children: React.ReactNode }) {
  return (
    <OwnerOnly>
      <RequireProfessionalPackage>{children}</RequireProfessionalPackage>
    </OwnerOnly>
  );
}
