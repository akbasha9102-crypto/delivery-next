'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Hourglass, Loader2 } from 'lucide-react';
import { mashiRoundedFont, MASHI_FONT } from '@/app/home/brand';
import { setPendingSignup } from '@/lib/pendingSignup';



const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-[#1d1d1f] mb-1.5">{label}</label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-bold text-red-600">{error}</p>
      ) : helper ? (
        <p className="mt-1.5 text-xs text-[#6e6e73]">{helper}</p>
      ) : null}
    </div>
  );
}

const inputClass =
  'w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[#1d1d1f] text-sm outline-none focus:border-[#15803D]/50 placeholder:text-[#86868b] transition-colors';

export default function SignupPage() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();

  const [fullName, setFullName]             = useState('');
  const [phone, setPhone]                   = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [username, setUsername]             = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched]               = useState(false);
  const [sending, setSending]               = useState(false);
  const [serverError, setServerError]       = useState('');
  const [success, setSuccess]               = useState(false);

  const usernameError =
    touched && username && !USERNAME_REGEX.test(username)
      ? 'اسم المستخدم يجب أن يكون 3-24 حرفاً إنجليزياً صغيراً أو رقماً أو "_" فقط'
      : null;

  const passwordError =
    touched && password && password.length < 8 ? 'كلمة السر يجب أن تكون 8 أحرف على الأقل' : null;

  const confirmError =
    touched && confirmPassword && confirmPassword !== password ? 'كلمتا السر غير متطابقتين' : null;

  const isValid =
    fullName.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    restaurantName.trim().length >= 2 &&
    USERNAME_REGEX.test(username) &&
    password.length >= 8 &&
    confirmPassword === password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError('');

    if (!isValid || sending) return;

    setSending(true);

    const res = await fetch('/api/signup-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: fullName.trim(),
        phone: phone.trim(),
        restaurantName: restaurantName.trim(),
        username: username.trim().toLowerCase(),
        password,
      }),
    }).catch(() => null);

    const json = await res?.json().catch(() => ({}));
    setSending(false);

    if (res?.status === 201) {
      setPendingSignup({ phone: phone.trim(), username: username.trim().toLowerCase() });
      setSuccess(true);
      return;
    }

    setServerError(json?.error || 'حدث خطأ، الرجاء المحاولة لاحقاً');
  };

  // مؤقّت إعادة التوجيه مربوط بدورة حياة المكوّن: لو المستخدم غادر الصفحة
  // (مثلاً ضغط "الرجوع للرئيسية") قبل انتهاء الـ 2.5 ثانية، cleanup يلغي
  // المؤقّت فلا يُعاد توجيهه قسرياً عن الصفحة التي اختارها بنفسه.
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      router.push('/track-signup');
    }, 2500);
    return () => clearTimeout(timer);
  }, [success, router]);

  return (
    <div className={`min-h-screen bg-white text-[#1d1d1f] ${mashiRoundedFont.variable}`} dir="rtl">
      {/* ── Nav ── */}
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

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:pt-20 sm:pb-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 20%, rgba(52,199,89,0.06) 0%, rgba(255,255,255,0) 70%), linear-gradient(180deg, rgba(52,199,89,0.04) 0%, rgba(255,255,255,0) 40%)',
          }}
        />
        <div className="relative max-w-md mx-auto">
          {success ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="bg-white border border-black/5 shadow-[0_2px_30px_rgba(0,0,0,0.06)] rounded-3xl p-8 flex flex-col items-center text-center gap-4"
            >
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
              <p className="text-lg font-extrabold text-[#1d1d1f]" style={MASHI_FONT}>
                طلبك بانتظار الموافقة
              </p>
              <p className="text-sm text-[#6e6e73] leading-relaxed">
                استلمنا طلبك بنجاح، وفريق ماشي بيراجعه ويوافق عليه بأسرع وقت ممكن. رح ننقلك لصفحة متابعة الطلب.
              </p>
              <Link
                href="/"
                className="mt-2 w-full py-3.5 rounded-2xl border border-black/10 text-[#1d1d1f] font-bold text-sm text-center active:scale-95 transition-all"
              >
                الرجوع للرئيسية
              </Link>
            </motion.div>
          ) : (
            <>
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="text-3xl sm:text-4xl font-extrabold text-center leading-tight text-[#1d1d1f]"
                style={MASHI_FONT}
              >
                إنشاء حساب <span className="text-[#15803D]">ماشي</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                className="mt-3 text-center text-sm text-[#6e6e73] leading-relaxed"
              >
                عبّي بياناتك وبيانات مطعمك، وفريقنا بيراجع طلبك ويفعّل حسابك بأسرع وقت.
              </motion.p>

              <motion.form
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                onSubmit={submit}
                className="mt-8 bg-white border border-black/5 shadow-[0_2px_30px_rgba(0,0,0,0.06)] rounded-3xl p-6 flex flex-col gap-4"
              >
                <Field label="الاسم الكامل" helper="اسمك الثلاثي كما تحب نناديك.">
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value.slice(0, 120))}
                    placeholder="مثال: أحمد محمد"
                    dir="rtl"
                    className={inputClass}
                  />
                </Field>

                <Field label="رقم الهاتف" helper="بنتواصل معك عليه لتأكيد طلبك.">
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value.slice(0, 30))}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    inputMode="tel"
                    className={`${inputClass} font-mono text-left`}
                  />
                </Field>

                <Field label="اسم المطعم" helper="اسم مطعمك كما يظهر لزبائنك.">
                  <input
                    value={restaurantName}
                    onChange={e => setRestaurantName(e.target.value.slice(0, 120))}
                    placeholder="مثال: مطعم الديرة"
                    dir="rtl"
                    className={inputClass}
                  />
                </Field>

                <Field
                  label="اسم المستخدم"
                  helper="3-24 حرفاً إنجليزياً صغيراً أو أرقاماً أو (_) فقط، وبيكون رابط دخولك."
                  error={usernameError}
                >
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value.slice(0, 24).toLowerCase())}
                    placeholder="mashi_restaurant"
                    dir="ltr"
                    className={`${inputClass} font-mono text-left`}
                  />
                </Field>

                <Field label="كلمة السر" helper="8 أحرف على الأقل." error={passwordError}>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value.slice(0, 72))}
                    placeholder="••••••••"
                    dir="ltr"
                    className={`${inputClass} text-left`}
                  />
                </Field>

                <Field label="تأكيد كلمة السر" error={confirmError}>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value.slice(0, 72))}
                    placeholder="••••••••"
                    dir="ltr"
                    className={`${inputClass} text-left`}
                  />
                </Field>

                {serverError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm text-center">
                    {serverError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="mt-2 w-full py-4 rounded-2xl bg-[#1d1d1f] text-white font-black text-base active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {sending ? 'جاري الإرسال...' : 'إرسال الطلب'}
                </button>
              </motion.form>

              <p className="mt-6 text-center text-sm text-[#6e6e73]">
                قدّمت طلباً من قبل؟{' '}
                <Link href="/track-signup" className="font-bold text-[#15803D]">
                  تابع حالة طلبك
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
