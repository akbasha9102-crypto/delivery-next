import { SuperAdminGuard } from '@/components/guards/SuperAdminGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminGuard>{children}</SuperAdminGuard>;
}
