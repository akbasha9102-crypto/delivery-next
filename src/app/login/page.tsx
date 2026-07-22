'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight, Loader2 } from 'lucide-react';
import { mashiRoundedFont, MASHI_FONT } from '@/app/home/brand';
import { supabase } from '@/lib/supabase/client';

const inputClass =
  'w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[#1d1d1f] text-sm outline-none focus:border-[#15803D]/50 placeholder:text-[#86868b] transition-colors';

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const signIn = async () => {
    if (!identifier.trim() || !password.trim()) return;
    setLoading(true);
    setError('');

    const local = identifier.trim().split('@')[0].trim().toLowerCase();

    const res = await fetch('/api/auth/resolve-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: local }),
    });
    const resolved = await res.json().catch(() => ({}));

    if (!res.ok || !resolved.email) {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: resolved.email,
      password: password.trim(),
    });
    if (signInError) {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      setLoading(false);
      return;
    }
    router.replace('/admin/dashboard');
  };

  return (
    <div className={`min-h-screen bg-white text-[#1d1d1f] ${mashiRoundedFont.variable}`} dir="rtl">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 backdrop-blur-2xl backdrop-saturate-150 bg-[#1d1d1f]/80 border-b border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] px-4 py-3.5">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <Link href="/" className="text-xl font-extrabold text-[#4ADE80]" style={MASHI_FONT}>
            ماشي
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-white/80 text-sm font-bold active:scale-95 transition-all"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
            الرجوع للرئيسية
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:pt-20 sm:pb-24 min-h-[calc(100vh-64px)] flex items-center">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 20%, rgba(52,199,89,0.06) 0%, rgba(255,255,255,0) 70%), linear-gradient(180deg, rgba(52,199,89,0.04) 0%, rgba(255,255,255,0) 40%)',
          }}
        />
        <div className="relative max-w-sm mx-auto w-full">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-3xl sm:text-4xl font-extrabold text-center leading-tight text-[#1d1d1f]"
            style={MASHI_FONT}
          >
            تسجيل الدخول إلى <span className="text-[#15803D]">ماشي</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="mt-3 text-center text-sm text-[#6e6e73] leading-relaxed"
          >
            تسجيل الدخول لإدارة الطلبات
          </motion.p>

          <motion.form
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            onSubmit={(e) => { e.preventDefault(); signIn(); }}
            className="mt-8 bg-white border border-black/5 shadow-[0_2px_30px_rgba(0,0,0,0.06)] rounded-3xl p-6 flex flex-col gap-4"
          >
            <div>
              <label htmlFor="login-identifier" className="block text-sm font-bold text-[#1d1d1f] mb-1.5">
                البريد الإلكتروني أو اسم المستخدم
              </label>
              <input
                id="login-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="mashi_restaurant"
                dir="ltr"
                className={`${inputClass} font-mono text-left`}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-bold text-[#1d1d1f] mb-1.5">
                كلمة المرور
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className={`${inputClass} text-left`}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm text-center"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="mt-2 w-full py-4 rounded-2xl bg-[#1d1d1f] text-white font-black text-base active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
            </button>
          </motion.form>
        </div>
      </section>
    </div>
  );
}
