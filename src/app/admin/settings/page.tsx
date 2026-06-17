'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSettings, type DaySchedule, type WeekSchedule } from '@/context/SettingsContext';
import { Save, Palette, Type, Image as ImageIcon, Loader2, Moon, ShoppingBag, MapPin, MessageCircle, X, LogOut, Clock, Calendar, BarChart2, Archive, ChevronLeft, PenLine } from 'lucide-react';
import { AdminBottomNav } from '@/components/BottomNav';

/* ─── جدولة الدوام ─── */
const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DEFAULT_WEEK: WeekSchedule = {
  auto: false,
  days: Object.fromEntries([0,1,2,3,4,5,6].map(d => [String(d), { enabled: d < 5, open: '10:00', close: '23:00' } as DaySchedule])),
};

function ScheduleModal({ schedule: initSchedule, settingsId, onSaved, onClose }: {
  schedule: WeekSchedule | null;
  settingsId: string;
  onSaved: (s: WeekSchedule) => void;
  onClose: () => void;
}) {
  const [sched,  setSched]  = useState<WeekSchedule>(initSchedule ?? DEFAULT_WEEK);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSched(initSchedule ?? DEFAULT_WEEK); }, [initSchedule]);

  const updateDay = (key: string, field: keyof DaySchedule, val: boolean | string) =>
    setSched(prev => ({ ...prev, days: { ...prev.days, [key]: { ...prev.days[key], [field]: val } } }));

  const handleSave = async () => {
    if (!settingsId) return;
    setSaving(true);
    await supabase.from('restaurant_settings').update({ schedule: sched }).eq('id', settingsId);
    onSaved(sched);
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
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
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

          {/* معاينة مصغرة */}
          <Field label="معاينة">
            <div className="bg-gray-50 dark:bg-slate-950 p-3 rounded-2xl border border-gray-100 dark:border-slate-800">
              <div className="bg-white dark:bg-slate-900 px-3 h-11 flex items-center justify-between rounded-xl mb-2.5 shadow-sm">
                <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                  <Moon size={11} className="text-gray-400" />
                </div>
                <p className="text-xs font-black truncate max-w-[110px]">{form.name || 'اسم المطعم'}</p>
                {form.logo
                  ? <img src={form.logo} alt="" className="h-7 w-7 object-cover rounded-lg" />
                  : <div className="w-7 h-7 rounded-lg text-white flex items-center justify-center bg-orange-400"><ImageIcon size={12} /></div>
                }
              </div>
              <div className="flex gap-2 flex-row-reverse">
                <span className="px-3 py-1 rounded-lg text-[10px] font-black text-white bg-orange-400">مختار</span>
                <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-white dark:bg-slate-800 text-gray-400">قسم آخر</span>
              </div>
            </div>
          </Field>

          <div className="pb-2" />
        </div>
      </div>
    </div>
  );
}

/* ─── الصفحة الرئيسية ─── */
export default function SettingsPage() {
  const router = useRouter();
  const { is_closed, opens_at, id: settingsId, schedule: ctxSchedule, refreshSettings, loaded } = useSettings();

  const [scheduleLocal,    setScheduleLocal]    = useState<WeekSchedule | null>(null);
  const [showClosedModal,  setShowClosedModal]  = useState(false);
  const [opensAtInput,     setOpensAtInput]     = useState('');
  const [showSchedule,     setShowSchedule]     = useState(false);
  const [showInfo,         setShowInfo]         = useState(false);
  const [tick,             setTick]             = useState(0);
  const isClosedRef = useRef(is_closed);
  useEffect(() => { isClosedRef.current = is_closed; }, [is_closed]);
  useEffect(() => { setScheduleLocal(ctxSchedule); }, [ctxSchedule]);
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
      shouldBeOpen = nowMins >= oh*60+om && nowMins < ch*60+cm;
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
      await supabase.from('restaurant_settings').update({ is_closed: false, opens_at: null }).eq('id', settingsId);
      await refreshSettings();
    } else {
      setOpensAtInput('');
      setShowClosedModal(true);
    }
  };
  const confirmClose = async () => {
    await supabase.from('restaurant_settings').update({ is_closed: true, opens_at: opensAtInput || null }).eq('id', settingsId);
    setShowClosedModal(false);
    await refreshSettings();
  };
  const logout = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  if (!loaded) return (
    <div className="min-h-screen bg-amber-50 dark:bg-slate-900 flex items-center justify-center">
      <Loader2 className="animate-spin text-gray-400" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-slate-900 pb-24">

      {/* هيدر */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 flex items-center justify-between">
        <div className="w-9" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">مطعمي</h1>
        <div className="w-9" />
      </header>

      <div className="px-4 pt-4 space-y-3">

        {/* ─ معلومات المطعم ─ */}
        <button
          onClick={() => setShowInfo(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-blue-600 rounded-2xl active:scale-[0.98] transition-all"
        >
          <ChevronLeft size={16} className="text-blue-300" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-bold text-white text-sm">معلومات المطعم</p>
              <p className="text-xs text-blue-200 mt-0.5">الاسم، الشعار، الواتساب، الموقع</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
              <PenLine size={18} className="text-white" />
            </div>
          </div>
        </button>

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
        </div>

        {/* ─ الأرشيف والإحصاء ─ */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/admin/statistics')}
            className="flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 active:scale-95 transition-all">
            <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">الإحصائيات</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <BarChart2 size={16} className="text-blue-500" />
              </div>
            </div>
          </button>
          <button onClick={() => router.push('/admin/archive')}
            className="flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 active:scale-95 transition-all">
            <ChevronLeft size={16} className="text-gray-300 dark:text-slate-600" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800 dark:text-slate-200 text-sm">الأرشيف</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <Archive size={16} className="text-amber-500" />
              </div>
            </div>
          </button>
        </div>

        {/* ─ تسجيل الخروج ─ */}
        <button onClick={logout}
          className="w-full py-4 rounded-2xl bg-red-500 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
          <LogOut size={16} />
          تسجيل الخروج
        </button>

      </div>

      {!showInfo && <AdminBottomNav />}

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
