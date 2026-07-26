'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useSettings, type DaySchedule, type WeekSchedule } from '@/context/SettingsContext';
import { Save, Type, Loader2, Moon, Sun, ShoppingBag, MapPin, MessageCircle, X, LogOut, Clock, Calendar, BarChart2, Archive, ChevronLeft, ChevronDown, PenLine, KeyRound, Eye, EyeOff, User, Lock, Truck, Wallet, Ticket, Flame, Percent, Search, Check, Bell, Power } from 'lucide-react';
import { AdminBottomNav } from '@/components/layout/BottomNav';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { useRestaurant } from '@/context/RestaurantContext';
import { useDarkMode } from '@/context/ThemeContext';
import { useStaff } from '@/context/StaffContext';
import { useSuperAdminNotifications } from '@/context/SuperAdminNotificationsContext';
import { applyDiscountPct } from '@/lib/utils/pricing';
import { isRestaurantOpenNow, getNextOpenTime } from '@/lib/utils/schedule';

/** ينسّق تاريخاً لصيغة "HH:mm" المطلوبة كقيمة لعنصر input[type=time] */
const formatHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/* ─── جدولة الدوام ─── */
const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DEFAULT_WEEK: WeekSchedule = {
  auto: false,
  days: Object.fromEntries([0,1,2,3,4,5,6].map(d => [String(d), { enabled: d < 5, open: '10:00', close: '23:00' } as DaySchedule])),
};

function ScheduleModal({ schedule: initSchedule, settingsId, onSaved, onClose, refreshSettings }: {
  schedule: WeekSchedule | null;
  settingsId: string;
  onSaved: (s: WeekSchedule) => void;
  onClose: () => void;
  refreshSettings: () => Promise<void>;
}) {
  const [sched,  setSched]  = useState<WeekSchedule>(initSchedule ?? DEFAULT_WEEK);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const firstEnabledDay = Object.values(initSchedule?.days ?? {}).find(d => d.enabled);
  const [globalOpen,  setGlobalOpen]  = useState(firstEnabledDay?.open  ?? '10:00');
  const [globalClose, setGlobalClose] = useState(firstEnabledDay?.close ?? '23:00');

  useEffect(() => { setSched(initSchedule ?? DEFAULT_WEEK); }, [initSchedule]);

  const updateDay = (key: string, field: keyof DaySchedule, val: boolean | string) =>
    setSched(prev => ({ ...prev, days: { ...prev.days, [key]: { ...prev.days[key], [field]: val } } }));

  const applyToAllDays = () =>
    setSched(prev => ({
      ...prev,
      days: Object.fromEntries(
        [0,1,2,3,4,5,6].map(d => [String(d), { enabled: true, open: globalOpen, close: globalClose }])
      ),
    }));

  const handleSave = async () => {
    if (!settingsId) { setSaveError('لم يتم تحميل إعدادات المطعم بعد'); return; }
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from('restaurant_settings').update({ schedule: sched }).eq('id', settingsId);
    if (error) {
      setSaveError('فشل الحفظ: ' + error.message);
      setSaving(false);
      return;
    }
    onSaved(sched);
    await refreshSettings();
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg pb-6 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div className="w-9" />
          <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">جدولة الدوام</p>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 pt-4">
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-2xl px-4 py-3 mb-5">
            <button onClick={() => setSched(prev => ({ ...prev, auto: !prev.auto }))} dir="ltr"
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${sched.auto ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${sched.auto ? 'translate-x-6' : ''}`} />
            </button>
            <div className="text-right">
              <p className="font-bold text-sm text-gray-800 dark:text-slate-200">تطبيق تلقائي</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">يفتح ويغلق المطعم حسب الجدول</p>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-2xl px-4 py-3 mb-5">
            <p className="font-bold text-sm text-gray-800 dark:text-slate-200 mb-2">تطبيق على كل الأيام</p>
            <div className="flex items-start gap-2 mb-3">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 mb-1 text-center">يغلق</p>
                <input type="time" value={globalClose} onChange={e => setGlobalClose(e.target.value)}
                  className="w-full text-sm text-center bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-xl py-2 outline-none text-gray-700 dark:text-slate-200" />
              </div>
              <span className="text-gray-300 dark:text-slate-500 text-sm font-bold mt-5">—</span>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 mb-1 text-center">يفتح</p>
                <input type="time" value={globalOpen} onChange={e => setGlobalOpen(e.target.value)}
                  className="w-full text-sm text-center bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-xl py-2 outline-none text-gray-700 dark:text-slate-200" />
              </div>
            </div>
            <button onClick={applyToAllDays}
              className="w-full py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm active:scale-95 transition-all">
              تطبيق على الكل
            </button>
          </div>
          <div className="space-y-3 pb-4">
            {[0,1,2,3,4,5,6].map(d => {
              const key = String(d);
              const day: DaySchedule = sched.days[key] ?? { enabled: false, open: '10:00', close: '23:00' };
              return (
                <div key={d} className={`bg-gray-50 dark:bg-slate-700/50 rounded-2xl px-4 py-3 transition-opacity ${!day.enabled ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => updateDay(key, 'enabled', !day.enabled)} dir="ltr"
                      className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${day.enabled ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${day.enabled ? 'translate-x-5' : ''}`} />
                    </button>
                    <p className="font-bold text-sm text-gray-800 dark:text-slate-200">{DAY_NAMES[d]}</p>
                  </div>
                  {day.enabled && (
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 mb-1 text-center">يغلق</p>
                        <input type="time" value={day.close} onChange={e => updateDay(key, 'close', e.target.value)}
                          className="w-full text-sm text-center bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-xl py-2 outline-none text-gray-700 dark:text-slate-200" />
                      </div>
                      <span className="text-gray-300 dark:text-slate-500 text-sm font-bold mt-5">—</span>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 mb-1 text-center">يفتح</p>
                        <input type="time" value={day.open} onChange={e => updateDay(key, 'open', e.target.value)}
                          className="w-full text-sm text-center bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-xl py-2 outline-none text-gray-700 dark:text-slate-200" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="px-5 pt-3 flex-shrink-0">
          {saveError && (
            <p className="text-red-500 text-xs text-center mb-2 font-bold">{saveError}</p>
          )}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-4 rounded-2xl bg-gradient-to-b from-[#22A066] to-[#186341] dark:bg-none dark:bg-[#10B981] text-white font-bold text-base active:scale-95 transition-all disabled:opacity-60">
            {saving ? 'جاري الحفظ...' : 'حفظ الجدولة'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── نافذة عامة متمركزة بمنتصف الشاشة (تُستخدم لرسوم التوصيل / الحد الأدنى / الكوبون / خصومات الأقسام والوجبات) ─── */
function BottomSheet({ title, onClose, children, maxHeight = '65vh', headerAction }: { title: string; onClose: () => void; children: React.ReactNode; maxHeight?: string; headerAction?: React.ReactNode }) {
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const close = () => { setAnimateIn(false); setTimeout(onClose, 300); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={close}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`relative w-full max-w-lg bg-white dark:bg-[#212121] rounded-3xl transition-all duration-300 ease-out flex flex-col ${animateIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        style={{ maxHeight }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            {headerAction ?? <div className="w-9" />}
            <p className="font-bold text-gray-900 dark:text-slate-100">{title}</p>
            <button onClick={close} className="p-1.5 rounded-xl text-gray-400 active:scale-90 transition-all">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-3" dir="rtl">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── نافذة معلومات المطعم ─── */
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div dir="rtl">
    <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-1.5 px-1">{label}</p>
    {children}
  </div>
);

function RestaurantInfoSheet({ onClose, settingsId, refreshSettings }: {
  onClose: () => void;
  settingsId: string;
  refreshSettings: () => Promise<void>;
}) {
  const { restaurant_name, primary_color, logo_url, whatsapp_number, location_url } = useSettings();
  void primary_color;
  const [animateIn, setAnimateIn] = useState(false);
  const [form, setForm] = useState({
    name:     restaurant_name || '',
    logo:     logo_url        || '',
    whatsapp: whatsapp_number || '',
    location: location_url    || '',
  });
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const close = () => { setAnimateIn(false); setTimeout(onClose, 300); };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('restaurant_settings').update({
      restaurant_name: form.name,
      logo_url:        form.logo,
      whatsapp_number: form.whatsapp || null,
      location_url:    form.location || null,
      updated_at:      new Date().toISOString(),
    }).eq('id', settingsId);
    await refreshSettings();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputCls = "w-full px-4 py-3.5 bg-gray-50 dark:bg-slate-800 rounded-2xl text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={close}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`relative w-full bg-white dark:bg-[#212121] rounded-t-3xl transition-transform duration-300 ease-out flex flex-col max-h-[92vh] ${animateIn ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* هيدر */}
        <div className="flex-shrink-0 px-5 pt-4 pb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="w-10 h-1 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-[#22A066] to-[#186341] dark:bg-none dark:bg-[#10B981] text-white font-bold text-sm rounded-xl active:scale-95 transition-all disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saved ? '✓ تم' : 'حفظ'}
            </button>
            <p className="font-bold text-gray-900 dark:text-slate-100">تعديل معلومات المطعم</p>
            <button onClick={close} className="p-1.5 rounded-xl text-gray-400 active:scale-90 transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* الحقول */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

          <Field label="اسم المطعم">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: مطعم الأصيل" dir="rtl"
              className={inputCls + " text-right font-bold"} />
          </Field>

          <Field label="رابط الشعار">
            <input value={form.logo} onChange={e => setForm({ ...form, logo: e.target.value })}
              placeholder="https://..." dir="ltr"
              className={inputCls} />
          </Field>

<Field label="رقم الواتساب">
            <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="9647801234567" dir="ltr"
              className={inputCls} />
            <p className="text-xs text-gray-400 mt-1.5 px-1">بدون علامة + — مثال: 9647801234567</p>
          </Field>

          <Field label="رابط الموقع على الخريطة">
            <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="https://maps.google.com/..." dir="ltr"
              className={inputCls} />
          </Field>

          <div className="pb-2" />
        </div>
      </div>
    </div>
  );
}

/* ─── نافذة تغيير كلمة المرور ─── */
function ChangePasswordSheet({ onClose, username }: { onClose: () => void; username: string }) {
  const [animateIn, setAnimateIn] = useState(false);
  const [newPass,   setNewPass]   = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [result,    setResult]    = useState<'idle'|'ok'|'err'|'mismatch'>('idle');

  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const close = () => { setAnimateIn(false); setTimeout(onClose, 300); };

  const handleSave = async () => {
    if (newPass.length < 6) { setResult('err'); return; }
    if (newPass !== confirm) { setResult('mismatch'); return; }
    setSaving(true); setResult('idle');
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setSaving(false);
    if (error) { setResult('err'); return; }
    setResult('ok');
    setTimeout(close, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={close}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`relative w-full bg-white dark:bg-[#212121] rounded-t-3xl transition-transform duration-300 ease-out max-h-[85vh] flex flex-col ${animateIn ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-5 pt-4 pb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="w-10 h-1 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <div className="w-9" />
            <p className="font-bold text-gray-900 dark:text-slate-100">تغيير كلمة المرور</p>
            <button onClick={close} className="p-1.5 rounded-xl text-gray-400 active:scale-90 transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4" dir="rtl">
          {/* اسم المستخدم */}
          <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3">
            <User size={16} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">اسم المستخدم</p>
              <p className="font-mono font-bold text-gray-800 dark:text-slate-200" dir="ltr">{username}</p>
            </div>
          </div>

          {/* كلمة المرور الجديدة */}
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-1.5 px-1">كلمة المرور الجديدة</p>
            <div className="flex gap-2">
              <button onClick={() => setShowPass(v => !v)}
                className="w-11 h-12 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 flex-shrink-0">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <input
                type={showPass ? 'text' : 'password'}
                value={newPass}
                onChange={e => { setNewPass(e.target.value); setResult('idle'); }}
                placeholder="6 أحرف على الأقل"
                dir="ltr"
                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-2xl text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 text-sm"
              />
            </div>
          </div>

          {/* تأكيد كلمة المرور */}
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-1.5 px-1">تأكيد كلمة المرور</p>
            <input
              type={showPass ? 'text' : 'password'}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setResult('idle'); }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="أعد كتابة كلمة المرور"
              dir="ltr"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-2xl text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 text-sm"
            />
          </div>

          {/* رسائل الحالة */}
          {result === 'mismatch' && <p className="text-red-500 text-sm text-center">كلمتا المرور غير متطابقتين</p>}
          {result === 'err'      && <p className="text-red-500 text-sm text-center">فشل التغيير — تأكد أن كلمة المرور 6 أحرف على الأقل</p>}
          {result === 'ok'       && <p className="text-green-500 text-sm text-center font-bold">✓ تم تغيير كلمة المرور</p>}

          <button
            onClick={handleSave}
            disabled={saving || !newPass || !confirm}
            className="w-full py-4 rounded-2xl bg-gradient-to-b from-[#22A066] to-[#186341] dark:bg-none dark:bg-[#10B981] text-white font-bold text-base active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {saving ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── نافذة خصومات الأقسام والوجبات ─── */
type DiscCategory = { id: string; name: string; discount_pct: number };
type DiscItem = { id: string; name: string; category_id: string | null; discount_pct: number; price: number };

// معرّف وهمي لتجميع الوجبات التي لا تتبع أي قسم
const NO_CATEGORY_ID = '__none__';

function DiscountRow({ name, value, onChange, saving, saved, previewPrice, tone = 'item', leading }: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  saving?: boolean;
  saved?: boolean;
  previewPrice?: number;
  /** يميّز صرياً صف "القسم" عن صفوف "الوجبات" بداخله، حتى لا يبدوا بنفس اللون */
  tone?: 'category' | 'item';
  /** عنصر اختياري يُعرض بداخل نفس صندوق الصف (مثلاً سهم الطي/الفتح لصف القسم) بدل أن يكون خارجه */
  leading?: React.ReactNode;
}) {
  const pct = parseFloat(value);
  const active = !isNaN(pct) && pct > 0;
  const toneClasses = tone === 'category'
    ? 'bg-gray-200/90 dark:bg-white border border-gray-300/70'
    : 'bg-gray-50/80 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-700/40';
  const nameClasses = tone === 'category'
    ? 'font-semibold text-sm text-gray-500 truncate'
    : 'font-bold text-sm text-gray-800 dark:text-slate-200 truncate';
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${toneClasses}`}>
      {leading}
      <div className="flex-1 text-right min-w-0">
        <div className="flex items-center justify-end gap-1.5">
          {active && <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] flex-shrink-0" />}
          <p className={nameClasses}>{name}</p>
        </div>
        {active && previewPrice !== undefined && (
          <p className="text-[10px] text-gray-400 truncate">
            قبل: {previewPrice.toLocaleString()} — بعد: {applyDiscountPct(previewPrice, pct).toLocaleString()}
          </p>
        )}
      </div>
      <input type="number" min="0" max="100" step="0.5" inputMode="decimal" value={value}
        placeholder="0"
        onChange={e => onChange(e.target.value)}
        className="w-16 flex-shrink-0 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-center text-sm text-gray-900 dark:text-slate-100 placeholder-gray-300 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-[#f97316]" />
      <span className="text-[10px] text-gray-400 flex-shrink-0">%</span>
      <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
        {saving ? (
          <Loader2 size={13} className="animate-spin text-gray-400" />
        ) : saved ? (
          <Check size={13} className="text-green-500" />
        ) : null}
      </div>
    </div>
  );
}

function DiscountsSheet({ onClose, restaurantId }: { onClose: () => void; restaurantId: string | null }) {
  const [loading,    setLoading]    = useState(true);
  const [categories, setCategories] = useState<DiscCategory[]>([]);
  const [items,      setItems]      = useState<DiscItem[]>([]);
  const [catInputs,  setCatInputs]  = useState<Record<string, string>>({});
  const [itemInputs, setItemInputs] = useState<Record<string, string>>({});
  const [catSaving,  setCatSaving]  = useState<Record<string, boolean>>({});
  const [catSaved,   setCatSaved]   = useState<Record<string, boolean>>({});
  const [itemSaving, setItemSaving] = useState<Record<string, boolean>>({});
  const [itemSaved,  setItemSaved]  = useState<Record<string, boolean>>({});
  const [itemSearch, setItemSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [savingAll,  setSavingAll]  = useState(false);
  const [savedAll,   setSavedAll]   = useState(false);
  const [saveAllError, setSaveAllError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      const [{ data: cats }, { data: itms }] = await Promise.all([
        supabase.from('categories').select('id, name, discount_pct').eq('restaurant_id', restaurantId).order('sort_order', { ascending: true, nullsFirst: false }),
        supabase.from('items').select('id, name, category_id, discount_pct, price').eq('restaurant_id', restaurantId).order('name'),
      ]);
      const catList = (cats ?? []) as DiscCategory[];
      const itemList = (itms ?? []) as DiscItem[];
      setCategories(catList);
      setItems(itemList);
      setCatInputs(Object.fromEntries(catList.map(c => [c.id, c.discount_pct ? String(c.discount_pct) : ''])));
      setItemInputs(Object.fromEntries(itemList.map(i => [i.id, i.discount_pct ? String(i.discount_pct) : ''])));
      setLoading(false);
    })();
  }, [restaurantId]);

  // مجموعة "بدون قسم" مبنية على وجبات ليس لها category_id — تُضاف كمجموعة أخيرة فقط إن وُجدت
  const groups = useMemo(() => {
    const list: { id: string; name: string; category: DiscCategory | null; allItems: DiscItem[] }[] = categories.map(c => ({
      id: c.id,
      name: c.name,
      category: c,
      allItems: items.filter(i => i.category_id === c.id),
    }));
    const noneItems = items.filter(i => i.category_id === null);
    if (noneItems.length > 0) {
      list.push({ id: NO_CATEGORY_ID, name: 'بدون قسم', category: null, allItems: noneItems });
    }
    return list;
  }, [categories, items]);

  const query = itemSearch.trim().toLowerCase();

  // تصفية البحث: تطابق اسم القسم أو اسم أي وجبة فيه — مع توسيع تلقائي للمجموعات المطابقة
  const visibleGroups = useMemo(() => {
    if (!query) return groups.map(g => ({ ...g, displayItems: g.allItems }));
    return groups
      .map(g => {
        const nameMatch = g.name.toLowerCase().includes(query);
        const displayItems = nameMatch ? g.allItems : g.allItems.filter(i => i.name.toLowerCase().includes(query));
        return { ...g, displayItems, matched: nameMatch || displayItems.length > 0 };
      })
      .filter(g => g.matched);
  }, [groups, query]);

  const isGroupOpen = (id: string) => (query ? true : openGroups[id] !== false);
  const toggleGroup = (id: string) => setOpenGroups(prev => ({ ...prev, [id]: !isGroupOpen(id) }));

  // سعر تمثيلي للقسم لعرض المعاينة: متوسط أسعار الوجبات التي لا تملك خصماً خاصاً بها (فهي فعلياً من سيتأثر بخصم القسم)،
  // وإن لم توجد فمتوسط كل وجبات القسم، وإن لم توجد وجبات إطلاقاً فلا معاينة
  const categoryPreviewPrice = (catItems: DiscItem[]): number | undefined => {
    if (catItems.length === 0) return undefined;
    const affected = catItems.filter(i => (i.discount_pct ?? 0) <= 0);
    const pool = affected.length > 0 ? affected : catItems;
    return Math.round(pool.reduce((s, i) => s + i.price, 0) / pool.length);
  };

  // يحوّل قيمة الحقل النصية إلى نسبة رقمية — حقل فارغ يُعامل كـ 0
  const parseInput = (raw: string | undefined) => {
    if (raw === undefined || raw.trim() === '') return 0;
    const n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  };

  // حفظ جماعي: يحسب فقط الصفوف (أقسام + وجبات) التي تغيّرت فعلاً عن قيمتها المخزّنة، يرسلها بالتوازي،
  // ويحدّث الحالة المحلية فقط للصفوف التي نجحت — مع عرض خطأ واضح لو فشل جزء أو كانت نسبة غير صالحة
  const saveAllDiscounts = async () => {
    if (savingAll) return;
    setSaveAllError(null);

    const invalidNames: string[] = [];

    const catChanges = categories
      .map(c => ({ c, pct: parseInput(catInputs[c.id]) }))
      .filter(({ c, pct }) => pct !== (c.discount_pct ?? 0))
      .filter(({ c, pct }) => {
        if (pct < 0 || pct > 100) { invalidNames.push(c.name); return false; }
        return true;
      });

    const itemChanges = items
      .map(i => ({ i, pct: parseInput(itemInputs[i.id]) }))
      .filter(({ i, pct }) => pct !== (i.discount_pct ?? 0))
      .filter(({ i, pct }) => {
        if (pct < 0 || pct > 100) { invalidNames.push(i.name); return false; }
        return true;
      });

    if (catChanges.length === 0 && itemChanges.length === 0) {
      setSaveAllError(invalidNames.length > 0 ? 'نسبة غير صالحة: ' + invalidNames.join('، ') : null);
      return;
    }

    setSavingAll(true);
    setCatSaving(prev => { const next = { ...prev }; catChanges.forEach(({ c }) => { next[c.id] = true; }); return next; });
    setItemSaving(prev => { const next = { ...prev }; itemChanges.forEach(({ i }) => { next[i.id] = true; }); return next; });

    const [catResults, itemResults] = await Promise.all([
      Promise.all(catChanges.map(async ({ c, pct }) => {
        const { error } = await supabase.from('categories').update({ discount_pct: pct }).eq('id', c.id);
        return { id: c.id, name: c.name, pct, error };
      })),
      Promise.all(itemChanges.map(async ({ i, pct }) => {
        const { error } = await supabase.from('items').update({ discount_pct: pct }).eq('id', i.id);
        return { id: i.id, name: i.name, pct, error };
      })),
    ]);

    setCatSaving(prev => { const next = { ...prev }; catChanges.forEach(({ c }) => { next[c.id] = false; }); return next; });
    setItemSaving(prev => { const next = { ...prev }; itemChanges.forEach(({ i }) => { next[i.id] = false; }); return next; });

    const catFailed = catResults.filter(r => r.error);
    const itemFailed = itemResults.filter(r => r.error);
    const catOk = catResults.filter(r => !r.error);
    const itemOk = itemResults.filter(r => !r.error);

    if (catOk.length > 0) {
      setCategories(prev => prev.map(c => {
        const found = catOk.find(r => r.id === c.id);
        return found ? { ...c, discount_pct: found.pct } : c;
      }));
      const ids = catOk.map(r => r.id);
      setCatSaved(prev => { const next = { ...prev }; ids.forEach(id => { next[id] = true; }); return next; });
      setTimeout(() => setCatSaved(prev => { const next = { ...prev }; ids.forEach(id => { next[id] = false; }); return next; }), 2000);
    }
    if (itemOk.length > 0) {
      setItems(prev => prev.map(i => {
        const found = itemOk.find(r => r.id === i.id);
        return found ? { ...i, discount_pct: found.pct } : i;
      }));
      const ids = itemOk.map(r => r.id);
      setItemSaved(prev => { const next = { ...prev }; ids.forEach(id => { next[id] = true; }); return next; });
      setTimeout(() => setItemSaved(prev => { const next = { ...prev }; ids.forEach(id => { next[id] = false; }); return next; }), 2000);
    }

    setSavingAll(false);

    const errorParts: string[] = [];
    if (catFailed.length > 0 || itemFailed.length > 0) {
      errorParts.push('فشل حفظ: ' + [...catFailed, ...itemFailed].map(r => r.name).join('، '));
    }
    if (invalidNames.length > 0) errorParts.push('نسبة غير صالحة: ' + invalidNames.join('، '));

    if (errorParts.length > 0) { setSaveAllError(errorParts.join(' | ')); return; }

    setSavedAll(true);
    setTimeout(() => setSavedAll(false), 2000);
  };

  return (
    <BottomSheet
      title="خصومات الأقسام والوجبات"
      onClose={onClose}
      maxHeight="90vh"
      headerAction={
        <button onClick={saveAllDiscounts} disabled={savingAll}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-[#22A066] to-[#186341] dark:bg-none dark:bg-[#10B981] text-white font-bold text-sm rounded-xl active:scale-95 transition-all disabled:opacity-50">
          {savingAll ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {savedAll ? '✓ تم' : 'حفظ'}
        </button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="animate-spin text-gray-400" size={26} />
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3.5 text-gray-400 dark:text-slate-500" />
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
              placeholder="ابحث عن قسم أو وجبة..." dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl py-2.5 pr-9 pl-3 text-right text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316]" />
          </div>

          {saveAllError && (
            <p className="text-red-500 text-xs text-center font-bold">{saveAllError}</p>
          )}

          {visibleGroups.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              {query ? 'لا توجد نتائج' : 'لا توجد أقسام'}
            </p>
          ) : (
            <div className="space-y-3">
              {visibleGroups.map(g => {
                const open = isGroupOpen(g.id);
                return (
                  <div key={g.id} className="rounded-xl bg-gray-50/60 dark:bg-slate-800/30 overflow-hidden">
                    {g.category ? (
                      <DiscountRow name={g.name} tone="category"
                        value={catInputs[g.id] ?? ''}
                        onChange={v => setCatInputs(prev => ({ ...prev, [g.id]: v }))}
                        saving={!!catSaving[g.id]} saved={!!catSaved[g.id]}
                        previewPrice={categoryPreviewPrice(g.allItems)}
                        leading={
                          <button onClick={() => toggleGroup(g.id)}
                            className="p-1 -m-1 text-gray-500 flex-shrink-0"
                            aria-label={open ? 'طي القسم' : 'توسيع القسم'}>
                            <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                          </button>
                        } />
                    ) : (
                      <button onClick={() => toggleGroup(g.id)}
                        className="w-full flex items-center gap-1.5 px-2 py-2">
                        <ChevronDown size={16} className={`text-gray-400 dark:text-slate-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 flex-1 text-right">{g.name}</p>
                      </button>
                    )}

                    {open && (
                      g.displayItems.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-2">لا توجد وجبات</p>
                      ) : (
                        <div className="relative pr-6 pl-1 pb-2 pt-1 space-y-2">
                          {/* الخط العمودي: ينزل من القسم على طول قائمة وجباته */}
                          <div className="absolute top-0 bottom-3 right-3 w-px bg-gray-300 dark:bg-slate-600" />
                          {g.displayItems.map(i => (
                            <div key={i.id} className="relative">
                              {/* خط أفقي قصير يصل الوجبة بالخط العمودي */}
                              <span className="absolute top-1/2 right-3 -translate-y-1/2 w-3 h-px bg-gray-300 dark:bg-slate-600" />
                              <DiscountRow name={i.name} tone="item"
                                value={itemInputs[i.id] ?? ''}
                                onChange={v => setItemInputs(prev => ({ ...prev, [i.id]: v }))}
                                saving={!!itemSaving[i.id]} saved={!!itemSaved[i.id]}
                                previewPrice={i.price} />
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
}

/* ─── الصفحة الرئيسية ─── */
export default function SettingsPage() {
  const router = useRouter();
  const { is_closed, opens_at, id: settingsId, schedule: ctxSchedule, refreshSettings, loaded, delivery_fee, min_order_amount, coupon_code, coupon_discount_pct, coupon_enabled, coupon_allow_retroactive, show_best_sellers } = useSettings();
  const { restaurantId } = useRestaurant();
  const { dark, toggleDark } = useDarkMode();
  const { isCashier } = useStaff();
  const { notifications, notifLoading, unreadCount, markAllRead } = useSuperAdminNotifications();

  const [scheduleLocal,    setScheduleLocal]    = useState<WeekSchedule | null>(null);
  const [showClosedModal,  setShowClosedModal]  = useState(false);
  const [opensAtInput,     setOpensAtInput]     = useState('');
  const [showSchedule,     setShowSchedule]     = useState(false);
  const [showRestaurantStatus, setShowRestaurantStatus] = useState(false);
  const [showInfo,         setShowInfo]         = useState(false);
  const [showChangePass,   setShowChangePass]   = useState(false);
  const [showAccount,      setShowAccount]      = useState(false);
  const [showDeliveryFee,  setShowDeliveryFee]  = useState(false);
  const [showMinOrder,     setShowMinOrder]     = useState(false);
  const [showCoupon,       setShowCoupon]       = useState(false);
  const [showDiscounts,    setShowDiscounts]    = useState(false);
  const [username,         setUsername]         = useState('');
  const [tick,             setTick]             = useState(0);
  const [toggleError,      setToggleError]      = useState<string | null>(null);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('0');
  const [feeSaving,        setFeeSaving]        = useState(false);
  const [feeSaved,         setFeeSaved]         = useState(false);
  const [minOrderInput,    setMinOrderInput]    = useState('0');
  const [minOrderSaving,   setMinOrderSaving]   = useState(false);
  const [minOrderSaved,    setMinOrderSaved]    = useState(false);
  const [couponCodeInput,  setCouponCodeInput]  = useState('');
  const [couponPctInput,   setCouponPctInput]   = useState('0');
  const [couponEnabledLocal, setCouponEnabledLocal] = useState(false);
  const [couponAllowRetroactiveLocal, setCouponAllowRetroactiveLocal] = useState(false);
  const [couponSaving,     setCouponSaving]     = useState(false);
  const [couponSaved,      setCouponSaved]      = useState(false);
  const [bestSellersLocal, setBestSellersLocal] = useState(true);
  const [bestSellersSaving, setBestSellersSaving] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email ?? '';
      setUsername(email.replace('@dasha.app', ''));
    });
  }, []);
  useEffect(() => { setScheduleLocal(ctxSchedule); }, [ctxSchedule]);
  useEffect(() => { setDeliveryFeeInput(String(delivery_fee ?? 0)); }, [delivery_fee]);
  useEffect(() => { setMinOrderInput(String(min_order_amount ?? 0)); }, [min_order_amount]);
  useEffect(() => { setBestSellersLocal(show_best_sellers); }, [show_best_sellers]);
  useEffect(() => { setCouponCodeInput(coupon_code ?? ''); }, [coupon_code]);
  useEffect(() => { setCouponPctInput(String(coupon_discount_pct ?? 0)); }, [coupon_discount_pct]);
  useEffect(() => { setCouponEnabledLocal(!!coupon_enabled); }, [coupon_enabled]);
  useEffect(() => { setCouponAllowRetroactiveLocal(!!coupon_allow_retroactive); }, [coupon_allow_retroactive]);
  // "tick" يحدّث كل دقيقة حتى تتحدّث حالة "متوقع حسب الجدولة" أدناه بدون تفاعل من المستخدم
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // حالة معلوماتية فقط: هل يُفترض أن يكون المطعم مفتوحاً الآن حسب الجدولة؟
  // لا تكتب لقاعدة البيانات إطلاقاً — الحساب الفعلي المعروض للزبون يتم ديناميكياً بنفس الدالة المشتركة
  // (isRestaurantOpenNow) بصفحة الزبون. الإغلاق/الفتح الفعلي يبقى قراراً يدوياً بحتاً عبر handleToggleClosed.
  const scheduleExpectedOpen = useMemo(
    () => isRestaurantOpenNow(scheduleLocal, is_closed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduleLocal, is_closed, tick]
  );
  // مغلق فعلياً بسبب الجدولة التلقائية (وليس إغلاقاً يدوياً)
  const closedBySchedule = !is_closed && !!scheduleLocal?.auto && !scheduleExpectedOpen;
  // الحالة الفعلية المعروضة بصرياً بالمفتاح: إغلاق يدوي أو إغلاق بسبب الجدولة
  const effectivelyClosed = is_closed || closedBySchedule;

  const handleToggleClosed = async () => {
    setToggleError(null);
    if (closedBySchedule) {
      // مغلق بسبب الجدولة فقط (لا إغلاق يدوي) — الفتح الفوري من هنا يوقف "التطبيق التلقائي"
      // بالجدولة (auto: false) بدل التلاعب بـ is_closed، فتبقى أيام/أوقات الجدولة محفوظة كما هي
      // ويمكن إعادة تفعيلها لاحقاً من نافذة الجدولة نفسها.
      if (!scheduleLocal) return;
      const nextSchedule: WeekSchedule = { ...scheduleLocal, auto: false };
      const { error } = await supabase.from('restaurant_settings').update({ schedule: nextSchedule }).eq('id', settingsId);
      if (error) { setToggleError('فشل فتح المطعم: ' + error.message); return; }
      setScheduleLocal(nextSchedule);
      await refreshSettings();
      return;
    }
    if (is_closed) {
      const { error } = await supabase.from('restaurant_settings').update({ is_closed: false, opens_at: null }).eq('id', settingsId);
      if (error) { setToggleError('فشل فتح المطعم: ' + error.message); return; }
      await refreshSettings();
    } else {
      // نملأ الحقل بقيمة افتراضية معقولة (أقرب وقت فتح حسب الجدولة إن وُجد، وإلا الوقت الحالي)
      // بدل تركه فارغاً — بعض المتصفحات لا تُظهر شيئاً بحقل input[type=time] الفارغ حتى يُضغط عليه
      const next = getNextOpenTime(scheduleLocal);
      setOpensAtInput(formatHHMM(next ?? new Date()));
      setShowClosedModal(true);
    }
  };
  const confirmClose = async () => {
    setToggleError(null);
    const { error } = await supabase.from('restaurant_settings').update({ is_closed: true, opens_at: opensAtInput || null }).eq('id', settingsId);
    if (error) { setToggleError('فشل إغلاق المطعم: ' + error.message); return; }
    setShowClosedModal(false);
    await refreshSettings();
  };
  const saveDeliveryFee = async () => {
    const value = parseFloat(deliveryFeeInput);
    if (isNaN(value) || value < 0) return;
    setFeeSaving(true);
    const { error } = await supabase.from('restaurant_settings').update({ delivery_fee: value }).eq('id', settingsId);
    if (!error) {
      await refreshSettings();
      setFeeSaved(true);
      setTimeout(() => setFeeSaved(false), 2000);
    }
    setFeeSaving(false);
  };
  const saveMinOrderAmount = async () => {
    const value = parseFloat(minOrderInput);
    if (isNaN(value) || value < 0) return;
    setMinOrderSaving(true);
    const { error } = await supabase.from('restaurant_settings').update({ min_order_amount: value }).eq('id', settingsId);
    if (!error) {
      await refreshSettings();
      setMinOrderSaved(true);
      setTimeout(() => setMinOrderSaved(false), 2000);
    }
    setMinOrderSaving(false);
  };
  const saveCoupon = async () => {
    const pct = parseFloat(couponPctInput);
    if (isNaN(pct) || pct < 0 || pct > 100) return;
    const code = couponCodeInput.trim().toUpperCase();
    setCouponSaving(true);
    const { error } = await supabase.from('restaurant_settings').update({
      coupon_code: code || null,
      coupon_discount_pct: pct,
      coupon_enabled: couponEnabledLocal && !!code && pct > 0,
      coupon_allow_retroactive: couponAllowRetroactiveLocal,
    }).eq('id', settingsId);
    if (!error) {
      await refreshSettings();
      setCouponSaved(true);
      setTimeout(() => setCouponSaved(false), 2000);
    }
    setCouponSaving(false);
  };
  const toggleBestSellers = async () => {
    if (!settingsId || bestSellersSaving) return;
    const next = !bestSellersLocal;
    setBestSellersLocal(next);
    setBestSellersSaving(true);
    const { error } = await supabase.from('restaurant_settings').update({ show_best_sellers: next }).eq('id', settingsId);
    if (error) setBestSellersLocal(!next);
    else await refreshSettings();
    setBestSellersSaving(false);
  };

  const logout = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  if (!loaded) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#212121] flex items-center justify-center">
      <Loader2 className="animate-spin text-gray-400" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#212121] pb-24 md:pb-0 md:mr-[70px]">

      {/* هيدر */}
      <AdminHeader title="الإعدادات" />

      <div className="px-4 pt-4 space-y-4">

        {/* تعديل معلومات المطعم */}
        <button
          onClick={() => setShowInfo(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <PenLine size={18} className="text-gray-600 dark:text-slate-400" />
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">تعديل معلومات المطعم</p>
            </div>
          </div>
          <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
        </button>

        {/* الحساب وتسجيل الدخول */}
        <button
          onClick={() => setShowAccount(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <KeyRound size={18} className="text-gray-600 dark:text-slate-400" />
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">الحساب وتسجيل الدخول</p>
            </div>
          </div>
          <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
        </button>

        {/* ─ حالة المطعم ─ */}
        <button onClick={() => setShowRestaurantStatus(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl active:scale-[0.98] transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <Power size={18} className="text-gray-600 dark:text-slate-400" />
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">حالة المطعم</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <p className={`text-xs font-bold ${effectivelyClosed ? 'text-red-500' : 'text-green-500'}`}>
              {effectivelyClosed ? '🔒 مغلق' : '✅ مفتوح'}
            </p>
            <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
          </div>
        </button>

        {/* رسوم التوصيل */}
        <button onClick={() => setShowDeliveryFee(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl active:scale-[0.98] transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <Truck size={18} className="text-gray-600 dark:text-slate-400" />
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">رسوم التوصيل</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500">{(delivery_fee ?? 0).toLocaleString()} د.ع</p>
            <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
          </div>
        </button>

        {/* الحد الأدنى للطلب */}
        <button onClick={() => setShowMinOrder(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl active:scale-[0.98] transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <Wallet size={18} className="text-gray-600 dark:text-slate-400" />
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">الحد الأدنى للطلب</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500">{(min_order_amount ?? 0).toLocaleString()} د.ع</p>
            <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
          </div>
        </button>

        {/* كوبون الخصم — كوبون واحد لكل مطعم، خصم نسبة مئوية، يدخله الزبون بصفحة السلة عند إتمام الطلب. */}
        <button onClick={() => setShowCoupon(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl active:scale-[0.98] transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <Ticket size={18} className="text-gray-600 dark:text-slate-400" />
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">كوبون الخصم</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500">{couponEnabledLocal ? 'مفعّل' : 'غير مفعّل'}</p>
            <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
          </div>
        </button>

        {/* خصومات الأقسام والوجبات */}
        <button onClick={() => setShowDiscounts(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl active:scale-[0.98] transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <Percent size={18} className="text-gray-600 dark:text-slate-400" />
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">خصومات الأقسام والوجبات</p>
            </div>
          </div>
          <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600 flex-shrink-0" />
        </button>

        {/* ─ الأكثر مبيعاً — قسم ثابت يظهر دائماً أولاً في منيو الزبون، بأفضل 3 وجبات مبيعاً ─ */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <Flame size={18} className="text-gray-600 dark:text-slate-400" />
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">الأكثر مبيعاً</p>
            </div>
          </div>
          <button type="button" onClick={toggleBestSellers} dir="ltr"
            className="w-11 h-6 rounded-full transition-all relative flex-shrink-0"
            style={{ backgroundColor: bestSellersLocal ? '#10B981' : '#EF4444' }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ right: bestSellersLocal ? '2px' : '22px' }} />
          </button>
        </div>

        {/* ─ الإحصائيات — مخفية بالكامل عن الكاشير (لا تظهر حتى مقفلة). الأرشيف: يظهر مقفل بعلامة قفل ─ */}
        <div className="grid grid-cols-2 gap-3">
          {!isCashier && (
            <button onClick={() => router.push('/admin/statistics')}
              className="flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 transition-all active:scale-95">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                  <BarChart2 size={16} className="text-gray-600 dark:text-slate-400" />
                </div>
                <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">الإحصائيات</span>
              </div>
              <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
            </button>
          )}
          <button onClick={() => router.push('/admin/archive')}
            className={`flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 transition-all active:scale-95 ${isCashier ? 'col-span-2' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                <Archive size={16} className="text-gray-600 dark:text-slate-400" />
              </div>
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">الأرشيف</span>
            </div>
            <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
          </button>
        </div>

        {/* ─ إدارة الموظفين والصلاحيات (RBAC) — للكاشير: تظهر مقفلة بعلامة قفل بدل الاختفاء التام ─ */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => !isCashier && router.push('/admin/settings/staff')}
            disabled={isCashier}
            className={`flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 transition-all ${isCashier ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                <User size={16} className="text-gray-600 dark:text-slate-400" />
              </div>
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">الموظفين</span>
            </div>
            {isCashier ? <Lock size={16} className="text-gray-300 dark:text-slate-600" /> : <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />}
          </button>
          <button onClick={() => !isCashier && router.push('/admin/audit')}
            disabled={isCashier}
            className={`flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 transition-all ${isCashier ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                <KeyRound size={16} className="text-gray-600 dark:text-slate-400" />
              </div>
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">سجل التدقيق</span>
            </div>
            {isCashier ? <Lock size={16} className="text-gray-300 dark:text-slate-600" /> : <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />}
          </button>
        </div>

        {/* الإشعارات — مخفية عن الكاشير */}
        {!isCashier && (
          <button onClick={() => { setShowNotifications(true); markAllRead(); }}
            className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl active:scale-[0.98] transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Bell size={18} className="text-gray-600 dark:text-slate-400" />
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">الإشعارات</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">{unreadCount}</span>
              )}
              <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
            </div>
          </button>
        )}

        {/* المظهر */}
        <div className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              {dark ? <Moon size={18} className="text-gray-600 dark:text-slate-400" /> : <Sun size={18} className="text-gray-600 dark:text-slate-400" />}
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">المظهر</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-black'}`}>{dark ? 'داكن' : 'فاتح'}</span>
            <button onClick={toggleDark} dir="ltr"
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${dark ? 'bg-[#f97316]' : 'bg-gray-300 dark:bg-slate-500'}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${dark ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>

        {/* ─ تسجيل الخروج ─ */}
        <button onClick={logout}
          className="w-full py-4 rounded-2xl bg-red-500 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
          <LogOut size={16} />
          تسجيل الخروج
        </button>

      </div>

      {!showRestaurantStatus && !showAccount && !showInfo && !showChangePass && !showDeliveryFee && !showMinOrder && !showCoupon && !showDiscounts && !showNotifications && <AdminBottomNav />}

      {/* نافذة الحساب وتسجيل الدخول */}
      {showAccount && (
        <BottomSheet title="الحساب وتسجيل الدخول" onClose={() => setShowAccount(false)}>
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
            <p className="font-mono font-bold text-gray-800 dark:text-slate-200 text-sm" dir="ltr">{username}</p>
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500">اسم المستخدم</p>
          </div>
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
            <p className="font-mono text-gray-400 tracking-widest text-sm">••••••••</p>
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500">كلمة المرور</p>
          </div>
          <button
            onClick={() => setShowChangePass(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 font-bold text-sm active:scale-95 transition-all"
          >
            <KeyRound size={15} />
            تغيير كلمة المرور
          </button>
        </BottomSheet>
      )}

      {/* نافذة تغيير كلمة المرور */}
      {showChangePass && (
        <ChangePasswordSheet
          onClose={() => setShowChangePass(false)}
          username={username}
        />
      )}

      {/* نافذة معلومات المطعم */}
      {showInfo && (
        <RestaurantInfoSheet
          onClose={() => setShowInfo(false)}
          settingsId={settingsId}
          refreshSettings={refreshSettings}
        />
      )}

      {/* نافذة حالة المطعم */}
      {showRestaurantStatus && (
        <BottomSheet title="حالة المطعم" onClose={() => setShowRestaurantStatus(false)}>
          <div className="flex gap-2">
            <button onClick={() => setShowSchedule(true)}
              className="relative flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl border bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 active:scale-95 transition-all">
              <Calendar size={18} className="text-gray-500 dark:text-slate-400" />
              <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">جدولة</span>
              {scheduleLocal?.auto && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-400" />}
            </button>
            <button onClick={handleToggleClosed}
              className={`flex-1 rounded-xl px-4 py-3 border flex items-center justify-between transition-all active:scale-[0.98] ${effectivelyClosed ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'}`}>
              <div dir="ltr" className={`relative w-10 h-5 rounded-full transition-colors duration-300 flex-shrink-0 ${effectivelyClosed ? 'bg-[#EF4444]' : 'bg-[#10B981]'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${effectivelyClosed ? 'translate-x-0' : 'translate-x-5'}`} />
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${effectivelyClosed ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {is_closed ? '🔒 المطعم مغلق' : closedBySchedule ? '⏰ مغلق الآن (حسب الجدولة)' : '✅ المطعم مفتوح'}
                </p>
                {is_closed && opens_at && (
                  <p className="text-xs text-gray-400 mt-0.5">سيفتح الساعة {opens_at}</p>
                )}
                {closedBySchedule && (
                  <p className="text-xs text-gray-400 mt-0.5">اضغط للفتح الفوري (يوقف التطبيق التلقائي)</p>
                )}
              </div>
            </button>
          </div>
          {scheduleLocal?.auto && (
            <p className="text-center text-[11px] font-bold text-gray-400 dark:text-slate-500">
              حسب الجدولة الآن يُفترض أن يكون المطعم {scheduleExpectedOpen ? 'مفتوحاً 🟢' : 'مغلقاً 🔴'} — هذا يُطبَّق تلقائياً بصفحة الزبون والمفتاح أعلاه. لو أغلق المطعم بسبب الجدولة، اضغط المفتاح لفتحه فوراً وإيقاف التطبيق التلقائي
            </p>
          )}
          {toggleError && (
            <p className="text-red-500 text-xs text-center font-bold">{toggleError}</p>
          )}
        </BottomSheet>
      )}

      {/* نافذة رسوم التوصيل */}
      {showDeliveryFee && (
        <BottomSheet title="رسوم التوصيل" onClose={() => setShowDeliveryFee(false)}>
          <p className="text-xs text-gray-500 dark:text-slate-400">تُضاف تلقائياً لفاتورة الزبون عند اختيار &quot;توصيل&quot; من قائمة الطلب</p>
          <div className="flex items-center gap-2">
            <input type="number" min="0" inputMode="decimal" value={deliveryFeeInput}
              onChange={e => setDeliveryFeeInput(e.target.value)}
              className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]" />
            <span className="text-xs text-gray-400 flex-shrink-0">د.ع</span>
          </div>
          <button onClick={saveDeliveryFee} disabled={feeSaving}
            className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-gradient-to-b from-[#22A066] to-[#186341] dark:bg-none dark:bg-[#10B981] text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
            {feeSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {feeSaved ? '✓ تم' : 'حفظ'}
          </button>
        </BottomSheet>
      )}

      {/* نافذة الحد الأدنى للطلب */}
      {showMinOrder && (
        <BottomSheet title="الحد الأدنى للطلب" onClose={() => setShowMinOrder(false)}>
          <p className="text-xs text-gray-500 dark:text-slate-400">أقل قيمة مسموحة لطلب &quot;توصيل&quot; من قائمة الزبون — اتركه 0 لتعطيله</p>
          <div className="flex items-center gap-2">
            <input type="number" min="0" inputMode="decimal" value={minOrderInput}
              onChange={e => setMinOrderInput(e.target.value)}
              className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]" />
            <span className="text-xs text-gray-400 flex-shrink-0">د.ع</span>
          </div>
          <button onClick={saveMinOrderAmount} disabled={minOrderSaving}
            className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-gradient-to-b from-[#22A066] to-[#186341] dark:bg-none dark:bg-[#10B981] text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
            {minOrderSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {minOrderSaved ? '✓ تم' : 'حفظ'}
          </button>
        </BottomSheet>
      )}

      {/* نافذة كوبون الخصم */}
      {showCoupon && (
        <BottomSheet title="كوبون الخصم" onClose={() => setShowCoupon(false)}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-slate-400 flex-1">كود يدخله الزبون بالسلة فيحصل على خصم بالنسبة المحددة</p>
            <button type="button" onClick={() => setCouponEnabledLocal(v => !v)} dir="ltr"
              className="w-11 h-6 rounded-full transition-all relative flex-shrink-0 mr-3"
              style={{ backgroundColor: couponEnabledLocal ? '#10B981' : '#EF4444' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                style={{ right: couponEnabledLocal ? '2px' : '22px' }} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-slate-400 flex-1">السماح بتطبيق الكوبون على طلب موجود مسبقاً (رجعياً)</p>
            <button type="button" onClick={() => setCouponAllowRetroactiveLocal(v => !v)} dir="ltr"
              className="w-11 h-6 rounded-full transition-all relative flex-shrink-0 mr-3"
              style={{ backgroundColor: couponAllowRetroactiveLocal ? '#10B981' : '#EF4444' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                style={{ right: couponAllowRetroactiveLocal ? '2px' : '22px' }} />
            </button>
          </div>
          <input type="text" value={couponCodeInput} onChange={e => setCouponCodeInput(e.target.value)}
            placeholder="كود الكوبون (مثال: SAVE10)" dir="rtl"
            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316]" />
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="100" inputMode="decimal" value={couponPctInput}
              onChange={e => setCouponPctInput(e.target.value)}
              className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]" />
            <span className="text-xs text-gray-400 flex-shrink-0">%</span>
          </div>
          <button onClick={saveCoupon} disabled={couponSaving}
            className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-gradient-to-b from-[#22A066] to-[#186341] dark:bg-none dark:bg-[#10B981] text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
            {couponSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {couponSaved ? '✓ تم' : 'حفظ'}
          </button>
        </BottomSheet>
      )}

      {/* نافذة خصومات الأقسام والوجبات */}
      {showDiscounts && (
        <DiscountsSheet
          onClose={() => setShowDiscounts(false)}
          restaurantId={restaurantId}
        />
      )}

      {/* نافذة الإشعارات */}
      {showNotifications && (
        <BottomSheet title="الإشعارات" onClose={() => setShowNotifications(false)} maxHeight="80vh">
          {notifLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={26} /></div>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">لا توجد إشعارات</p>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => (
                <div key={n.id} className={`rounded-xl px-4 py-3 border ${n.read ? 'bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-700' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/40'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-gray-400">{new Date(n.created_at).toLocaleString('ar-IQ')}</p>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-orange-500" />}
                  </div>
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm mb-1">{n.title}</p>
                  <p className="text-gray-600 dark:text-slate-400 text-sm whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </BottomSheet>
      )}

      {/* موديل جدولة الدوام */}
      {showSchedule && (
        <ScheduleModal
          schedule={scheduleLocal}
          settingsId={settingsId}
          onSaved={setScheduleLocal}
          onClose={() => setShowSchedule(false)}
          refreshSettings={refreshSettings}
        />
      )}

      {/* موديل إغلاق المطعم */}
      {showClosedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" onClick={() => setShowClosedModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <p className="text-4xl mb-2">🔒</p>
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">إغلاق المطعم</h3>
              <p className="text-sm text-gray-400 mt-1">حدد وقت الفتح (اختياري)</p>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700 rounded-2xl px-4 py-3 mb-5">
              <Clock size={18} className="text-gray-400 flex-shrink-0" />
              <input type="time" value={opensAtInput} onChange={e => setOpensAtInput(e.target.value)}
                className="flex-1 bg-transparent text-lg font-bold text-gray-900 dark:text-slate-100 outline-none text-center" />
            </div>
            {toggleError && (
              <p className="text-red-500 text-xs text-center font-bold mb-3">{toggleError}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowClosedModal(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-slate-600 font-bold text-gray-600 dark:text-slate-400 active:scale-95 transition-all">
                إلغاء
              </button>
              <button onClick={confirmClose}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold active:scale-95 transition-all">
                تأكيد الإغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
