import { SuperAdminGuard } from '@/components/SuperAdminGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminGuard>{children}</SuperAdminGuard>;
}
