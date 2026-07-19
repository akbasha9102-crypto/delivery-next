import DriverBottomNav from './_components/DriverBottomNav';

export const dynamic = 'force-dynamic';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white" style={{ fontFamily: 'var(--font-brand-name)' }}>
      {children}
      <DriverBottomNav />
    </div>
  );
}
