'use client';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Instagram/i.test(ua) || /BytedanceWebview|musical_li|TikTok/i.test(ua);
}

type Props = {
  show: boolean;
  onContinue: () => void;
  onDismiss: () => void;
};

export default function InAppBrowserBanner({ show, onContinue, onDismiss }: Props) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isInstagram = /Instagram/i.test(ua);
  const appName = isInstagram ? 'إنستقرام' : 'تيك توك';
  const appIcon = isInstagram ? '📸' : '🎵';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 pt-6 pb-8 text-center relative">
              <button
                onClick={onDismiss}
                className="absolute top-4 left-4 w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center text-white"
              >
                <X size={16} />
              </button>
              <div className="text-5xl mb-3">📍</div>
              <h2 className="text-white font-black text-xl">تحديد الموقع لا يعمل بدقة</h2>
              <p className="text-white/80 text-sm mt-1 font-medium">
                {appIcon} متصفح {appName} يمنع الوصول الدقيق للموقع
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-5" dir="rtl">
              <p className="text-gray-600 dark:text-slate-300 text-sm leading-relaxed mb-5 font-medium">
                لتحديد موقعك بدقة وضمان وصول طلبك بشكل صحيح، افتح الرابط في Safari باتباع الخطوات:
              </p>

              <div className="space-y-3">
                <Step number="١" text={`اضغط على أيقونة الثلاث نقاط  ⋯  أو أيقونة المشاركة`} />
                <Step number="٢" text='اختر "فتح في Safari" أو "Open in Safari"' />
                <Step number="٣" text="أعد تحديد موقعك بدقة عالية 🎯" />
              </div>

              <button
                onClick={onContinue}
                className="mt-6 w-full py-3.5 rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: '#ef4444', color: '#fff' }}
              >
                📍 تحديد الموقع يدوياً على الخريطة
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-start gap-3 flex-row-reverse">
      <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
        <span className="text-orange-500 font-black text-sm">{number}</span>
      </div>
      <p className="text-gray-700 dark:text-slate-300 text-sm font-medium leading-relaxed text-right pt-1">
        {text}
      </p>
    </div>
  );
}
