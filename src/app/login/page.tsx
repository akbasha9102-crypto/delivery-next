'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Reem_Kufi } from 'next/font/google';
import { BRAND } from '../home/brand';

// خط عنوان "MaShe" (Reem Kufi) الخاص بصفحة تسجيل الدخول فقط — لا علاقة له بـ mashiRoundedFont المشترك بـ brand.ts
const loginTitleFont = Reem_Kufi({
  subsets: ['latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-login-title',
});

const LOGIN_TITLE_FONT_FAMILY = {
  fontFamily: 'var(--font-login-title), "Reem Kufi", sans-serif',
};

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
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm card-float-in">
        <h1
          className={`${loginTitleFont.variable} text-6xl font-extrabold text-center mb-1`}
          dir="ltr"
          style={{
            ...LOGIN_TITLE_FONT_FAMILY,
            color: BRAND.green,
          }}
        >
          <span
            style={{
              WebkitTextStroke: `0.3px ${BRAND.dark}`,
              textShadow: [
                `0.3px 0 0 ${BRAND.dark}`,
                `-0.3px 0 0 ${BRAND.dark}`,
                `0 0.3px 0 ${BRAND.dark}`,
                `0 -0.3px 0 ${BRAND.dark}`,
                `0.3px 0.3px 0 ${BRAND.dark}`,
                `-0.3px 0.3px 0 ${BRAND.dark}`,
                `0.3px -0.3px 0 ${BRAND.dark}`,
                `-0.3px -0.3px 0 ${BRAND.dark}`,
              ].join(', '),
            }}
          >
            M
          </span>aShe
        </h1>
        <p className="text-[#1d1d1f]/70 text-center mb-6 text-sm">تسجيل الدخول لإدارة مطعمك</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-[#1d1d1f] font-semibold mb-2 text-sm">البريد الإلكتروني أو اسم المستخدم</label>
          <input
            type="text"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            dir="ltr"
            className="w-full bg-gray-300 border border-gray-400 rounded-xl px-4 py-3 text-left text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:ring-2 focus:ring-[#D96846]/50 focus:border-[#D96846]/40 transition-all font-mono"
          />
        </div>
        <div className="mb-6">
          <label className="block text-[#1d1d1f] font-semibold mb-2 text-sm">كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && signIn()}
            placeholder="••••••••"
            className="w-full bg-gray-300 border border-gray-400 rounded-xl px-4 py-3 text-right text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:ring-2 focus:ring-[#D96846]/50 focus:border-[#D96846]/40 transition-all"
          />
        </div>
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full bg-[#15803D] hover:bg-[#15803D] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-[0_10px_25px_-5px_rgba(21,128,61,0.5)] transition-all active:scale-95"
        >
          {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>
      </div>
    </div>
  );
}
