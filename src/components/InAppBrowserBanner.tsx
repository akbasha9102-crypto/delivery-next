'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

function detectInAppBrowser(): 'instagram' | 'tiktok' | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/BytedanceWebview|musical_li|TikTok/i.test(ua)) return 'tiktok';
  return null;
}

export default function InAppBrowserBanner() {
  const [browser, setBrowser] = useState<'instagram' | 'tiktok' | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setBrowser(detectInAppBrowser());
  }, []);

  if (!browser || dismissed) return null;

  const appName = browser === 'instagram' ? 'إنستقرام' : 'تيك توك';
  const appIcon = browser === 'instagram' ? '📸' : '🎵';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 pt-6 pb-8 text-center relative">
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-4 left-4 w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center text-white"
          >
            <X size={16} />
          </button>
          <div className="text-5xl mb-3">🧭</div>
          <h2 className="text-white font-black text-xl">افتح بالسفاري</h2>
          <p className="text-white/80 text-sm mt-1 font-medium">
            للحصول على تجربة أفضل
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-gray-600 dark:text-slate-300 text-sm text-right leading-relaxed mb-5 font-medium">
            أنت تفتح الصفحة من متصفح {appIcon} {appName}، بعض الميزات قد لا تعمل بشكل صحيح. افتح الرابط بالسفاري باتباع الخطوات:
          </p>

          <div className="space-y-3" dir="rtl">
            <Step number="١" text={`اضغط على أيقونة الثلاث نقاط  ⋯  أو أيقونة المشاركة`} />
            <Step number="٢" text='اختر "فتح في Safari" أو "Open in Safari"' />
            <Step number="٣" text="استمتع بتجربة طلب أسرع وأفضل 🚀" />
          </div>

          <button
            onClick={() => setDismissed(true)}
            className="mt-6 w-full py-3.5 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 font-black text-sm"
          >
            متابعة على {appName} مؤقتاً
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-start gap-3 flex-row-reverse">
      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
        <span className="text-blue-600 dark:text-blue-400 font-black text-sm">{number}</span>
      </div>
      <p className="text-gray-700 dark:text-slate-300 text-sm font-medium leading-relaxed text-right pt-1">
        {text}
      </p>
    </div>
  );
}
