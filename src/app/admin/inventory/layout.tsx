import { RequireProfessionalPackage } from '@/components/guards/RequireProfessionalPackage';

// المخزون مقيَّد بالباقة المحترفين فقط — بخلاف staff/audit، لا يُغلَّف بـ
// OwnerOnly هنا: الكاشير له نفس وصول المالك الكامل لهذا القسم بالتصميم
// (راجع AdminBottomNav بـ src/components/layout/BottomNav.tsx). القيد هنا
// على مستوى الباقة فقط، بصرف النظر عن الدور. يغطي هذا الملف page.tsx
// و waste/page.tsx معاً بحكم تداخل المسار.
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return <RequireProfessionalPackage>{children}</RequireProfessionalPackage>;
}
