'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSettings, type DaySchedule, type WeekSchedule } from '@/context/SettingsContext';
import { Save, Palette, Type, Loader2, Moon, Sun, ShoppingBag, MapPin, MessageCircle, X, LogOut, Clock, Calendar, BarChart2, Archive, ChevronLeft, PenLine, KeyRound, Eye, EyeOff, User, Lock, Truck, Wallet, Users, Ticket } from 'lucide-react';
import { AdminBottomNav } from '@/components/BottomNav';
import { useRestaurant } from '@/context/RestaurantContext';
import { useDarkMode } from '@/context/ThemeContext';
import { useStaff } from '@/context/StaffContext';

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

  useEffect(() => { setSched(initSchedule ?? DEFAULT_WEEK); }, [initSchedule]);

  const updateDay = (key: string, field: keyof DaySchedule, val: boolean | string) =>
    setSched(prev => ({ ...prev, days: { ...prev.days, [key]: { ...prev.days[key], [field]: val } } }));

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
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all">
            <X size={18} />
          </button>
          <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">جدولة الدوام</p>
          <div className="w-9" />
        </div>
        <div className="overflow-y-auto flex-1 px-5 pt-4">
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-2xl px-4 py-3 mb-5">
            <button onClick={() => setSched(prev => ({ ...prev, auto: !prev.auto }))} dir="ltr"
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${sched.auto ? 'bg-green-400' : 'bg-gray-300 dark:bg-slate-500'}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${sched.auto ? 'translate-x-6' : ''}`} />
            </button>
            <div className="text-right">
              <p className="font-bold text-sm text-gray-800 dark:text-slate-200">تطبيق تلقائي</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">يفتح ويغلق المطعم حسب الجدول</p>
            </div>
          </div>
          <div className="space-y-3 pb-4">
            {[0,1,2,3,4,5,6].map(d => {
              const key = String(d);
              const day: DaySchedule = sched.days[key] ?? { enabled: false, open: '10:00', close: '23:00' };
              return (
                <div key={d} className={`bg-gray-50 dark:bg-slate-700/50 rounded-2xl px-4 py-3 transition-opacity ${!day.enabled ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => updateDay(key, 'enabled', !day.enabled)} dir="ltr"
                      className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${day.enabled ? 'bg-[#f97316]' : 'bg-gray-300 dark:bg-slate-500'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${day.enabled ? 'translate-x-5' : ''}`} />
                    </button>
                    <p className="font-bold text-sm text-gray-800 dark:text-slate-200">{DAY_NAMES[d]}</p>
                  </div>
                  {day.enabled && (
                    <div className="flex items-center gap-2">
                      <input type="time" value={day.close} onChange={e => updateDay(key, 'close', e.target.value)}
                        className="flex-1 text-sm text-center bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-xl py-2 outline-none text-gray-700 dark:text-slate-200" />
                      <span className="text-gray-300 dark:text-slate-500 text-sm font-bold">—</span>
                      <input type="time" value={day.open} onChange={e => updateDay(key, 'open', e.target.value)}
                        className="flex-1 text-sm text-center bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-xl py-2 outline-none text-gray-700 dark:text-slate-200" />
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
            className="w-full py-4 rounded-2xl bg-black text-white font-bold text-base active:scale-95 transition-all disabled:opacity-60">
            {saving ? 'جاري الحفظ...' : 'حفظ الجدولة'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── نافذة معلومات المطعم ─── */
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

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div dir="rtl">
      <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-1.5 px-1">{label}</p>
      {children}
    </div>
  );

  const inputCls = "w-full px-4 py-3.5 bg-gray-50 dark:bg-slate-800 rounded-2xl text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={close}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`relative w-full bg-white dark:bg-slate-900 rounded-t-3xl transition-transform duration-300 ease-out flex flex-col max-h-[92vh] ${animateIn ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* هيدر */}
        <div className="flex-shrink-0 px-5 pt-4 pb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="w-10 h-1 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-bold text-sm rounded-xl active:scale-95 transition-all disabled:opacity-50">
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
        className={`relative w-full bg-white dark:bg-slate-900 rounded-t-3xl transition-transform duration-300 ease-out max-h-[85vh] flex flex-col ${animateIn ? 'translate-y-0' : 'translate-y-full'}`}
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
            className="w-full py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-bold text-base active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {saving ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── الصفحة الرئيسية ─── */
export default function SettingsPage() {
  const router = useRouter();
  const { is_closed, opens_at, id: settingsId, schedule: ctxSchedule, refreshSettings, loaded, delivery_fee, min_order_amount, coupon_code, coupon_discount_pct, coupon_enabled } = useSettings();
  const { dark, toggleDark } = useDarkMode();
  const { isCashier, activeStaff, switchUser } = useStaff();
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  const [scheduleLocal,    setScheduleLocal]    = useState<WeekSchedule | null>(null);
  const [showClosedModal,  setShowClosedModal]  = useState(false);
  const [opensAtInput,     setOpensAtInput]     = useState('');
  const [showSchedule,     setShowSchedule]     = useState(false);
  const [showInfo,         setShowInfo]         = useState(false);
  const [showChangePass,   setShowChangePass]   = useState(false);
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
  const [couponSaving,     setCouponSaving]     = useState(false);
  const [couponSaved,      setCouponSaved]      = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email ?? '';
      setUsername(email.replace('@dasha.app', ''));
    });
  }, []);
  const isClosedRef = useRef(is_closed);
  useEffect(() => { isClosedRef.current = is_closed; }, [is_closed]);
  useEffect(() => { setScheduleLocal(ctxSchedule); }, [ctxSchedule]);
  useEffect(() => { setDeliveryFeeInput(String(delivery_fee ?? 0)); }, [delivery_fee]);
  useEffect(() => { setMinOrderInput(String(min_order_amount ?? 0)); }, [min_order_amount]);
  useEffect(() => { setCouponCodeInput(coupon_code ?? ''); }, [coupon_code]);
  useEffect(() => { setCouponPctInput(String(coupon_discount_pct ?? 0)); }, [coupon_discount_pct]);
  useEffect(() => { setCouponEnabledLocal(!!coupon_enabled); }, [coupon_enabled]);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!scheduleLocal?.auto || !settingsId || !loaded) return;
    const now    = new Date();
    const dayKey = String(now.getDay());
    const day    = scheduleLocal.days?.[dayKey];
    let shouldBeOpen: boolean;
    if (!day?.enabled) {
      shouldBeOpen = false;
    } else {
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const [oh=0, om=0]   = (day.open  || '00:00').split(':').map(Number);
      const [ch=23, cm=59] = (day.close || '23:59').split(':').map(Number);
      const openMins  = oh*60+om;
      const closeMins = ch*60+cm;
      // دوام يعبر منتصف الليل (مثلاً 18:00 → 02:00): closeMins <= openMins
      shouldBeOpen = closeMins > openMins
        ? (nowMins >= openMins && nowMins < closeMins)
        : (nowMins >= openMins || nowMins < closeMins);
    }
    if (shouldBeOpen && isClosedRef.current) {
      supabase.from('restaurant_settings').update({ is_closed: false, opens_at: null }).eq('id', settingsId).then(() => refreshSettings());
    } else if (!shouldBeOpen && !isClosedRef.current) {
      const nextOpen = scheduleLocal.days?.[dayKey]?.open ?? null;
      supabase.from('restaurant_settings').update({ is_closed: true, opens_at: nextOpen }).eq('id', settingsId).then(() => refreshSettings());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, scheduleLocal, settingsId, loaded]);

  const handleToggleClosed = async () => {
    if (is_closed) {
      setToggleError(null);
      const { error } = await supabase.from('restaurant_settings').update({ is_closed: false, opens_at: null }).eq('id', settingsId);
      if (error) { setToggleError('فشل فتح المطعم: ' + error.message); return; }
      await refreshSettings();
    } else {
      setToggleError(null);
      setOpensAtInput('');
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
    }).eq('id', settingsId);
    if (!error) {
      await refreshSettings();
      setCouponSaved(true);
      setTimeout(() => setCouponSaved(false), 2000);
    }
    setCouponSaving(false);
  };

  const logout = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  if (!loaded) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
      <Loader2 className="animate-spin text-gray-400" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 md:pb-0 md:mr-[70px]">

      {/* هيدر */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 flex items-center justify-between">
        <div className="w-9" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">الإعدادات</h1>
        <div className="w-9" />
      </header>

      <div className="px-4 pt-4 space-y-3">

        {/* ـ معلومات المطعم ـ */}
        <button
          onClick={() => setShowInfo(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <PenLine size={18} className="text-gray-600 dark:text-slate-400" />
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">معلومات المطعم</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">الاسم، الشعار، الواتساب، الموقع</p>
            </div>
          </div>
          <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
        </button>

        {/* المظهر */}
        <div className="w-full flex items-center justify-between px-4 py-4 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              {dark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-gray-600" />}
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">المظهر</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{dark ? 'الوضع الليلي' : 'الوضع النهاري'}</p>
            </div>
          </div>
          <button onClick={toggleDark} dir="ltr"
            className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${dark ? 'bg-[#f97316]' : 'bg-gray-300 dark:bg-slate-500'}`}>
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${dark ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        {/* ─ حساب الدخول — مخفي عن الكاشير: هذا حساب المالك الأساسي بالموقع ─ */}
        {!isCashier && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4" dir="rtl">
            <p className="font-bold text-gray-900 dark:text-slate-100 text-sm mb-3">حساب الدخول</p>
            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 mb-3">
              <p className="font-mono font-bold text-gray-800 dark:text-slate-200 text-sm" dir="ltr">{username}</p>
              <p className="text-[10px] text-gray-400">اسم المستخدم</p>
            </div>
            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 mb-3">
              <p className="font-mono text-gray-400 tracking-widest text-sm">••••••••</p>
              <p className="text-[10px] text-gray-400">كلمة المرور</p>
            </div>
            <button
              onClick={() => setShowChangePass(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 font-bold text-sm active:scale-95 transition-all"
            >
              <KeyRound size={15} />
              تغيير كلمة المرور
            </button>
          </div>
        )}

        {/* ─ حالة المطعم ─ */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 space-y-3">
          <p className="text-right font-bold text-gray-900 dark:text-slate-100 text-sm">حالة المطعم</p>
          <div className="flex gap-2">
            <button onClick={() => setShowSchedule(true)}
              className="relative flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl border bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 active:scale-95 transition-all">
              <Calendar size={18} className="text-gray-500 dark:text-slate-400" />
              <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">جدولة</span>
              {scheduleLocal?.auto && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-400" />}
            </button>
            <button onClick={handleToggleClosed}
              className={`flex-1 rounded-xl px-4 py-3 border flex items-center justify-between transition-all active:scale-[0.98] ${is_closed ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'}`}>
              <div dir="ltr" className={`relative w-10 h-5 rounded-full transition-colors duration-300 flex-shrink-0 ${is_closed ? 'bg-red-500' : 'bg-green-400'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${is_closed ? 'translate-x-0' : 'translate-x-5'}`} />
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${is_closed ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {is_closed ? '🔒 المطعم مغلق' : '✅ المطعم مفتوح'}
                </p>
                {is_closed && opens_at && (
                  <p className="text-xs text-gray-400 mt-0.5">سيفتح الساعة {opens_at}</p>
                )}
              </div>
            </button>
          </div>
          {toggleError && (
            <p className="text-red-500 text-xs text-center font-bold">{toggleError}</p>
          )}
        </div>

        {/* ─ رسوم التوصيل — مخفية عن الكاشير: مبلغ مالي حسّاس يضبطه المالك فقط ─ */}
        {!isCashier && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 space-y-3" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Truck size={18} className="text-gray-600 dark:text-slate-400" />
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">رسوم التوصيل</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">تُضاف تلقائياً لفاتورة الزبون عند اختيار &quot;توصيل&quot; من قائمة الطلب</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="0" inputMode="decimal" value={deliveryFeeInput}
                onChange={e => setDeliveryFeeInput(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]" />
              <span className="text-xs text-gray-400 flex-shrink-0">د.ع</span>
              <button onClick={saveDeliveryFee} disabled={feeSaving}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm active:scale-95 transition-all disabled:opacity-50 flex-shrink-0">
                {feeSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {feeSaved ? '✓ تم' : 'حفظ'}
              </button>
            </div>
          </div>
        )}

        {/* ─ الحد الأدنى للطلب — مخفي عن الكاشير: قيد مالي يضبطه المالك فقط ─ */}
        {!isCashier && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 space-y-3" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Wallet size={18} className="text-gray-600 dark:text-slate-400" />
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">الحد الأدنى للطلب</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">أقل قيمة مسموحة لطلب &quot;توصيل&quot; من قائمة الزبون — اتركه 0 لتعطيله</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="0" inputMode="decimal" value={minOrderInput}
                onChange={e => setMinOrderInput(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]" />
              <span className="text-xs text-gray-400 flex-shrink-0">د.ع</span>
              <button onClick={saveMinOrderAmount} disabled={minOrderSaving}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm active:scale-95 transition-all disabled:opacity-50 flex-shrink-0">
                {minOrderSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {minOrderSaved ? '✓ تم' : 'حفظ'}
              </button>
            </div>
          </div>
        )}

        {/* ─ كوبون الخصم — مخفي عن الكاشير: يضبطه المالك فقط. كوبون واحد لكل مطعم،
            خصم نسبة مئوية، يدخله الزبون بصفحة السلة عند إتمام الطلب. ─ */}
        {!isCashier && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 space-y-3" dir="rtl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Ticket size={18} className="text-gray-600 dark:text-slate-400" />
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800 dark:text-slate-200 text-sm">كوبون الخصم</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">كود يدخله الزبون بالسلة فيحصل على خصم بالنسبة المحددة</p>
                </div>
              </div>
              <button type="button" onClick={() => setCouponEnabledLocal(v => !v)} dir="ltr"
                className="w-11 h-6 rounded-full transition-all relative flex-shrink-0"
                style={{ backgroundColor: couponEnabledLocal ? '#22c55e' : '#d1d5db' }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ right: couponEnabledLocal ? '2px' : '22px' }} />
              </button>
            </div>
            <input type="text" value={couponCodeInput} onChange={e => setCouponCodeInput(e.target.value)}
              placeholder="كود الكوبون (مثال: SAVE10)" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#f97316]" />
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="100" inputMode="decimal" value={couponPctInput}
                onChange={e => setCouponPctInput(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#f97316]" />
              <span className="text-xs text-gray-400 flex-shrink-0">%</span>
              <button onClick={saveCoupon} disabled={couponSaving}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm active:scale-95 transition-all disabled:opacity-50 flex-shrink-0">
                {couponSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {couponSaved ? '✓ تم' : 'حفظ'}
              </button>
            </div>
          </div>
        )}

        {/* ─ الأرشيف والإحصاء — للكاشير: تظهر مقفلة بعلامة قفل بدل الاختفاء التام ─ */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => !isCashier && router.push('/admin/statistics')}
            disabled={isCashier}
            className={`flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 transition-all ${isCashier ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
            {isCashier ? <Lock size={16} className="text-gray-300 dark:text-slate-600" /> : <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">الإحصائيات</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <BarChart2 size={16} className="text-blue-500" />
              </div>
            </div>
          </button>
          <button onClick={() => !isCashier && router.push('/admin/archive')}
            disabled={isCashier}
            className={`flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 transition-all ${isCashier ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
            {isCashier ? <Lock size={16} className="text-gray-300 dark:text-slate-600" /> : <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">الأرشيف</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <Archive size={16} className="text-amber-500" />
              </div>
            </div>
          </button>
        </div>

        {/* ─ إدارة الموظفين والصلاحيات (RBAC) — للكاشير: تظهر مقفلة بعلامة قفل بدل الاختفاء التام ─ */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => !isCashier && router.push('/admin/settings/staff')}
            disabled={isCashier}
            className={`flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 transition-all ${isCashier ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
            {isCashier ? <Lock size={16} className="text-gray-300 dark:text-slate-600" /> : <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">الموظفين</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                <User size={16} className="text-purple-500" />
              </div>
            </div>
          </button>
          <button onClick={() => !isCashier && router.push('/admin/audit')}
            disabled={isCashier}
            className={`flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 transition-all ${isCashier ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
            {isCashier ? <Lock size={16} className="text-gray-300 dark:text-slate-600" /> : <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">سجل التدقيق</span>
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <KeyRound size={16} className="text-slate-500" />
              </div>
            </div>
          </button>
        </div>

        {/* ─ تبديل المستخدم — يظهر فقط لجلسة موظف حقيقية (دخل بكود+كلمة مرور من /login)،
            فهذه الحالة الوحيدة التي يعني فيها "التبديل" شيئاً فعلياً (تسجيل خروج حقيقي).
            شاشة اختيار الهوية للجلسة المشتركة أُزيلت نهائياً — لا فائدة من الزر لغيرها. ─ */}
        {activeStaff?.viaRealSession && (
          <button onClick={() => setConfirmSwitch(true)}
            className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 active:scale-95 transition-all">
            <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">تبديل المستخدم ({activeStaff?.displayName})</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                <Users size={16} className="text-purple-500" />
              </div>
            </div>
          </button>
        )}

        {/* ─ تسجيل الخروج ─ */}
        <button onClick={logout}
          className="w-full py-4 rounded-2xl bg-red-500 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
          <LogOut size={16} />
          تسجيل الخروج
        </button>

      </div>

      {confirmSwitch && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmSwitch(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-xs text-center" onClick={e => e.stopPropagation()} dir="rtl">
            <p className="font-bold text-gray-900 dark:text-slate-100 mb-1">تبديل المستخدم؟</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">سيتم تسجيل خروجك من هوية «{activeStaff?.displayName}» الحالية</p>
            <div className="flex gap-2">
              <button onClick={() => { setConfirmSwitch(false); switchUser(); }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-all">تبديل</button>
              <button onClick={() => setConfirmSwitch(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-bold text-sm active:scale-95 transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {!showInfo && !showChangePass && <AdminBottomNav />}

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
