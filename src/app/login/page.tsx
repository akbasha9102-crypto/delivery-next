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
    <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-sm rounded-[14px] p-6 bg-white border-2 border-[#15803D]/70 shadow-[0_20px_45px_-15px_rgba(21,128,61,0.35),0_8px_20px_-6px_rgba(21,128,61,0.18)] card-float-in transition-transform duration-300 ease-out hover:-translate-y-1 hover:border-[#15803D] hover:shadow-[0_28px_60px_-15px_rgba(21,128,61,0.4),0_10px_24px_-6px_rgba(21,128,61,0.22)]">
        <h1
          className={`${mashiRoundedFont.variable} text-4xl font-extrabold text-center mb-1`}
          style={{
            ...MASHI_FONT,
            color: BRAND.green,
            textShadow: '0 1px 2px rgba(6,54,25,0.25), 0 4px 14px rgba(21,128,61,0.35), 0 0 30px rgba(74,222,128,0.25)',
          }}
        >
          ماشي
        </h1>
        <p className="text-[#1d1d1f]/70 text-center mb-6 text-sm">تسجيل الدخول لإدارة الطلبات</p>

        {error && (
          <div className="bg-red-50/90 backdrop-blur-sm border border-red-200/70 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-[#1d1d1f] font-semibold mb-2 text-sm">البريد الإلكتروني أو اسم المستخدم</label>
          <input
            type="text"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            placeholder="dari"
            dir="ltr"
            className="w-full bg-white border border-[#15803D]/40 rounded-xl px-4 py-3 text-left text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:ring-2 focus:ring-[#15803D]/30 focus:border-[#15803D] transition-all font-mono"
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
            className="w-full bg-white border border-[#15803D]/40 rounded-xl px-4 py-3 text-right text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:ring-2 focus:ring-[#15803D]/30 focus:border-[#15803D] transition-all"
          />
        </div>
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#15803D] to-[#116830] hover:from-[#116830] hover:to-[#0e5a2b] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-[0_10px_25px_-5px_rgba(21,128,61,0.5)] transition-all active:scale-95"
        >
          {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>
      </div>
    </div>
  );
}
