'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Hourglass, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { mashiRoundedFont, MASHI_FONT } from '@/app/home/brand';
import { getPendingSignup, setPendingSignup, clearPendingSignup } from '@/lib/pendingSignup';

type Status = 'pending' | 'approved' | 'rejected';

const inputClass =
  'w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[#1d1d1f] text-sm outline-none focus:border-[#15803D]/50 placeholder:text-[#86868b] transition-colors';

function PulsingHourglass({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <motion.span
        className="absolute inset-0 rounded-full bg-[#15803D]/10"
        animate={reduceMotion ? { opacity: 0.5 } : { scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
        transition={reduceMotion ? undefined : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="relative w-14 h-14 rounded-full bg-[#15803D]/10 flex items-center justify-center"
        animate={reduceMotion ? {} : { rotate: 360 }}
        transition={reduceMotion ? undefined : { duration: 3, repeat: Infinity, ease: 'linear' }}
      >
        <Hourglass className="w-7 h-7 text-[#15803D]" />
      </motion.div>
    </div>
  );
}

export default function TrackSignupPage() {
  const reduceMotion = useReducedMotion();

  const [phone, setPhone]       = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [status, setStatus]     = useState<Status | null>(null);
  const [hasMarker, setHasMarker] = useState(true);

  const lookup = async (p: string, u: string) => {
    setLoading(true);
    setError('');

    const params = new URLSearchParams({ phone: p, username: u });
    const res = await fetch(`/api/signup-requests/status?${params.toString()}`).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setLoading(false);

    if (res?.status === 200 && json?.status) {
      setStatus(json.status);
      if (json.status === 'pending') {
        setPendingSignup({ phone: p, username: u });
      } else {
        clearPendingSignup();
      }
      return;
    }

    setError(json?.error || 'لم يتم العثور على طلب مطابق');
  };

  useEffect(() => {
    const pending = getPendingSignup();
    if (!pending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only check for a localStorage marker on mount, no external system to defer to
      setHasMarker(false);
      return;
    }
    setPhone(pending.phone);
    setUsername(pending.username);
    lookup(pending.phone, pending.username);
  }, []);

  const submitManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !username.trim() || loading) return;
    lookup(phone.trim(), username.trim().toLowerCase());
  };

  return (
    <div className={`min-h-screen bg-white text-[#1d1d1f] ${mashiRoundedFont.variable}`} dir="rtl">
      <header className="sticky top-0 z-40 backdrop-blur-2xl backdrop-saturate-150 bg-[#1d1d1f]/80 border-b border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] px-4 py-3.5">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <Link href="/" className="text-xl font-extrabold text-[#4ADE80]" style={MASHI_FONT}>
            ماشي
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-white/80 text-sm font-bold active:scale-95 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
            الرجوع للرئيسية
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:pt-20 sm:pb-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 20%, rgba(52,199,89,0.06) 0%, rgba(255,255,255,0) 70%), linear-gradient(180deg, rgba(52,199,89,0.04) 0%, rgba(255,255,255,0) 40%)',
          }}
        />
        <div className="relative max-w-md mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-3xl sm:text-4xl font-extrabold text-center leading-tight text-[#1d1d1f]"
            style={MASHI_FONT}
          >
            متابعة طلب الحساب
          </motion.h1>

          {!hasMarker && !status && (
            <motion.form
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              onSubmit={submitManualLookup}
              className="mt-8 bg-white border border-black/5 shadow-[0_2px_30px_rgba(0,0,0,0.06)] rounded-3xl p-6 flex flex-col gap-4"
            >
              <p className="text-sm text-[#6e6e73] text-center leading-relaxed">
                ما لقينا طلباً مسجّلاً على هذا الجهاز. عبّي رقم هاتفك واسم المستخدم اللي استخدمتهم عند التقديم.
              </p>
              <div>
                <label className="block text-sm font-bold text-[#1d1d1f] mb-1.5">رقم الهاتف</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value.slice(0, 30))}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                  inputMode="tel"
                  className={`${inputClass} font-mono text-left`}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#1d1d1f] mb-1.5">اسم المستخدم</label>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value.slice(0, 24).toLowerCase())}
                  placeholder="mashi_restaurant"
                  dir="ltr"
                  className={`${inputClass} font-mono text-left`}
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full py-4 rounded-2xl bg-[#1d1d1f] text-white font-black text-base active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'جاري البحث...' : 'تابع حالة طلبي'}
              </button>
            </motion.form>
          )}

          {hasMarker && loading && !status && (
            <div className="mt-8 flex justify-center">
              <Loader2 className="w-6 h-6 text-[#15803D] animate-spin" />
            </div>
          )}

          {hasMarker && error && !status && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-4 text-red-600 dark:text-red-400 text-sm text-center"
            >
              {error}
            </motion.div>
          )}

          {status === 'pending' && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="mt-8 bg-white border border-black/5 shadow-[0_2px_30px_rgba(0,0,0,0.06)] rounded-3xl p-8 flex flex-col items-center text-center gap-4"
            >
              <PulsingHourglass reduceMotion={reduceMotion} />
              <p className="text-lg font-extrabold text-[#1d1d1f]" style={MASHI_FONT}>
                طلبك ما زال قيد المراجعة
              </p>
              <p className="text-sm text-[#6e6e73] leading-relaxed">
                فريقنا يراجع طلبك حالياً وبيوافق عليه بأسرع وقت ممكن. ارجع لهذي الصفحة بأي وقت لمتابعة الحالة.
              </p>
            </motion.div>
          )}

          {status === 'approved' && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="mt-8 bg-white border border-black/5 shadow-[0_2px_30px_rgba(0,0,0,0.06)] rounded-3xl p-8 flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-[#15803D]/10 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-[#15803D]" />
              </div>
              <p className="text-lg font-extrabold text-[#1d1d1f]" style={MASHI_FONT}>
                تمت الموافقة على طلبك 🎉
              </p>
              <p className="text-sm text-[#6e6e73] leading-relaxed">
                حسابك جاهز الآن، تقدر تسجل الدخول مباشرة وتبدأ بإدارة مطعمك.
              </p>
              <Link
                href="/login"
                className="mt-2 w-full py-3.5 rounded-2xl bg-[#1d1d1f] text-white font-black text-sm text-center active:scale-95 transition-all"
              >
                تسجيل الدخول
              </Link>
            </motion.div>
          )}

          {status === 'rejected' && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="mt-8 bg-white border border-black/5 shadow-[0_2px_30px_rgba(0,0,0,0.06)] rounded-3xl p-8 flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle className="w-9 h-9 text-red-500" />
              </div>
              <p className="text-lg font-extrabold text-[#1d1d1f]" style={MASHI_FONT}>
                للأسف، لم تتم الموافقة على طلبك
              </p>
              <p className="text-sm text-[#6e6e73] leading-relaxed">
                نعتذر عن ذلك. تقدر تعيد تقديم طلب جديد بمعلومات مختلفة.
              </p>
              <Link
                href="/signup"
                className="mt-2 w-full py-3.5 rounded-2xl bg-[#1d1d1f] text-white font-black text-sm text-center active:scale-95 transition-all"
              >
                تقديم طلب جديد
              </Link>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
