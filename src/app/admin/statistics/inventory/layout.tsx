import { RequireProfessionalPackage } from '@/components/guards/RequireProfessionalPackage';

// إحصائيات المخزون مقيَّدة بالباقة المحترفين فقط. هذا nested layout تحت
// statistics/layout.tsx الموجود (الذي يوفر OwnerOnly على مستوى أعلى ويبقى
// بلا تغيير) — Next.js يدمج الـ layouts المتداخلة تلقائياً، فلا داعي
// لتكرار OwnerOnly هنا.
export default function StatisticsInventoryLayout({ children }: { children: React.ReactNode }) {
  return <RequireProfessionalPackage>{children}</RequireProfessionalPackage>;
}
