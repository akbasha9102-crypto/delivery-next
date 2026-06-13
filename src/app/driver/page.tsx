'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, LogIn } from 'lucide-react';

export default function DriverLoginPage() {
  const router = useRouter();
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('driver_session')) {
      router.replace('/driver/dashboard');
    }
  }, [router]);

  const login = async () => {
    setError('');
    if (!phone.trim() || !password.trim()) { setError('أدخل رقم الهاتف وكلمة المرور'); return; }
    setLoading(true);
    const { data } = await supabase
      .from('drivers')
      .select('id, name, phone')
      .eq('phone', phone.trim())
      .eq('password', password.trim())
      .single();
    setLoading(false);
    if (!data) { setError('رقم الهاتف أو كلمة المرور غير صحيحة'); return; }
    localStorage.setItem('driver_session', JSON.stringify({ id: data.id, name: data.name, phone: data.phone }));
    router.replace('/driver/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <p className="text-5xl mb-3">🏍️</p>
          <h1 className="text-2xl font-black text-white">بوابة السائق</h1>
          <p className="text-slate-400 text-sm mt-1">سجّل دخولك لتستلم طلباتك</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-5 space-y-3 border border-slate-700">
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="رقم الهاتف"
            dir="ltr"
            type="tel"
            inputMode="tel"
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg"
          />
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            type="password"
            onKeyDown={e => e.key === 'Enter' && login()}
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            onClick={login}
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
            دخول
          </button>
        </div>
      </div>
    </div>
  );
}
