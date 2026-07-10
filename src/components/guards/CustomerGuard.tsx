'use client';
import { useSettings } from '@/context/SettingsContext';

export function CustomerGuard({ children }: { children: React.ReactNode }) {
  const { is_suspended, loaded } = useSettings();
  if (!loaded) return null;
  if (is_suspended) return <div className="min-h-screen bg-white" />;
  return <>{children}</>;
}
