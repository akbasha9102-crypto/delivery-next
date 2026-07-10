'use client';
import { useEffect } from 'react';
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

type CartItem = { id: string; name: string; price: number; quantity: number; extras_json?: string };
type FormData = { name: string; nickname: string; phone: string; locationDesc: string; addressDetails: string };
type Props = {
  show: boolean;
  onContinue: () => void;
  onDismiss: () => void;
  formData?: FormData;
  cartItems?: CartItem[];
};

function buildRedirectUrl(formData?: FormData, cartItems?: CartItem[]): string {
  const url = new URL(window.location.href);
  url.pathname = '/cart';
  url.search = '';
  if (formData?.name)           url.searchParams.set('_name',  formData.name);
  if (formData?.nickname)       url.searchParams.set('_nick',  formData.nickname);
  if (formData?.phone)          url.searchParams.set('_phone', formData.phone);
  if (formData?.locationDesc)   url.searchParams.set('_loc',   formData.locationDesc);
  if (formData?.addressDetails) url.searchParams.set('_addr',  formData.addressDetails);
  if (cartItems && cartItems.length > 0) {
    const slim = cartItems.map(({ id, name, price, quantity, extras_json }) => ({ id, name, price, quantity, extras_json }));
    url.searchParams.set('_cart', btoa(encodeURIComponent(JSON.stringify(slim))));
  }
  return url.toString();
}

export default function InAppBrowserBanner({ show, onContinue, onDismiss, formData, cartItems }: Props) {
  const android = isAndroid();

  // Embed form data into the current URL so when the user taps "Open in Safari/Chrome"
  // from the browser's ••• menu, their data carries over automatically.
  useEffect(() => {
    if (!show) return;
    const url = buildRedirectUrl(formData, cartItems);
    window.history.replaceState({}, '', url);
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={onDismiss}
          />

          {/* Callout — pinned to top-right edge, as high as possible */}
          <motion.div
            initial={{ opacity: 0, scale: 0.82, x: 20 }}
            animate={{ opacity: 1, scale: 1,    x: 0  }}
            exit={{   opacity: 0, scale: 0.82, x: 20  }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="fixed z-[100]"
            style={{ top: 8, right: 0 }}
          >
            {/* Arrow pointing up-right toward ••• button */}
            <div style={{
              position: 'absolute', top: -9, right: 14,
              width: 0, height: 0,
              borderLeft:   '9px solid transparent',
              borderRight:  '9px solid transparent',
              borderBottom: '9px solid #ef4444',
            }}/>

            {/* Card */}
            <div dir="rtl" style={{
              background: '#ef4444',
              borderRadius: '18px 0 18px 18px',
              padding: '14px 14px 14px 34px',
              maxWidth: 232,
              boxShadow: '0 12px 40px rgba(239,68,68,0.35), 0 2px 8px rgba(0,0,0,0.12)',
              position: 'relative',
            }}>
              {/* Close button */}
              <button
                onClick={onDismiss}
                style={{
                  position: 'absolute', top: 8, left: 8,
                  width: 22, height: 22,
                  background: 'rgba(255,255,255,0.25)', borderRadius: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={11} color="white"/>
              </button>

              <p style={{ fontWeight: 900, fontSize: 13, color: 'white', marginBottom: 10, lineHeight: 1.5 }}>
                لتحديد موقعك بشكل دقيق:
              </p>

              <div style={{ fontSize: 13, color: 'white', lineHeight: 1.9, fontWeight: 600 }}>
                <p>① اضغط على <strong style={{ fontSize: 16 }}>⋯</strong> الثلاث نقاط</p>
                <p>② اضغط <strong>"Open in external browser"</strong></p>
              </div>

              <div style={{
                marginTop: 10,
                background: 'rgba(255,255,255,0.18)',
                borderRadius: 10,
                padding: '6px 10px',
                fontSize: 11,
                color: 'white',
                fontWeight: 700,
              }}>
                ✓ ستنتقل معلوماتك معك تلقائياً
              </div>
            </div>

            {/* Manual map fallback */}
            <button
              onClick={onContinue}
              dir="rtl"
              style={{
                marginTop: 6,
                width: '100%',
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(4px)',
                borderRadius: '0 0 13px 13px',
                padding: '9px 14px',
                fontSize: 12,
                fontWeight: 700,
                color: '#ef4444',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              }}
            >
              أو تحديد موقعك بشكل يدوي
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
