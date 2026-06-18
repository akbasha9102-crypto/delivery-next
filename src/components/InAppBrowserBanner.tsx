'use client';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Instagram/i.test(ua) || /BytedanceWebview|musical_li|TikTok/i.test(ua);
}

function isAndroid() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

type FormData = {
  name: string;
  nickname: string;
  phone: string;
  locationDesc: string;
  addressDetails: string;
};

type Props = {
  show: boolean;
  onContinue: () => void;
  onDismiss: () => void;
  formData?: FormData;
};

function buildRedirectUrl(formData?: FormData): string {
  const url = new URL(window.location.href);
  url.pathname = '/home';
  url.search = '';
  if (formData?.name)           url.searchParams.set('_name',  formData.name);
  if (formData?.nickname)       url.searchParams.set('_nick',  formData.nickname);
  if (formData?.phone)          url.searchParams.set('_phone', formData.phone);
  if (formData?.locationDesc)   url.searchParams.set('_loc',   formData.locationDesc);
  if (formData?.addressDetails) url.searchParams.set('_addr',  formData.addressDetails);
  return url.toString();
}

function redirectToExternalBrowser(formData?: FormData) {
  const targetUrl = buildRedirectUrl(formData);
  if (isAndroid()) {
    const parsed = new URL(targetUrl);
    window.location.href = `intent://${parsed.host}${parsed.pathname}${parsed.search}#Intent;scheme=https;package=com.android.chrome;end`;
  } else {
    window.location.href = 'x-safari-' + targetUrl;
  }
}

export default function InAppBrowserBanner({ show, onContinue, onDismiss, formData }: Props) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isInstagram = /Instagram/i.test(ua);
  const appName = isInstagram ? 'إنستقرام' : 'تيك توك';

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
                متصفح {appName} يمنع الوصول الدقيق للموقع
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-5" dir="rtl">
              <p className="text-gray-600 dark:text-slate-300 text-sm leading-relaxed mb-5 font-medium">
                لتحديد موقعك بشكل دقيق وضمان وصول طلبك بشكل صحيح، افتح الرابط في المتصفح — معلوماتك ستنحفظ تلقائياً.
              </p>

              {/* Primary: open in browser */}
              <button
                onClick={() => redirectToExternalBrowser(formData)}
                className="w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)', color: '#fff' }}
              >
                🧭 افتح في المتصفح مع حفظ معلوماتي
              </button>

              {/* Secondary: manual location */}
              <button
                onClick={onContinue}
                className="mt-3 w-full py-3.5 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 font-black text-sm active:scale-95 transition-all"
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
