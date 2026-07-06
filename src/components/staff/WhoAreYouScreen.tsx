'use client';
import { useState } from 'react';
import { Delete, ShieldCheck, User } from 'lucide-react';
import { useStaff } from '@/context/StaffContext';
import type { StaffMember } from '@/lib/staffApi';

const AVATAR_COLORS = ['#2563eb', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#0891b2', '#eab308'];

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function WhoAreYouScreen() {
  const { staffList, setOwnerActive, loginWithPin } = useStaff();
  const [selected, setSelected] = useState<StaffMember | 'owner' | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pick = (target: StaffMember | 'owner') => {
    setError(null);
    setPin('');
    setLocked(false);
    if (target === 'owner') { setOwnerActive(); return; }
    setSelected(target);
  };

  const backspace = () => { if (!submitting) setPin(prev => prev.slice(0, -1)); };

  const submit = async (finalPin: string) => {
    setSubmitting(true);
    setError(null);
    const res = await loginWithPin(finalPin);
    setSubmitting(false);
    if (!res.ok) {
      if (res.status === 423) {
        setLocked(true);
        setError('تم قفل الحساب مؤقتاً بعد محاولات خاطئة متكررة — تواصل مع المالك');
      } else {
        setError('رمز غير صحيح، حاول مجدداً');
      }
      setPin('');
      return;
    }
    setSelected(null);
    setPin('');
  };

  // إرسال تلقائي عند اكتمال 4 أرقام (الحد الأدنى للـ PIN حسب الخطة)
  const handlePinChange = (next: string) => {
    setPin(next);
    if (next.length === 4 && !submitting && !locked) submit(next);
  };

  if (selected && selected !== 'owner') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6" dir="rtl">
        <button onClick={() => { setSelected(null); setPin(''); setError(null); }} className="absolute top-6 right-6 text-slate-400 text-sm font-bold">
          رجوع
        </button>
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-black mb-4"
          style={{ backgroundColor: colorFor(selected.id) }}>
          {selected.display_name.slice(0, 1)}
        </div>
        <p className="text-white font-bold text-lg mb-1">{selected.display_name}</p>
        <p className="text-slate-400 text-xs mb-6">أدخل رمز الدخول (PIN)</p>

        <div className="flex gap-3 mb-8" dir="ltr">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <span key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${i < pin.length ? 'bg-[#2563eb] border-[#2563eb]' : 'border-slate-600'}`} />
          ))}
        </div>

        {error && <p className="text-red-400 text-sm font-bold mb-4 text-center max-w-xs">{error}</p>}
        {submitting && <div className="w-8 h-8 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin mb-4" />}

        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button key={d} onClick={() => handlePinChange(pin.length < 6 ? pin + d : pin)}
              disabled={submitting || locked}
              className="h-16 rounded-2xl bg-slate-800 text-white text-2xl font-bold active:scale-95 transition-all disabled:opacity-40">
              {d}
            </button>
          ))}
          <div />
          <button onClick={() => handlePinChange(pin.length < 6 ? pin + '0' : pin)} disabled={submitting || locked}
            className="h-16 rounded-2xl bg-slate-800 text-white text-2xl font-bold active:scale-95 transition-all disabled:opacity-40">
            0
          </button>
          <button onClick={backspace} disabled={submitting || locked}
            className="h-16 rounded-2xl bg-slate-800 text-slate-300 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40">
            <Delete size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="flex items-center gap-2 mb-8">
        <ShieldCheck size={20} className="text-[#2563eb]" />
        <p className="text-white font-black text-xl">من أنت؟</p>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-4">
        {/* المالك — دائماً متاح، بدون PIN لأن جلسة Supabase نفسها إثبات الهوية */}
        <button onClick={() => pick('owner')} className="flex flex-col items-center gap-2 active:scale-95 transition-all">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white bg-gradient-to-br from-[#2563eb] to-[#1e40af]">
            <User size={26} />
          </div>
          <span className="text-slate-200 text-xs font-bold">المالك</span>
        </button>

        {staffList.map(s => (
          <button key={s.id} onClick={() => pick(s)} className="flex flex-col items-center gap-2 active:scale-95 transition-all">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-black" style={{ backgroundColor: colorFor(s.id) }}>
              {s.display_name.slice(0, 1)}
            </div>
            <span className="text-slate-200 text-xs font-bold text-center leading-tight">{s.display_name}</span>
          </button>
        ))}
      </div>

      <p className="text-slate-500 text-xs text-center max-w-xs mt-4">اختر اسمك ثم أدخل رمزك الخاص (PIN) للدخول، أو اختر «المالك» للدخول بكامل الصلاحيات</p>
    </div>
  );
}
