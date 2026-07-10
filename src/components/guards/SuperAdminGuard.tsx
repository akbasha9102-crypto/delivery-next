'use client';

// الحماية تتم عبر middleware.ts — هذا الـ Guard يعرض المحتوى مباشرة
export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
