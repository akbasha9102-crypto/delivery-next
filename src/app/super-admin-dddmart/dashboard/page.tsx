'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// لوحة سوبر أدمن مصغّرة مخصصة لمتاجر dddmart فقط — منفصلة كلياً عن لوحة
// المطاعم (src/app/super-admin/dashboard). تنفّذ ثلاثة أشياء فقط بحسب
// التصميم المُقرّ: قائمة متاجر، إنشاء متجر (+ أول حساب دخول له)، تبديل
// حالة الاشتراك تفعيل/تعليق. عمداً بلا تعديل/حذف/باقات/انتحال هوية.

type Store = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function ToggleSwitch({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className="relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none disabled:opacity-50 flex-shrink-0"
      style={{ backgroundColor: on ? '#22c55e' : '#374151' }}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export default function SuperAdminDddmartDashboard() {
  const router = useRouter();
  const [stores,  setStores]  = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // نموذج إنشاء متجر جديد
  const [storeName,     setStoreName]     = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail,    setAdminEmail]    = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [creating,   setCreating]   = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdInfo, setCreatedInfo] = useState('');

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/super-admin-dddmart/stores');
    if (res.status === 401) {
      router.replace('/super-admin-dddmart/login');
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'فشل تحميل المتاجر');
    } else {
      setStores(json.stores ?? []);
    }
    setLoading(false);
  }, [router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- تحميل أولي لمرة واحدة عند فتح لوحة سوبر أدمن dddmart، لا نظام خارجي لتأجيله له
  useEffect(() => { loadStores(); }, [loadStores]);

  const handleCreate = async () => {
    if (!storeName.trim() || !adminFullName.trim() || !adminEmail.trim() || !adminPassword.trim()) return;
    setCreating(true);
    setCreateError('');
    setCreatedInfo('');
    const res = await fetch('/api/super-admin-dddmart/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeName, adminFullName, adminEmail, adminPassword }),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) {
      setCreateError(json.error ?? 'فشل إنشاء المتجر');
      return;
    }
    setCreatedInfo(`تم إنشاء المتجر "${json.store.name}" — سلّم بيانات الدخول (${adminEmail}) لصاحب المتجر مباشرة`);
    setStoreName(''); setAdminFullName(''); setAdminEmail(''); setAdminPassword('');
    loadStores();
  };

  const handleToggle = async (store: Store) => {
    setTogglingId(store.id);
    const res = await fetch(`/api/super-admin-dddmart/stores/${store.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !store.is_active }),
    });
    if (res.ok) {
      setStores(prev => prev.map(s => s.id === store.id ? { ...s, is_active: !s.is_active } : s));
    }
    setTogglingId(null);
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">متاجر dddmart</h1>
          <p className="text-slate-400 text-sm mt-1">إنشاء المتاجر وتفعيل/تعليق الاشتراك</p>
        </div>

        {/* نموذج إنشاء متجر */}
        <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-slate-700/50 shadow-xl mb-8">
          <h2 className="text-white font-bold mb-4">متجر جديد</h2>
          {createError && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm text-center">
              {createError}
            </div>
          )}
          {createdInfo && (
            <div className="bg-green-900/30 border border-green-700/50 rounded-xl px-4 py-3 mb-4 text-green-400 text-sm text-center">
              {createdInfo}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">اسم المتجر</label>
              <input
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                className="w-full bg-[#0f0f1a] border border-slate-600 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-600"
                placeholder="سوبر ماركت الأمل"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">اسم الأدمن الكامل</label>
              <input
                type="text"
                value={adminFullName}
                onChange={e => setAdminFullName(e.target.value)}
                className="w-full bg-[#0f0f1a] border border-slate-600 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-600"
                placeholder="محمد أحمد"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">إيميل الأدمن</label>
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                dir="ltr"
                className="w-full bg-[#0f0f1a] border border-slate-600 rounded-xl px-4 py-3 text-left text-white outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-600"
                placeholder="owner@example.com"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">كلمة مرور الأدمن</label>
              <input
                type="text"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                dir="ltr"
                className="w-full bg-[#0f0f1a] border border-slate-600 rounded-xl px-4 py-3 text-left text-white outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-600"
                placeholder="تُسلَّم للمالك يدوياً"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="mt-4 w-full md:w-auto bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-violet-900/30"
          >
            {creating ? 'جاري الإنشاء...' : 'إنشاء متجر'}
          </button>
        </div>

        {/* جدول المتاجر */}
        <div className="bg-[#1a1a2e] rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/50">
            <h2 className="text-white font-bold">المتاجر ({stores.length})</h2>
          </div>

          {loading ? (
            <p className="text-slate-400 text-sm text-center py-8">جاري التحميل...</p>
          ) : error ? (
            <p className="text-red-400 text-sm text-center py-8">{error}</p>
          ) : stores.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">لا توجد متاجر بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400 text-xs">
                    <th className="text-right px-6 py-3 font-semibold">الاسم</th>
                    <th className="text-right px-6 py-3 font-semibold">المعرّف</th>
                    <th className="text-right px-6 py-3 font-semibold">الحالة</th>
                    <th className="text-right px-6 py-3 font-semibold">تاريخ الإنشاء</th>
                    <th className="text-right px-6 py-3 font-semibold">تبديل</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map(store => (
                    <tr key={store.id} className="border-b border-slate-800/60 last:border-0">
                      <td className="px-6 py-4 text-white font-medium">{store.name}</td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs" dir="ltr">{store.slug}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          store.is_active
                            ? 'bg-green-900/30 text-green-400 border border-green-700/40'
                            : 'bg-red-900/30 text-red-400 border border-red-700/40'
                        }`}>
                          {store.is_active ? 'مفعّل' : 'معلّق'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{fmtDate(store.created_at)}</td>
                      <td className="px-6 py-4">
                        <ToggleSwitch
                          on={store.is_active}
                          disabled={togglingId === store.id}
                          onChange={() => handleToggle(store)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
