import { SuperAdminGuard } from '@/components/guards/SuperAdminGuard';
import { changaFont, ADMIN_FONT_STYLE } from '@/lib/fonts';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={changaFont.variable} style={ADMIN_FONT_STYLE}>
      <SuperAdminGuard>{children}</SuperAdminGuard>
    </div>
  );
}
