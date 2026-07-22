'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Truck, PackageSearch, Smartphone } from 'lucide-react';
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

const MASHI_FONT = {
  fontFamily: 'ui-rounded, "SF Pro Rounded", var(--font-mashi-rounded), sans-serif',
};

export default function LandingPage() {
  const [showSignupModal, setShowSignupModal] = useState(false);

  return (
    <div className={`min-h-screen bg-white text-[#1d1d1f] ${mashiRoundedFont.variable}`} dir="rtl">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 border-b border-black/5 px-4 py-3.5">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <span className="text-xl font-extrabold text-[#15803D]" style={MASHI_FONT}>ماشي</span>
          <button
            onClick={() => setShowSignupModal(true)}
            className="px-4 py-2 rounded-xl bg-[#1d1d1f] text-white font-bold text-sm active:scale-95 transition-all"
          >
            إنشاء حساب
          </button>
        </div>
      </header>

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
