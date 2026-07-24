'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

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
      <div className="w-full max-w-sm card-float-in border border-[#1d1d1f]/10 rounded-3xl p-8">
        <div className="text-center mb-1">
          <Image
            src="/mashi-logo.png"
            alt="ماشي"
            width={957}
            height={521}
            priority
            className="h-16 w-auto inline-block"
          />
        </div>
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
            className="w-full bg-gray-300 border border-gray-400 rounded-xl px-4 py-3 text-left text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:ring-2 focus:ring-[#1d1d1f]/50 focus:border-[#1d1d1f]/40 transition-all font-mono"
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
            className="w-full bg-gray-300 border border-gray-400 rounded-xl px-4 py-3 text-right text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:ring-2 focus:ring-[#1d1d1f]/50 focus:border-[#1d1d1f]/40 transition-all"
          />
        </div>
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full bg-[#12301F] hover:bg-[#12301F] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-[0_10px_25px_-5px_rgba(18,48,31,0.5)] transition-all active:scale-95"
        >
          {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>
      </div>
    </div>
  );
}
