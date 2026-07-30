'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { AdminBottomNav } from '@/components/layout/BottomNav';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { Plus, Trash2, CheckCircle, Circle, Copy, Check, KeyRound, X, RefreshCw, Loader2 } from 'lucide-react';
import { useRestaurant } from '@/context/RestaurantContext';

type Driver = { id: string; name: string; phone: string; status: string };

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function DriversPage() {
  const { restaurantId } = useRestaurant();
  const [drivers,     setDrivers]     = useState<Driver[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showAdd,     setShowAdd]     = useState(false);
  const [animateIn,   setAnimateIn]   = useState(false);
  const [name,        setName]        = useState('');
  const [phone,       setPhone]       = useState('');
  const [password,    setPassword]    = useState('');
  const [adding,      setAdding]      = useState(false);
  const [copied,      setCopied]      = useState<string | null>(null);
  const [editPw,      setEditPw]      = useState<string | null>(null);
  const [newPw,       setNewPw]       = useState('');
  const [savingPw,    setSavingPw]    = useState(false);
  // كلمة المرور تُعرَض فقط لحظة إنشاء/إعادة تعيينها (لا تُخزَّن نصاً صريحاً
  // بعد الآن — حساب Supabase Auth حقيقي، لا عمود password على drivers).
  const [knownPasswords, setKnownPasswords] = useState<Record<string, string>>({});

  const fetchDrivers = useCallback(async () => {
    if (!restaurantId) { setDrivers([]); setLoading(false); return; }
    const { data } = await supabase.from('drivers').select('id, name, phone, status')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    setDrivers(data || []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    fetchDrivers();
    // فلترة بمعرّف المطعم إلزامية — بدونها يُعاد جلب/رسم هذه الشاشة عند أي تحديث
    // على سائق بأي مطعم آخر بالمنصة بأكملها (خطأ #25 بتقرير الفحص)
    const ch = supabase.channel('admin-drivers-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `restaurant_id=eq.${restaurantId}` }, ({ new: row }: any) => {
        setDrivers(prev => prev.map(d => d.id === row.id ? { ...d, status: row.status } : d));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchDrivers, restaurantId]);

  const openAdd = () => {
    setShowAdd(true);
    requestAnimationFrame(() => setAnimateIn(true));
  };

  const closeAdd = () => {
    setAnimateIn(false);
    setTimeout(() => {
      setShowAdd(false);
      setName(''); setPhone(''); setPassword('');
    }, 300);
  };

  const addDriver = async () => {
    if (!restaurantId) return;
    if (!name.trim() || !phone.trim() || !password.trim()) return;
    setAdding(true);
    const localNumber = phone.trim().replace(/^0/, '');
    const fullPhone = `+964${localNumber}`;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ restaurant_id: restaurantId, name: name.trim(), phone: fullPhone, password: password.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    setAdding(false);
    if (!res.ok) { alert(body.error || 'تعذّر إضافة السائق'); return; }
    setKnownPasswords(prev => ({ ...prev, [body.driver.id]: password.trim() }));
    closeAdd();
    fetchDrivers();
  };

  const toggleAvailable = async (d: Driver) => {
    const newStatus = d.status === 'available' ? 'unavailable' : 'available';
    const { error } = await supabase.from('drivers').update({ status: newStatus }).eq('id', d.id);
    if (!error) setDrivers(prev => prev.map(x => x.id === d.id ? { ...x, status: newStatus } : x));
    else fetchDrivers();
  };

  const deleteDriver = async (driver: Driver) => {
    if (!confirm(`هل أنت متأكد من حذف السائق "${driver.name}"؟`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/driver/${driver.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    });
    if (!res.ok) { alert('تعذّر حذف السائق'); return; }
    setDrivers(prev => prev.filter(x => x.id !== driver.id));
  };

  const copyLink = (d: Driver) => {
    const link = `${window.location.origin}/drivers`;
    const pw = knownPasswords[d.id];
    const text = pw
      ? `🏍️ بوابة السائق\n${link}\n\nرقم الهاتف: ${d.phone}\nكلمة المرور: ${pw}`
      : `🏍️ بوابة السائق\n${link}\n\nرقم الهاتف: ${d.phone}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(d.id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const savePassword = async (driverId: string) => {
    if (!newPw.trim()) return;
    setSavingPw(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/driver/${driverId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ password: newPw.trim() }),
    });
    setSavingPw(false);
    if (!res.ok) { alert('تعذّر تحديث كلمة المرور'); return; }
    setKnownPasswords(prev => ({ ...prev, [driverId]: newPw.trim() }));
    setEditPw(null);
    setNewPw('');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#212121] pb-24 md:pb-0 md:mr-[70px]">

      {/* هيدر */}
      <AdminHeader
        title="السائقين"
        right={
          <button
            onClick={openAdd}
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 flex items-center justify-center active:scale-90 transition-all shadow-sm"
          >
            <Plus size={20} />
          </button>
        }
      />

      {/* قائمة السائقين */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : drivers.length === 0 ? (
          <div className="text-center mt-24">
            <p className="text-5xl mb-3">🏍️</p>
            <p className="text-gray-400 dark:text-slate-500 font-medium">لا يوجد سائقين بعد</p>
            <p className="text-gray-300 dark:text-slate-600 text-sm mt-1">اضغط + لإضافة سائق</p>
          </div>
        ) : (
          <div className="space-y-3">
            {drivers.map(d => {
              const available = d.status === 'available';
              return (
                <div key={d.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => deleteDriver(d)}
                        className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-400 active:scale-90 transition-all">
                        <Trash2 size={16} />
                      </button>
                      <button onClick={() => toggleAvailable(d)}
                        className={`p-2 rounded-xl active:scale-90 transition-all ${available ? 'bg-green-50 dark:bg-green-900/20 text-green-500' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                        {available ? <CheckCircle size={18} /> : <Circle size={18} />}
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!available && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
                        <p className="font-bold text-gray-900 dark:text-slate-100">{d.name}</p>
                      </div>
                      <p className="text-sm text-gray-400 dark:text-slate-500 mt-0.5" dir="ltr">{d.phone}</p>
                      <span className={`text-xs font-bold mt-1 inline-block px-2 py-0.5 rounded-full ${available ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 dark:bg-red-900/30 text-red-500'}`}>
                        {available ? '● متاح' : '● غير متاح'}
                      </span>
                    </div>
                  </div>

                  {/* كلمة المرور + نسخ الرابط */}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-slate-700">
                    {editPw === d.id ? (
                      <div className="flex gap-2 flex-1">
                        <button onClick={() => savePassword(d.id)} disabled={savingPw}
                          className="px-3 py-1.5 bg-gradient-to-b from-[#22A066] to-[#186341] dark:bg-none dark:bg-[#10B981] text-white text-sm font-bold rounded-lg active:scale-95 transition-all disabled:opacity-50">
                          {savingPw ? '...' : 'حفظ'}
                        </button>
                        <input value={newPw} onChange={e => setNewPw(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && savePassword(d.id)}
                          placeholder="كلمة مرور جديدة" autoFocus dir="ltr"
                          className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-slate-100 outline-none" />
                      </div>
                    ) : (
                      <>
                        <button onClick={() => copyLink(d)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold active:scale-95 transition-all">
                          {copied === d.id ? <Check size={13} /> : <Copy size={13} />}
                          {copied === d.id ? 'تم النسخ' : 'نسخ بيانات الدخول'}
                        </button>
                        <button onClick={() => { setEditPw(d.id); setNewPw(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-lg text-xs font-bold active:scale-95 transition-all mr-auto">
                          <KeyRound size={13} />
                          {knownPasswords[d.id] ? '••••' : 'إعادة تعيين كلمة مرور'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AdminBottomNav />

      {/* Bottom sheet — إضافة سائق */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={closeAdd}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`} />
          <div
            className={`relative w-full bg-white dark:bg-slate-800 rounded-t-3xl px-5 pt-5 pb-10 space-y-3 transition-transform duration-300 ease-out ${animateIn ? 'translate-y-0' : 'translate-y-full'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* مقبض + عنوان */}
            <div className="w-10 h-1 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-1">
              <button onClick={closeAdd} className="p-1.5 rounded-xl text-gray-400 active:scale-90 transition-all">
                <X size={20} />
              </button>
              <p className="font-bold text-gray-900 dark:text-slate-100 text-base">إضافة سائق جديد</p>
              <div className="w-8" />
            </div>

            {/* الخانات */}
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="اسم السائق" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563eb]"
            />
            <div className="flex items-center bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#2563eb]">
              <span className="px-3 text-gray-500 dark:text-slate-400 font-bold text-sm border-r border-gray-200 dark:border-slate-600 h-full flex items-center py-3 select-none">
                +964
              </span>
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="07XXXXXXXX" dir="ltr" type="tel"
                className="flex-1 bg-transparent px-3 py-3 text-gray-900 dark:text-slate-100 outline-none"
              />
            </div>

            {/* باسوورد + زر توليد */}
            <div className="flex gap-2">
              <button
                onClick={() => setPassword(generatePassword())}
                className="flex items-center gap-1.5 px-3 py-3 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-xl text-sm font-bold active:scale-90 transition-all flex-shrink-0"
                title="توليد تلقائي"
              >
                <RefreshCw size={15} />
              </button>
              <input
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="كلمة المرور" dir="ltr"
                className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>

            <button
              onClick={addDriver}
              disabled={adding || !name.trim() || !phone.trim() || !password.trim()}
              className="w-full py-3.5 bg-[var(--admin-accent-light-bg)] dark:bg-[var(--admin-accent-dark)] text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 mt-1"
            >
              {adding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              إضافة سائق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

