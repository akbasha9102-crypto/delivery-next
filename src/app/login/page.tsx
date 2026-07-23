'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { mashiRoundedFont, MASHI_FONT, BRAND } from '../home/brand';

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
          className={`${mashiRoundedFont.variable} text-6xl font-extrabold text-center mb-1`}
          style={{
            ...MASHI_FONT,
            color: BRAND.green,
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
          ماشي
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
            className="w-full bg-gray-300 border border-gray-400 rounded-xl px-4 py-3 text-left text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:ring-2 focus:ring-[#110d50]/50 focus:border-[#110d50]/40 transition-all font-mono"
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
            className="w-full bg-gray-300 border border-gray-400 rounded-xl px-4 py-3 text-right text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:ring-2 focus:ring-[#110d50]/50 focus:border-[#110d50]/40 transition-all"
          />
        </div>
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#110d50] to-[#0E0B41] hover:from-[#0E0B41] hover:to-[#0C0938] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-[0_10px_25px_-5px_rgba(17,13,80,0.5)] transition-all active:scale-95"
        >
          {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>
      </div>
    </div>
  );
}
