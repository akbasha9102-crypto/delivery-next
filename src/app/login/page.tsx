'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const signIn = async () => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    // اسم المستخدم هو slug المطعم — الإيميل الداخلي مولود تلقائياً
    const email = username.trim().toLowerCase() + '@dasha.app';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      setLoading(false);
      return;
    }
    router.replace('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 stagger-0">
        <h1 className="text-3xl font-bold text-[#4f46e5] mb-0.5 text-center">Dasha</h1>
        <p className="text-xl font-bold text-[#4f46e5] text-center mb-6">داشا</p>
        <p className="text-gray-500 dark:text-slate-400 text-center mb-8 text-sm">تسجيل الدخول لإدارة الطلبات</p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4 text-red-600 dark:text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-700 dark:text-slate-300 font-semibold mb-2 text-sm">اسم المستخدم</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
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
