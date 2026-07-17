'use client';
import { useState } from 'react';
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 stagger-0">
        <div className="flex justify-center mb-6">
          <span
            dir="rtl"
            className="text-8xl leading-none whitespace-nowrap font-bold bg-gradient-to-bl from-blue-400 to-blue-950 bg-clip-text text-transparent [font-family:var(--font-logo)]"
          >
            سهل
          </span>
        </div>

        <p className="text-gray-500 dark:text-slate-400 text-center mb-6 text-sm">تسجيل الدخول لإدارة الطلبات</p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4 text-red-600 dark:text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-700 dark:text-slate-300 font-semibold mb-2 text-sm">البريد الإلكتروني أو اسم المستخدم</label>
          <input
            type="text"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            placeholder="dari"
            dir="ltr"
            className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-left text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#4f46e5] font-mono"
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 dark:text-slate-300 font-semibold mb-2 text-sm">كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && signIn()}
            placeholder="••••••••"
            className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#4f46e5]"
          />
        </div>
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95"
        >
          {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>
      </div>
    </div>
  );
}
