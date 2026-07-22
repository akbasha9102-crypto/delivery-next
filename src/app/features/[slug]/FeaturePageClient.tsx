'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { mashiRoundedFont, MASHI_FONT } from '@/app/home/brand';
import SignupRequestModal from '@/app/home/SignupRequestModal';
import { FEATURE_CONTENT, type FeatureSlug } from '@/app/home/featureContent';

function HighlightedTitle({ title, label }: { title: string; label: string }) {
  const idx = title.indexOf(label);
  if (idx === -1) return <>{title}</>;
  const before = title.slice(0, idx);
  const after = title.slice(idx + label.length);
  return (
    <>
      {before}
      <span className="text-[#15803D]">{label}</span>
      {after}
    </>
  );
}

export default function FeaturePageClient({ slug }: { slug: FeatureSlug }) {
  const [showSignupModal, setShowSignupModal] = useState(false);
  const content = FEATURE_CONTENT[slug];
  const Icon = content.icon;

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
      <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 20%, rgba(52,199,89,0.06) 0%, rgba(255,255,255,0) 70%), linear-gradient(180deg, rgba(52,199,89,0.04) 0%, rgba(255,255,255,0) 40%)',
          }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="w-16 h-16 rounded-2xl bg-[#15803D]/10 flex items-center justify-center mx-auto mb-6"
          >
            <Icon className="w-7 h-7 text-[#15803D]" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="text-3xl sm:text-5xl font-extrabold leading-tight text-[#1d1d1f]"
            style={MASHI_FONT}
          >
            <HighlightedTitle title={content.heroTitle} label={content.label} />
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className="mt-6 text-base sm:text-lg text-[#15803D] font-bold leading-relaxed max-w-xl mx-auto"
          >
            {content.tagline}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            className="mt-4 text-[#6e6e73] text-sm sm:text-base leading-relaxed max-w-xl mx-auto"
          >
            {content.explanation}
          </motion.p>
        </div>
      </section>

      {/* ── Strengths ── */}
      <section className="px-4 py-16 sm:py-24 bg-[#f5f5f7]">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-2xl sm:text-3xl font-extrabold text-center text-[#1d1d1f] mb-10"
          style={MASHI_FONT}
        >
          نقاط قوة {content.label}
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {content.strengths.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.08 }}
              className="bg-white border border-black/5 shadow-[0_2px_20px_rgba(0,0,0,0.04)] rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="w-11 h-11 rounded-xl bg-[#15803D]/10 flex items-center justify-center">
                <s.icon className="w-5 h-5 text-[#15803D]" />
              </div>
              <div>
                <p className="font-bold text-sm text-[#1d1d1f] leading-snug">{s.title}</p>
                <p className="text-[#6e6e73] text-xs leading-relaxed mt-1.5">{s.desc}</p>
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
