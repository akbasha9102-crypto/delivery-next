'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSettings, type DaySchedule, type WeekSchedule } from '@/context/SettingsContext';
import { Save, Palette, Type, Image as ImageIcon, Loader2, Moon, ShoppingBag, MapPin, MessageCircle, X, LogOut, Clock, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
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

export default function BrandingPage() {
  const router = useRouter();
  const { restaurant_name, primary_color, logo_url, whatsapp_number, location_url, refreshSettings, loaded,
          is_closed, opens_at, id: settingsId, schedule: ctxSchedule } = useSettings();

  /* ── حالة المطعم ── */
  const [scheduleLocal,   setScheduleLocal]   = useState<WeekSchedule | null>(null);
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [opensAtInput,    setOpensAtInput]    = useState('');
  const [showSchedule,    setShowSchedule]    = useState(false);
  const [tick,            setTick]            = useState(0);
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

  /* ── إعدادات الهوية ── */
  const [form, setForm] = useState({
    name: '',
    color: '#000000',
    logo: '',
    whatsapp: '',
    location: ''
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', error: false });

  useEffect(() => {
    if (loaded) {
      setForm({
        name: restaurant_name || '',
        color: primary_color || '#000000',
        logo: logo_url || '',
        whatsapp: whatsapp_number || '',
        location: location_url || ''
      });
    }
  }, [loaded, restaurant_name, primary_color, logo_url, whatsapp_number, location_url]);

  const handleSave = async () => {
    setSaving(true);
    setMsg({ text: '', error: false });

    const { error } = await supabase
      .from('restaurant_settings')
      .update({
        restaurant_name: form.name,
        primary_color: form.color,
        logo_url: form.logo,
        whatsapp_number: form.whatsapp || null,
        location_url: form.location || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', (await supabase.from('restaurant_settings').select('id').limit(1)).data?.[0]?.id);

    if (error) {
      setMsg({ text: 'تعذّر حفظ الإعدادات', error: true });
    } else {
      await refreshSettings();
      setMsg({ text: '✓ تم حفظ التعديلات بنجاح', error: false });
    }
    setSaving(false);
  };

  if (!loaded) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 pb-32">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors active:scale-95">
            <X size={20} />
          </button>
          <h1 className="text-2xl font-black text-right">الإعدادات</h1>
          <div className="w-10" />
        </div>

        {/* ── حالة المطعم ── */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-xl p-6 mb-8">
          <p className="text-right font-black text-lg mb-4">حالة المطعم</p>

          <div className="flex gap-3 items-stretch">
            {/* زر الفتح / الإغلاق */}
            <button onClick={handleToggleClosed}
              className={`flex-1 rounded-2xl px-4 py-4 border flex items-center justify-between transition-all active:scale-[0.98] ${is_closed ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'}`}>
              <div dir="ltr" className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${is_closed ? 'bg-red-500' : 'bg-green-400'}`}>
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${is_closed ? 'translate-x-0' : 'translate-x-6'}`} />
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${is_closed ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {is_closed ? '🔒 المطعم مغلق' : '✅ المطعم مفتوح'}
                </p>
                {is_closed && opens_at && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">سيفتح الساعة {opens_at}</p>
                )}
              </div>
            </button>

            {/* زر الجدولة */}
            <button onClick={() => setShowSchedule(true)}
              className="relative flex flex-col items-center justify-center gap-1.5 px-4 rounded-2xl border bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 active:scale-95 transition-all">
              <Calendar size={20} className="text-gray-500 dark:text-slate-400" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 whitespace-nowrap">جدولة</span>
              {scheduleLocal?.auto && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-8 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-xl">
            
            <div className="space-y-2 text-right">
              <label className="flex items-center justify-end gap-2 text-sm font-black opacity-50">
                اسم المطعم <Type size={16}/>
              </label>
              <input 
                type="text" 
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-black text-right font-bold"
                placeholder="أدخل اسم المطعم هنا"
              />
            </div>

            <div className="space-y-4 text-right">
              <label className="flex items-center justify-end gap-2 text-sm font-black opacity-50">
                اللون الأساسي <Palette size={16}/>
              </label>
              <div className="flex flex-col items-center gap-4">
                 <div 
                   className="w-full h-32 rounded-[2rem] shadow-inner flex items-center justify-center cursor-pointer relative overflow-hidden group border-4 border-gray-50 dark:border-slate-800"
                   style={{ backgroundColor: form.color }}
                 >
                    <input 
                      type="color" 
                      value={form.color}
                      onChange={e => setForm({...form, color: e.target.value})}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-white font-mono text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      {form.color.toUpperCase()}
                    </div>
                 </div>
                 <p className="text-[10px] text-gray-400 font-bold">انقر على المربع أعلاه لتغيير اللون</p>
              </div>
            </div>

            <div className="space-y-2 text-right">
              <label className="flex items-center justify-end gap-2 text-sm font-black opacity-50">
                رابط الشعار (URL) <ImageIcon size={16}/>
              </label>
              <input
                type="text"
                value={form.logo}
                onChange={e => setForm({...form, logo: e.target.value})}
                className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-black text-left font-medium"
                placeholder="https://image-url.com/logo.png"
              />
            </div>

            <div className="space-y-2 text-right">
              <label className="flex items-center justify-end gap-2 text-sm font-black opacity-50">
                رقم الواتساب <MessageCircle size={16}/>
              </label>
              <input
                type="text"
                value={form.whatsapp}
                onChange={e => setForm({...form, whatsapp: e.target.value})}
                className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-black text-left font-medium"
                placeholder="9647801234567"
                dir="ltr"
              />
              <p className="text-xs text-gray-400 font-medium">أدخل الرقم مع رمز البلد بدون + مثال: 9647801234567</p>
            </div>

            <div className="space-y-2 text-right">
              <label className="flex items-center justify-end gap-2 text-sm font-black opacity-50">
                رابط الموقع (خرائط) <MapPin size={16}/>
              </label>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm({...form, location: e.target.value})}
                className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-black text-left font-medium"
                placeholder="https://maps.google.com/..."
                dir="ltr"
              />
              <p className="text-xs text-gray-400 font-medium">افتح موقع المطعم في خرائط قوقل ثم انسخ الرابط</p>
            </div>

            <button 
              onClick={handleSave}
              disabled={saving}
              className="w-full py-5 bg-black text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save size={20}/>}
              حفظ التعديلات
            </button>

            {msg.text && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center font-black ${msg.error ? 'text-red-500' : 'text-green-500'}`}>
                {msg.text}
              </motion.p>
            )}
          </div>

          {/* Preview */}
          <div className="space-y-4">
             <p className="text-right text-xs font-black opacity-30 uppercase tracking-widest px-2">معاينة مباشرة (شاشة الجوال)</p>
             <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-[3rem] border-8 border-gray-200 dark:border-slate-800 shadow-2xl min-h-[500px] flex flex-col overflow-hidden relative">
                
                {/* Simulated Header */}
                <div className="bg-white dark:bg-slate-900 px-4 h-16 flex items-center justify-between shadow-sm rounded-t-[1.5rem]">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                    <Moon size={14} className="text-gray-400"/>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black truncate max-w-[120px]">{form.name || 'اسم المطعم'}</p>
                    <div className="w-6 h-0.5 mx-auto rounded-full opacity-20" style={{ backgroundColor: form.color }}/>
                  </div>
                  {form.logo ? (
                    <img src={form.logo} alt="Logo" className="h-10 w-10 object-cover rounded-lg border border-gray-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: form.color }}>
                      <ImageIcon size={16} />
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {/* Simulated Category Pills */}
                  <div className="flex gap-2 overflow-x-hidden flex-row-reverse">
                    <div className="px-4 py-2 rounded-xl text-[10px] font-black text-white" style={{ backgroundColor: form.color }}>القسم المختار</div>
                    <div className="px-4 py-2 rounded-xl text-[10px] font-black bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-400">قسم آخر</div>
                    <div className="px-4 py-2 rounded-xl text-[10px] font-black bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-400">قسم ثالث</div>
                  </div>

                  {/* Simulated Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-3 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col gap-2">
                    <div className="h-32 bg-gray-50 dark:bg-slate-800 rounded-[1.5rem] flex items-center justify-center text-gray-200">
                      <ImageIcon size={32} />
                    </div>
                    <div className="flex justify-between items-center flex-row-reverse px-1">
                      <div className="text-right">
                        <p className="font-black text-sm">اسم المنتج</p>
                        <p className="text-xs font-black" style={{ color: form.color }}>15,000 د.ع</p>
                      </div>
                      <div className="h-8 px-4 rounded-xl text-white text-[10px] font-black flex items-center justify-center" style={{ backgroundColor: form.color }}>
                        إضافة
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Bar Info */}
                <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center justify-between flex-row-reverse">
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: form.color }}>
                       <ShoppingBag size={14} />
                     </div>
                     <p className="text-[10px] font-black">السلة</p>
                   </div>
                   <div className="px-4 py-2 rounded-xl text-white text-[10px] font-black" style={{ backgroundColor: form.color }}>إتمام الطلب</div>
                </div>
             </div>
             <p className="text-center text-[10px] text-gray-400 font-medium">الشعار يظهر دائماً في الجهة اليسرى للهيدر</p>
          </div>
        </div>
        {/* ── تسجيل الخروج ── */}
        <div className="mt-8">
          <button onClick={logout}
            className="w-full py-4 rounded-2xl bg-red-500 text-white font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg">
            <LogOut size={18} />
            تسجيل الخروج
          </button>
        </div>

      </motion.div>

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
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">حدد وقت الفتح (اختياري)</p>
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

      <AdminBottomNav />
    </div>
  );
}
