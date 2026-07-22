'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Truck, PackageSearch, Smartphone, Menu, X, BookOpen, ChevronDown } from 'lucide-react';
import SignupRequestModal from './SignupRequestModal';
import { Baloo_Bhaijaan_2 } from 'next/font/google';

const mashiRoundedFont = Baloo_Bhaijaan_2({
  subsets: ['arabic', 'latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--font-mashi-rounded',
});

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'لوحة تحكم لكل مطعم',
    desc: 'تابع طلباتك ومبيعاتك لحظة بلحظة.',
  },
  {
    icon: Truck,
    title: 'تتبع السائقين',
    desc: 'اعرف مكان كل طلب وهو في الطريق.',
  },
  {
    icon: PackageSearch,
    title: 'إدارة المخزون',
    desc: 'لا تفاجأ بنقص المكوّنات وأنت في ذروة العمل.',
  },
  {
    icon: Smartphone,
    title: 'تجربة طلب سلسة',
    desc: 'زبائنك يطلبون من هواتفهم بثوانٍ.',
  },
];

const MENU_ITEMS = [
  {
    id: 'menu',
    label: 'المنيو الإلكتروني',
    icon: BookOpen,
    explanation:
      "تعرف لو زبونك يفتح تلفونه ويشوف المنيو كلها ملونة ومرتبة ويطلب بضغطة زر؟ اهذا المنيو الإلكتروني — ما تحتاج تطبع ورق ولا تحدث قائمة يدوياً، كل شي محدث لحظة بلحظة، وإذا خلص صنف تقدر تسويله 'مو متوفر' بثانية وما يوصلك طلب عليه.",
  },
  {
    id: 'dashboard',
    label: 'لوحة التحكم',
    icon: LayoutDashboard,
    explanation:
      "لوحة التحكم الأسطورية — من فوق تشوف كل طلباتك حية، شكد مبيعاتك اليوم، شنو الأكثر طلب، وين المطبخ متأخر... كلشي بشاشة وحدة، ما تحتاج تدور بين دفاتر ولا تكصر راسك تحسب. كأنك قاعد بغرفة العمليات مال مطعمك.",
  },
  {
    id: 'delivery',
    label: 'نظام التوصيل',
    icon: Truck,
    explanation:
      "نظام التوصيل والسائقين — تعرف وين وصل الطلب هذا اللحظة، مثل ما تتبع الطلبية بأي تطبيق عالمي. السائق يستلم، يتحرك، والزبون يشوف كل شي live. ما راح تسمع بعد اليوم 'وين طلبي؟' لأن الجواب جاهز قدامك.",
  },
] as const;

function Typewriter({ text, speed = 18 }: { text: string; speed?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= text.length) return;
    const id = setTimeout(() => setCount((c) => c + 1), speed);
    return () => clearTimeout(id);
  }, [count, text, speed]);

  const done = count >= text.length;

  return (
    <p className="text-[#3a3a3c] text-[13px] sm:text-sm leading-relaxed">
      {text.slice(0, count)}
      {!done && (
        <span className="inline-block w-[2px] h-[1em] mx-0.5 -mb-[2px] bg-[#15803D] animate-pulse" />
      )}
    </p>
  );
}

const MASHI_FONT = {
  fontFamily: 'ui-rounded, "SF Pro Rounded", var(--font-mashi-rounded), sans-serif',
};

export default function LandingPage() {
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState<'menu' | 'dashboard' | 'delivery' | null>(null);

  useEffect(() => {
    if (!showMenu) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [showMenu]);

  return (
    <div className={`min-h-screen bg-white text-[#1d1d1f] ${mashiRoundedFont.variable}`} dir="rtl">

      {/* ── Nav ── */}
      <div className="sticky top-0 z-40">
        <header className="relative z-10 backdrop-blur-2xl backdrop-saturate-150 bg-[#1d1d1f]/80 border-b border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] px-4 py-3.5">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <span className="text-xl font-extrabold text-[#4ADE80]" style={MASHI_FONT}>ماشي</span>

            <button
              onClick={() => setShowMenu((o) => !o)}
              aria-label={showMenu ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={showMenu}
              aria-controls="mashi-mobile-menu"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 active:scale-95 transition-all"
            >
              <AnimatePresence mode="wait" initial={false}>
                {showMenu ? (
                  <motion.span
                    key="close-icon"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="flex"
                  >
                    <X className="w-5 h-5 text-white" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="open-icon"
                    initial={{ opacity: 0, rotate: 90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -90 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="flex"
                  >
                    <Menu className="w-5 h-5 text-white" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </header>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              id="mashi-mobile-menu"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="absolute top-full inset-x-0 z-10 bg-white border-b border-black/5 shadow-[0_16px_40px_rgba(0,0,0,0.16)] max-h-[calc(100vh-4.5rem)] overflow-y-auto"
            >
              <div className="max-w-5xl mx-auto px-4 py-2">
                {MENU_ITEMS.map((item) => {
                  const isActive = activeMenuItem === item.id;
                  return (
                    <div key={item.id} className="border-b border-black/5 last:border-b-0">
                      <button
                        onClick={() => setActiveMenuItem((cur) => (cur === item.id ? null : item.id))}
                        className="w-full flex items-center gap-3 py-3.5"
                      >
                        <span
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isActive ? 'bg-[#15803D]' : 'bg-[#15803D]/10'
                          }`}
                        >
                          <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#15803D]'}`} />
                        </span>
                        <span className="flex-1 font-bold text-sm text-[#1d1d1f]">{item.label}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-[#86868b] transition-transform duration-200 ${
                            isActive ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isActive && (
                        <div className="pb-4 pr-12">
                          <Typewriter key={item.id} text={item.explanation} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={() => setShowMenu(false)}
            aria-hidden="true"
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-4 pt-24 pb-28 sm:pt-32 sm:pb-36">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 20%, rgba(52,199,89,0.06) 0%, rgba(255,255,255,0) 70%), linear-gradient(180deg, rgba(52,199,89,0.04) 0%, rgba(255,255,255,0) 40%)',
          }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-4xl sm:text-6xl font-extrabold leading-tight text-[#1d1d1f]"
            style={MASHI_FONT}
          >
            <span className="text-[#15803D]">ماشي</span>.. نظامك المتكامل لإدارة مطعمك.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
            className="mt-6 text-base sm:text-lg text-[#6e6e73] leading-relaxed max-w-xl mx-auto"
          >
            ابتداءً من المنيو الإلكتروني الذكي، مروراً بلواحة التحكم الأسطورية لإدارة الطلبات والمطبخ، انتهاءً بنظام التوصيل والسائقين — كل ما تحتاجه لإدارة مطعمك بضغطة زر.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            className="mt-10"
          >
            <button
              onClick={() => setShowSignupModal(true)}
              className="px-8 py-4 rounded-2xl bg-[#1d1d1f] text-white font-black text-base active:scale-95 transition-all"
            >
              إنشاء حساب
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-4 py-20 sm:py-28 bg-[#f5f5f7]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.08 }}
              className="bg-white border border-black/5 shadow-[0_2px_20px_rgba(0,0,0,0.04)] rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="w-11 h-11 rounded-xl bg-[#15803D]/10 flex items-center justify-center">
                <f.icon className="w-5 h-5 text-[#15803D]" />
              </div>
              <div>
                <p className="font-bold text-sm text-[#1d1d1f] leading-snug">{f.title}</p>
                <p className="text-[#6e6e73] text-xs leading-relaxed mt-1.5">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ختامي ── */}
      <section className="relative overflow-hidden px-4 py-24">
        <div className="absolute inset-0 bg-[#f5f5f7]" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative max-w-2xl mx-auto text-center"
        >
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#1d1d1f]" style={MASHI_FONT}>
            جاهز تبدأ مع <span className="text-[#15803D]">ماشي</span>؟
          </h2>
          <button
            onClick={() => setShowSignupModal(true)}
            className="mt-8 px-8 py-4 rounded-2xl bg-[#1d1d1f] text-white font-black text-base active:scale-95 transition-all"
          >
            إنشاء حساب
          </button>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-black/5 px-4 py-8 text-center">
        <p className="text-[#86868b] text-xs">© 2026 <span className="text-[#15803D]">ماشي</span></p>
        <p className="text-[#86868b] text-[11px] mt-1">منصّة توصيل مطاعم متعددة المستأجرين</p>
      </footer>

      {showSignupModal && <SignupRequestModal onClose={() => setShowSignupModal(false)} />}
    </div>
  );
}
