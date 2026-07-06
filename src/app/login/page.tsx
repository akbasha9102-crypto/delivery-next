'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { staffCodeToEmail } from '@/lib/staff-auth';

type Mode = 'owner' | 'staff';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('owner');

  // تبويب المالك
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // تبويب الموظف (كاشير/مدير) — كود + كلمة مرور، حساب دخول مستقل تماماً عن المالك
  const [code, setCode] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const signInOwner = async () => {
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

  const signInStaff = async () => {
    if (!code.trim() || !staffPassword.trim()) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: staffCodeToEmail(code),
      password: staffPassword,
    });
    if (error) {
      setError('الكود أو كلمة المرور غير صحيحة');
      setLoading(false);
      return;
    }
    router.replace('/admin/dashboard');
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 stagger-0">
        <h1 className="text-3xl font-bold text-[#4f46e5] mb-0.5 text-center">Dasha</h1>
        <p className="text-xl font-bold text-[#4f46e5] text-center mb-6">داشا</p>

        <div className="flex bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-6">
          <button
            onClick={() => switchMode('owner')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'owner' ? 'bg-white dark:bg-slate-800 text-[#4f46e5] shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}
          >
            الدخول كمالك
          </button>
          <button
            onClick={() => switchMode('staff')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'staff' ? 'bg-white dark:bg-slate-800 text-[#4f46e5] shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}
          >
            الدخول كموظف
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4 text-red-600 dark:text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {mode === 'owner' ? (
          <>
            <p className="text-gray-500 dark:text-slate-400 text-center mb-6 text-sm">تسجيل الدخول لإدارة الطلبات</p>
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
                onKeyDown={e => e.key === 'Enter' && signInOwner()}
                placeholder="••••••••"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <button
              onClick={signInOwner}
              disabled={loading}
              className="w-full bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95"
            >
              {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-500 dark:text-slate-400 text-center mb-6 text-sm">أدخل الكود وكلمة المرور اللي أعطاكهم صاحب المطعم</p>
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-slate-300 font-semibold mb-2 text-sm">الكود</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="482913"
                dir="ltr"
                inputMode="numeric"
                maxLength={6}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-center text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#4f46e5] font-mono text-lg tracking-widest"
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 dark:text-slate-300 font-semibold mb-2 text-sm">كلمة المرور</label>
              <input
                type="password"
                value={staffPassword}
                onChange={e => setStaffPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && signInStaff()}
                placeholder="••••••••"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <button
              onClick={signInStaff}
              disabled={loading}
              className="w-full bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95"
            >
              {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
