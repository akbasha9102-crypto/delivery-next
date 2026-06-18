'use client';
import { useEffect, useState } from 'react';
import { isInAppBrowser } from './InAppBrowserBanner';

function isAndroid() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

function openInExternalBrowser() {
  const url = window.location.href;
  if (isAndroid()) {
    const host = window.location.host;
    const path = window.location.pathname + window.location.search + window.location.hash;
    window.location.href = `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
  } else {
    // iOS: best-effort attempt (works on some versions)
    window.location.href = 'x-safari-' + url;
  }
}

export default function InAppRedirect() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isInAppBrowser()) return;
    setShow(true);
  }, []);

  if (!show) return null;

  const btnLabel = isAndroid() ? 'افتح في المتصفح' : 'افتح في Safari';

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-3 px-4 py-3"
      style={{ background: 'linear-gradient(90deg, #f97316, #ef4444)', boxShadow: '0 4px 20px rgba(239,68,68,0.4)' }}
    >
      <p className="text-white text-xs font-bold leading-tight text-right flex-1">
        للحصول على تجربة أفضل افتحه في المتصفح 🧭
      </p>
      <button
        onClick={openInExternalBrowser}
        className="flex-shrink-0 bg-white text-orange-500 font-black text-xs px-3 py-1.5 rounded-full active:scale-95 transition-all whitespace-nowrap"
      >
        {btnLabel}
      </button>
      <button onClick={() => setShow(false)} className="text-white/70 text-lg leading-none flex-shrink-0">
        ✕
      </button>
    </div>
  );
}
