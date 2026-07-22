'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Truck, PackageSearch, Smartphone } from 'lucide-react';
import SignupRequestModal from './SignupRequestModal';

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

const BRAND_FONT = { fontFamily: 'var(--font-brand-name)' };

export default function LandingPage() {
  const [showSignupModal, setShowSignupModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#09090f] text-white" dir="rtl">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#09090f]/90 border-b border-white/5 px-4 py-3.5">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <span className="text-xl font-extrabold" style={BRAND_FONT}>ماشي</span>
          <button
            onClick={() => setShowSignupModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm active:scale-95 transition-all shadow-lg shadow-violet-900/30"
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
              'radial-gradient(60% 50% at 50% 20%, rgba(124,58,237,0.25) 0%, rgba(9,9,15,0) 70%), linear-gradient(180deg, rgba(79,70,229,0.08) 0%, rgba(9,9,15,0) 40%)',
          }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-4xl sm:text-6xl font-extrabold leading-tight"
            style={BRAND_FONT}
          >
            ماشي. توصيل مطاعم، بلا تعقيد.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
            className="mt-6 text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl mx-auto"
          >
            منصّة واحدة تدير بها مطعمك بالكامل — طلبات، مطبخ، سائقين، ومخزون — بينما زبائنك يطلبون بضغطة.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            className="mt-10"
          >
            <button
              onClick={() => setShowSignupModal(true)}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-base active:scale-95 transition-all shadow-lg shadow-violet-900/40"
            >
              إنشاء حساب
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-4 py-20 sm:py-28">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.08 }}
              className="bg-[#13132b] border border-white/5 rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <f.icon className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-white leading-snug">{f.title}</p>
                <p className="text-slate-400 text-xs leading-relaxed mt-1.5">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ختامي ── */}
      <section className="relative overflow-hidden px-4 py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700/40 via-indigo-700/30 to-[#09090f]" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative max-w-2xl mx-auto text-center"
        >
          <h2 className="text-2xl sm:text-4xl font-extrabold" style={BRAND_FONT}>
            جاهز تبدأ مع ماشي؟
          </h2>
          <button
            onClick={() => setShowSignupModal(true)}
            className="mt-8 px-8 py-4 rounded-2xl bg-white text-[#09090f] font-black text-base active:scale-95 transition-all shadow-lg"
          >
            إنشاء حساب
          </button>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-4 py-8 text-center">
        <p className="text-slate-500 text-xs">© 2026 ماشي</p>
        <p className="text-slate-600 text-[11px] mt-1">منصّة توصيل مطاعم متعددة المستأجرين</p>
      </footer>

      {showSignupModal && <SignupRequestModal onClose={() => setShowSignupModal(false)} />}
    </div>
  );
}
