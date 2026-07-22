'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Truck, PackageSearch, Smartphone, Menu, X, ChevronLeft } from 'lucide-react';
import { mashiRoundedFont, MASHI_FONT } from './brand';
import { FEATURE_CONTENT } from './featureContent';
import FloatingLeaves from './FloatingLeaves';

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

const MENU_ITEMS = Object.values(FEATURE_CONTENT);

export default function LandingPage() {
  const [showMenu, setShowMenu] = useState(false);

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
              className="absolute top-full inset-x-0 z-10 bg-[#f5f5f7] border-b border-black/5 shadow-[0_16px_40px_rgba(0,0,0,0.16)] max-h-[calc(100vh-4.5rem)] overflow-y-auto"
            >
              <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-2.5">
                {MENU_ITEMS.map((item) => (
                  <Link
                    key={item.id}
                    href={`/features/${item.id}`}
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white border border-black/5 shadow-[0_2px_20px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all"
                  >
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#15803D]/10">
                      <item.icon className="w-4 h-4 text-[#15803D]" />
                    </span>
                    <span className="flex-1 font-bold text-sm text-[#1d1d1f]">{item.label}</span>
                    <ChevronLeft className="w-4 h-4 text-[#86868b]" />
                  </Link>
                ))}
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
        <FloatingLeaves />
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
            <Link
              href="/signup"
              className="inline-block px-8 py-4 rounded-2xl bg-[#1d1d1f] text-white font-black text-base active:scale-95 transition-all"
            >
              إنشاء حساب
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-28 bg-[#f5f5f7]">
        <FloatingLeaves density="light" />
        <div className="relative max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <Link
            href="/signup"
            className="mt-8 inline-block px-8 py-4 rounded-2xl bg-[#1d1d1f] text-white font-black text-base active:scale-95 transition-all"
          >
            إنشاء حساب
          </Link>
        </motion.div>
      </section>

      {/* ── تتبع الطلب ── */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-28 bg-[#f5f5f7]">
        <FloatingLeaves density="light" />
        <div className="relative max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-[#1d1d1f] mb-3" style={MASHI_FONT}>
            قدّمت طلب إنشاء حساب؟
          </h2>
          <p className="text-center text-[#6e6e73] text-sm sm:text-base mb-10 max-w-xl mx-auto">
            تابع حالة طلبك بثوانٍ — هذي رحلته من لحظة التقديم لحظة التفعيل.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { n: '١', title: 'قدّم بياناتك', desc: 'تعبي نموذج بسيط ببياناتك وبيانات مطعمك.' },
              { n: '٢', title: 'ننتظر يوافق فريقنا', desc: 'فريق ماشي يراجع طلبك بأسرع وقت ممكن.' },
              { n: '٣', title: 'تفعيل حسابك وابدأ', desc: 'بعد الموافقة، حسابك جاهز وتقدر تبدأ فوراً.' },
            ].map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.08 }}
                className="bg-white border border-black/5 shadow-[0_2px_20px_rgba(0,0,0,0.04)] rounded-2xl p-6 flex flex-col gap-3"
              >
                <span className="w-9 h-9 rounded-xl bg-[#15803D]/10 flex items-center justify-center text-[#15803D] font-extrabold text-sm">
                  {s.n}
                </span>
                <p className="font-bold text-sm text-[#1d1d1f] leading-snug">{s.title}</p>
                <p className="text-[#6e6e73] text-xs leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/track-signup"
              className="inline-block px-7 py-3.5 rounded-2xl bg-white border border-black/10 text-[#1d1d1f] font-bold text-sm active:scale-95 transition-all"
            >
              تتبع طلبك
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-black/5 px-4 py-8 text-center">
        <p className="text-[#86868b] text-xs">© 2026 <span className="text-[#15803D]">ماشي</span></p>
        <p className="text-[#86868b] text-[11px] mt-1">منصّة توصيل مطاعم متعددة المستأجرين</p>
      </footer>
    </div>
  );
}
