'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const signIn = async () => {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/super-admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    if (res.ok) {
      router.replace('/super-admin/dashboard');
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-900/40">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white">Super Admin</h1>
          <p className="text-slate-400 text-sm mt-1">لوحة التحكم العليا</p>
        </div>

        <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-slate-700/50 shadow-xl">
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm text-center">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label className="block text-slate-300 text-sm font-semibold mb-2">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              dir="ltr"
              autoComplete="username"
              className="w-full bg-[#0f0f1a] border border-slate-600 rounded-xl px-4 py-3 text-left text-white outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-600"
            />
          </div>
          <div className="mb-6">
            <label className="block text-slate-300 text-sm font-semibold mb-2">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && signIn()}
              placeholder="••••••••"
              dir="ltr"
              autoComplete="current-password"
              className="w-full bg-[#0f0f1a] border border-slate-600 rounded-xl px-4 py-3 text-left text-white outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={signIn}
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-violet-900/30"
          >
            {loading ? 'جاري التحقق...' : 'دخول'}
          </button>
        </div>
      </div>
    </div>
  );
}
