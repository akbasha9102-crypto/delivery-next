'use client';
import { useState } from 'react';
import { X, CheckCircle2, Loader2 } from 'lucide-react';

export default function SignupRequestModal({ onClose }: { onClose: () => void }) {
  const [fullName, setFullName]             = useState('');
  const [phone, setPhone]                   = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [sending, setSending]               = useState(false);
  const [error, setError]                   = useState<{ text: string; soft: boolean } | null>(null);
  const [success, setSuccess]               = useState(false);

  const isEmpty = !fullName.trim() || !phone.trim() || !restaurantName.trim();

  const submit = async () => {
    if (isEmpty || sending) return;
    setSending(true);
    setError(null);

    const res = await fetch('/api/signup-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: fullName.trim(),
        phone: phone.trim(),
        restaurantName: restaurantName.trim(),
      }),
    }).catch(() => null);

    const json = await res?.json().catch(() => ({}));
    setSending(false);

    if (res?.status === 201) {
      setSuccess(true);
      setTimeout(onClose, 2000);
      return;
    }

    if (res?.status === 409) {
      setError({ text: json?.error || 'لديك طلب قيد المراجعة بالفعل، الرجاء الانتظار قليلاً', soft: true });
      return;
    }

    setError({ text: json?.error || 'حدث خطأ، الرجاء المحاولة لاحقاً', soft: false });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-[#13132b] rounded-3xl w-full max-w-md p-5 border border-white/10"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {success ? (
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-400" />
            </div>
            <p className="text-white font-black text-base leading-relaxed">
              تم استلام طلبك، سيتواصل معك فريق ماشي قريباً
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 rounded-xl bg-slate-700/50 text-slate-300 font-bold text-sm active:scale-95 transition-all"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-black text-sm">إنشاء حساب مطعم جديد</p>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all active:scale-90"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value.slice(0, 120))}
                placeholder="الاسم الكامل"
                dir="rtl"
                className="w-full bg-[#0d0d20] border border-slate-700/50 rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-violet-500/50 placeholder:text-slate-600"
              />
              <input
                value={phone}
                onChange={e => setPhone(e.target.value.slice(0, 30))}
                placeholder="رقم الهاتف"
                dir="ltr"
                inputMode="tel"
                className="w-full bg-[#0d0d20] border border-slate-700/50 rounded-xl px-4 py-3 text-slate-100 text-sm font-mono outline-none focus:border-violet-500/50 placeholder:text-slate-600 text-left"
              />
              <input
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value.slice(0, 120))}
                placeholder="اسم المطعم"
                dir="rtl"
                className="w-full bg-[#0d0d20] border border-slate-700/50 rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-violet-500/50 placeholder:text-slate-600"
              />

              {error && (
                <p className={`text-xs font-bold text-center ${error.soft ? 'text-amber-400' : 'text-red-400'}`}>
                  {error.text}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-slate-700/50 text-slate-300 font-bold text-sm active:scale-95 transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={submit}
                  disabled={sending || isEmpty}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {sending ? 'جاري الإرسال...' : 'إرسال الطلب'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
