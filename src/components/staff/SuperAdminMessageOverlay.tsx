'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useSuperAdminNotifications } from '@/context/SuperAdminNotificationsContext';

/**
 * إشعار فوري بملء الشاشة عند وصول رسالة جديدة من السوبر أدمن (لمطعم محدد أو بث للجميع)،
 * بغض النظر عن الصفحة الحالية داخل /admin. يختفي تلقائياً بعد 5 ثوانٍ أو بإغلاق يدوي.
 * يستهلك toastQueue من SuperAdminNotificationsContext مباشرة (بلا props) — الكاشير مستبعد
 * بالكامل مركزياً هناك (toastQueue يبقى فارغاً له دائماً).
 */
export function SuperAdminMessageOverlay() {
  const { toastQueue, dismissToast } = useSuperAdminNotifications();
  const current = toastQueue[0];

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => dismissToast(), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
      onClick={() => dismissToast()}
      dir="rtl"
    >
      <div
        className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl text-center"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => dismissToast()}
          className="absolute top-4 left-4 p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 active:scale-95 transition-all"
        >
          <X size={16} />
        </button>
        <p className="text-xs font-bold text-[#2563eb] mb-3">رسالة من إدارة المنصة</p>
        <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">{current.title}</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-wrap">{current.body}</p>
      </div>
    </div>
  );
}
