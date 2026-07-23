'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, KeyRound, Plus, ShieldCheck, ToggleLeft, ToggleRight, User, X, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/context/RestaurantContext';
import { useStaff } from '@/context/StaffContext';
import { OwnerOnly } from '@/components/guards/OwnerOnly';
import { createStaff, updateStaff, type StaffMember, type StaffRole } from '@/lib/api/staffApi';

async function getAccessToken(): Promise<string | undefined> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

// نفس /^[a-z0-9_-]{3,20}$/ الموجودة بـ src/lib/auth/staff-auth.ts (STAFF_USERNAME_REGEX)
// مكرَّرة هنا عمداً بدل الاستيراد — تلك الوحدة تستخدم supabaseAdmin (Service
// Role)/Node crypto، واستيرادها بمكوّن 'use client' يُدرجها بالكامل داخل
// حزمة المتصفح (نفس السبب الموثَّق بـ src/app/login/page.tsx).
const USERNAME_REGEX = /^[a-z0-9_-]{3,20}$/;

const ROLE_LABEL: Record<StaffRole, string> = { owner: 'مالك', manager: 'مدير', cashier: 'كاشير', driver: 'سائق' };

const emptyForm = { display_name: '', role: 'cashier' as StaffRole, username: '', password: '', max_discount_pct: '0', max_void_amount: '0' };

export default function StaffManagementPage() {
  const router = useRouter();
  const { restaurantId } = useRestaurant();
  const { staffList, staffListLoading, refreshStaffList } = useStaff();

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  // بعد إنشاء موظف جديد بنجاح نعرض له اسم المستخدم+كلمة المرور بشكل واضح (فرصة أخيرة
  // للمالك ينسخهم قبل إغلاق النافذة — الموظف يحتاجهم بالضبط ليدخل بـ/login).
  const [createdCreds, setCreatedCreds] = useState<{ name: string; code: string; password: string } | null>(null);
  const [copied, setCopied] = useState<'code' | 'password' | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { refreshStaffList(); }, [refreshStaffList]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  };
  const openEdit = (s: StaffMember) => {
    setEditTarget(s);
    setForm({ display_name: s.display_name, role: s.role, username: s.code ?? '', password: '', max_discount_pct: String(s.max_discount_pct), max_void_amount: String(s.max_void_amount) });
    setError(null);
    setShowForm(true);
  };

  const copy = async (value: string, which: 'code' | 'password') => {
    try { await navigator.clipboard.writeText(value); setCopied(which); setTimeout(() => setCopied(null), 1500); } catch { /* تجاهل */ }
  };

  const submit = async () => {
    if (!restaurantId || !form.display_name.trim()) return;

    const username = form.username.trim().toLowerCase();
    if (!USERNAME_REGEX.test(username)) {
      setError('اسم المستخدم يجب أن يكون 3-20 حرفاً/رقماً إنجليزياً صغيراً، أو - أو _');
      return;
    }

    setSaving(true);
    setError(null);

    const accessToken = await getAccessToken();

    if (editTarget) {
      const patch: Parameters<typeof updateStaff>[1] = {
        display_name: form.display_name.trim(),
        role: form.role,
        max_discount_pct: parseFloat(form.max_discount_pct) || 0,
        max_void_amount: parseFloat(form.max_void_amount) || 0,
      };
      if (username !== (editTarget.code ?? '').toLowerCase()) {
        patch.code = username;
      }
      const res = await updateStaff(editTarget.id, patch, accessToken);
      setSaving(false);
      if (!res.ok) { setError('error' in res ? res.error : 'تعذّر الحفظ'); return; }
      showToast('✓ تم التحديث');
      setShowForm(false);
      refreshStaffList();
      return;
    }

    if (form.password.trim().length < 4) { setError('كلمة المرور يجب أن تكون 4 أحرف/أرقام على الأقل'); setSaving(false); return; }
    const res = await createStaff({
      restaurant_id: restaurantId,
      display_name: form.display_name.trim(),
      role: form.role,
      password: form.password.trim(),
      code: username,
      max_discount_pct: parseFloat(form.max_discount_pct) || 0,
      max_void_amount: parseFloat(form.max_void_amount) || 0,
    }, accessToken);
    setSaving(false);
    if (!res.ok) { setError('error' in res ? res.error : 'تعذّر الإضافة'); return; }
    const finalCode = (res.data as StaffMember).code ?? username;
    setShowForm(false);
    setCreatedCreds({ name: form.display_name.trim(), code: finalCode, password: form.password.trim() });
    refreshStaffList();
  };

  const toggleActive = async (s: StaffMember) => {
    const res = await updateStaff(s.id, { is_active: !s.is_active }, await getAccessToken());
    if (!res.ok) { showToast('error' in res ? res.error : 'تعذّر التحديث', false); return; }
    showToast(s.is_active ? '✓ تم تعطيل الموظف' : '✓ تم تفعيل الموظف');
    refreshStaffList();
  };

  const submitResetPassword = async () => {
    if (!resetTarget || resetPassword.trim().length < 4) return;
    const res = await updateStaff(resetTarget.id, { password: resetPassword.trim() }, await getAccessToken());
    if (!res.ok) { showToast('error' in res ? res.error : 'تعذّر إعادة تعيين كلمة المرور', false); return; }
    showToast('✓ تم إعادة تعيين كلمة المرور');
    setResetTarget(null);
    setResetPassword('');
  };

  const input = 'w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#2563eb] mb-3';

  return (
    <OwnerOnly>
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-10" dir="rtl">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 flex items-center justify-between">
        <button onClick={openAdd} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 active:scale-90 transition-all"><Plus size={18} /></button>
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#2563eb]" />
          <p className="font-bold text-gray-900 dark:text-slate-100">إدارة الموظفين</p>
        </div>
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all"><ChevronRight size={18} /></button>
      </header>

      {toast && (
        <div className={`mx-4 mt-3 px-4 py-3 rounded-xl border text-center font-bold text-sm ${toast.ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      <div className="px-4 pt-4">
        {staffListLoading ? (
          <div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" /></div>
        ) : staffList.length === 0 ? (
          <div className="text-center mt-16">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm">لا يوجد موظفون بعد — اضغط + لإضافة كاشير</p>
          </div>
        ) : (
          <div className="space-y-2">
            {staffList.map(s => (
              <div key={s.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4">
                <div className="flex items-start justify-between mb-2">
                  <button onClick={() => toggleActive(s)} className="text-gray-400 active:scale-90 transition-all">
                    {s.is_active ? <ToggleRight size={26} className="text-green-500" /> : <ToggleLeft size={26} />}
                  </button>
                  <div className="text-right flex-1 px-3">
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{s.display_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ROLE_LABEL[s.role]}{s.code ? ` · اسم المستخدم: ${s.code}` : ''} · خصم حتى {s.max_discount_pct}% · إلغاء حتى {s.max_void_amount.toLocaleString()} د.ع
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0"><User size={16} className="text-blue-500" /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(s)} className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-bold text-xs active:scale-95 transition-all">تعديل الحدود</button>
                  <button onClick={() => { setResetTarget(s); setResetPassword(''); }} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-bold text-xs active:scale-95 transition-all">
                    <KeyRound size={12} /> إعادة تعيين كلمة المرور
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* موديل إضافة/تعديل موظف */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-700">
              <button onClick={submit} disabled={saving || !form.display_name.trim()} className="bg-[#2563eb] disabled:opacity-40 text-white font-bold px-4 py-2 rounded-xl active:scale-95 transition-all text-sm">
                {saving ? '...' : editTarget ? 'حفظ' : 'إضافة'}
              </button>
              <h3 className="font-bold text-gray-900 dark:text-slate-100">{editTarget ? 'تعديل موظف' : 'موظف جديد'}</h3>
              <button onClick={() => setShowForm(false)} className="bg-gray-100 dark:bg-slate-700 text-gray-500 px-3 py-2 rounded-xl text-sm font-bold active:scale-95">إلغاء</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">اسم الموظف *</p>
              <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} placeholder="مثال: أحمد" dir="rtl" className={input} />

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">الدور</p>
              <div className="flex gap-1.5 flex-wrap mb-3 justify-end">
                {(['cashier', 'manager'] as StaffRole[]).map(r => (
                  <button key={r} onClick={() => setForm(p => ({ ...p, role: r }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border active:scale-95 transition-all ${form.role === r ? 'bg-[#2563eb] border-[#2563eb] text-white' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'}`}>
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">اسم المستخدم (يدخل به الموظف من صفحة تسجيل الدخول)</p>
              <input
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) }))}
                placeholder="ahmad_cashier"
                dir="ltr"
                className={`${input} font-mono`}
              />
              {form.username.length > 0 && form.username.length < 3 && (
                <p className="text-red-500 text-xs -mt-2 mb-3 text-right">3 أحرف على الأقل</p>
              )}

              {!editTarget && (
                <>
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">كلمة المرور (تحددها أنت)</p>
                  <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="4 أحرف/أرقام على الأقل" dir="ltr" className={input} />
                </>
              )}

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">أقصى خصم بدون موافقة (%)</p>
                  <input type="number" value={form.max_discount_pct} onChange={e => setForm(p => ({ ...p, max_discount_pct: e.target.value }))} dir="rtl"
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563eb]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-1">أقصى إلغاء بدون موافقة (د.ع)</p>
                  <input type="number" value={form.max_void_amount} onChange={e => setForm(p => ({ ...p, max_void_amount: e.target.value }))} dir="rtl"
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563eb]" />
                </div>
              </div>

              {error && <p className="text-red-500 text-xs font-bold text-center mt-2">{error}</p>}
            </div>
          </div>
        </div>
      )}

      {/* موديل عرض بيانات الدخول بعد إنشاء موظف بنجاح */}
      {createdCreds && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setCreatedCreds(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-5" onClick={e => e.stopPropagation()} dir="rtl">
            <p className="text-center text-4xl mb-2">✅</p>
            <p className="font-bold text-gray-900 dark:text-slate-100 text-center mb-1">تمت إضافة {createdCreds.name}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center mb-4">أعطِ الموظف اسم المستخدم وكلمة المرور ليدخل من صفحة تسجيل الدخول</p>

            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 mb-2">
              <button onClick={() => copy(createdCreds.code, 'code')} className="text-gray-400 active:scale-90 transition-all">
                {copied === 'code' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
              <p className="font-mono font-bold text-gray-900 dark:text-slate-100 text-lg tracking-widest" dir="ltr">{createdCreds.code}</p>
              <p className="text-[10px] text-gray-400">اسم المستخدم</p>
            </div>

            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 mb-4">
              <button onClick={() => copy(createdCreds.password, 'password')} className="text-gray-400 active:scale-90 transition-all">
                {copied === 'password' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
              <p className="font-mono font-bold text-gray-900 dark:text-slate-100 text-lg" dir="ltr">{createdCreds.password}</p>
              <p className="text-[10px] text-gray-400">كلمة المرور</p>
            </div>

            <button onClick={() => setCreatedCreds(null)} className="w-full bg-[#2563eb] text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all">
              تم، حفظتهم
            </button>
          </div>
        </div>
      )}

      {/* موديل إعادة تعيين كلمة المرور */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setResetTarget(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setResetTarget(null)} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500"><X size={16} /></button>
              <p className="font-bold text-gray-900 dark:text-slate-100">إعادة تعيين كلمة المرور — {resetTarget.display_name}</p>
              <div className="w-9" />
            </div>
            <input value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="كلمة مرور جديدة (4 أحرف/أرقام على الأقل)" dir="ltr" className={input} />
            <button onClick={submitResetPassword} disabled={resetPassword.trim().length < 4} className="w-full bg-[#2563eb] disabled:opacity-40 text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all">
              تأكيد
            </button>
          </div>
        </div>
      )}
    </div>
    </OwnerOnly>
  );
}
