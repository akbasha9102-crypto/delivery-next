'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'mashi_pending_signup';

export type PendingSignup = { phone: string; username: string };

export function getPendingSignup(): PendingSignup | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.phone === 'string' && typeof parsed?.username === 'string') {
      return { phone: parsed.phone, username: parsed.username };
    }
    return null;
  } catch {
    return null;
  }
}

export function setPendingSignup(value: PendingSignup): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function clearPendingSignup(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function usePendingSignupRedirect(): void {
  const router = useRouter();
  useEffect(() => {
    if (getPendingSignup()) {
      router.replace('/track-signup');
    }
  }, [router]);
}
