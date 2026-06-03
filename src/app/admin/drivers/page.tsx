'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminBottomNav } from '@/components/BottomNav';
import { AdminGuard } from '@/components/AdminGuard';
import { Plus, Trash2, CheckCircle, Circle } from 'lucide-react';

type Driver = { id: string; name: string; phone: string; is_available: boolean };

function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchDrivers = useCallback(async () => {
    const { data } = await supabase.from('drivers').select('*').order('created_at', { ascending: false });
    setDrivers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const addDriver = async () => {
    if (!name.trim() || !phone.trim()) return;
    setAdding(true);
    await supabase.from('drivers').insert({ name: name.trim(), phone: phone.trim() });
    setName(''); setPhone('');
    setAdding(false);
    fetchDrivers();
  };

  const toggleAvailable = async (d: Driver) => {
    await supabase.from('drivers').update({ is_available: !d.is_available }).eq('id', d.id);
    setDrivers(prev => prev.map(x => x.id === d.id ? { ...x, is_available: !d.is_available } : x));
  };

  const deleteDriver = async (id: string) => {
    await supabase.from('drivers').delete().eq('id', id);
    setDrivers(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 pb-24">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 text-center">السواقون</h1>
      </header>

      <div className="px-4 pt-4">
        {/* Add form */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 mb-4">
          <p className="font-bold text-gray-800 dark:text-slate-200 text-right mb-3">إضافة سائق جديد</p>
          <div className="space-y-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم السائق" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563eb]" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="رقم الهاتف" dir="ltr"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563eb]" />
            <button onClick={addDriver} disabled={adding || !name.trim() || !phone.trim()}
              className="w-full py-3 bg-[#2563eb] text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
              <Plus size={18} /> إضافة سائق
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : drivers.length === 0 ? (
          <div className="text-center mt-16">
            <p className="text-4xl mb-3">🏍️</p>
            <p className="text-gray-400 dark:text-slate-500">لا يوجد سواقون بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {drivers.map(d => (
              <div key={d.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => deleteDriver(d.id)}
                    className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-400 active:scale-90 transition-all">
                    <Trash2 size={16} />
                  </button>
                  <button onClick={() => toggleAvailable(d)}
                    className={`p-2 rounded-xl active:scale-90 transition-all ${d.is_available ? 'bg-green-50 dark:bg-green-900/20 text-green-500' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                    {d.is_available ? <CheckCircle size={18} /> : <Circle size={18} />}
                  </button>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-slate-100">{d.name}</p>
                  <p className="text-sm text-gray-400 dark:text-slate-500 mt-0.5" dir="ltr">{d.phone}</p>
                  <span className={`text-xs font-bold mt-1 inline-block px-2 py-0.5 rounded-full ${d.is_available ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                    {d.is_available ? 'متاح' : 'غير متاح'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminBottomNav />
    </div>
  );
}

export default function DriversPageGuarded() {
  return <AdminGuard><DriversPage /></AdminGuard>;
}
