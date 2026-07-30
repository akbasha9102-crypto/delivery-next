'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { Loader2, LogIn, Bike } from 'lucide-react';

export default function DriverLoginPage() {
  const router = useRouter();
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [shaking,  setShaking]  = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/drivers/dashboard');
    });
  }, [router]);

  useEffect(() => { if (error) setShaking(true); }, [error]);

  const login = async () => {
    setError('');
    if (!phone.trim() || !password.trim()) { setError('أدخل رقم الهاتف وكلمة المرور'); return; }
    setLoading(true);

    const fullPhone = `+964${phone.trim().replace(/^0/, '')}`;
    const res = await fetch('/api/driver/resolve-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: fullPhone }),
    });
    const resolved = await res.json().catch(() => ({}));

    if (!res.ok || !resolved.email) {
      setLoading(false);
      setError('رقم الهاتف أو كلمة المرور غير صحيحة');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: resolved.email,
      password: password.trim(),
    });
    setLoading(false);
    if (signInError) { setError('رقم الهاتف أو كلمة المرور غير صحيحة'); return; }
    router.replace('/drivers/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="w-full max-w-sm space-y-5"
      >
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-900/50">
            <Bike size={38} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">بوابة السائق</h1>
            <p className="text-slate-400 text-sm mt-1">سجّل دخولك لتستلم طلباتك</p>
          </div>
        </div>

        <div
          className={shaking ? 'shake' : ''}
          onAnimationEnd={() => setShaking(false)}
        >
          <div className="bg-slate-900 rounded-3xl p-5 space-y-3 border border-slate-800">
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <span className="px-3 text-slate-400 font-medium text-sm border-r border-slate-700 h-full flex items-center py-3 select-none">
                +964
              </span>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && passwordRef.current?.focus()}
                placeholder="07XXXXXXXX"
                dir="ltr"
                type="tel"
                inputMode="tel"
                className="flex-1 bg-transparent px-3 py-3 text-white placeholder-slate-400 outline-none text-center text-lg"
              />
            </div>
            <input
              ref={passwordRef}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="كلمة المرور"
              type="password"
              onKeyDown={e => e.key === 'Enter' && login()}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={login}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-black text-lg rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-lg shadow-blue-900/40"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
              دخول
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
