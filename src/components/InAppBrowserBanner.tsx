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

          {/* Callout — top-right, below the browser's ••• button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.82, y: -10 }}
            animate={{ opacity: 1, scale: 1,    y: 0   }}
            exit={{   opacity: 0, scale: 0.82, y: -10 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="fixed z-[100]"
            style={{ top: 62, right: 8 }}
          >
            {/* Arrow pointing up toward ••• button */}
            <div style={{
              position: 'absolute', top: -9, right: 18,
              width: 0, height: 0,
              borderLeft:   '9px solid transparent',
              borderRight:  '9px solid transparent',
              borderBottom: '9px solid white',
              filter: 'drop-shadow(0 -2px 3px rgba(0,0,0,0.08))',
            }}/>

            {/* Card */}
            <div dir="rtl" style={{
              background: 'white',
              borderRadius: 18,
              padding: '14px 14px 14px 36px',
              maxWidth: 228,
              boxShadow: '0 12px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08)',
              position: 'relative',
            }}>
              {/* Close button */}
              <button
                onClick={onDismiss}
                style={{
                  position: 'absolute', top: 8, left: 8,
                  width: 24, height: 24,
                  background: '#f3f4f6', borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={12} color="#9ca3af"/>
              </button>

              <p style={{ fontWeight: 900, fontSize: 13, color: '#111827', marginBottom: 10, lineHeight: 1.4 }}>
                افتح في {android ? 'Chrome' : 'Safari'} 📍
              </p>

              <div style={{ fontSize: 13, color: '#1f2937', lineHeight: 1.85 }}>
                <p>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>①</span>
                  {' '}اضغط <strong style={{ fontSize: 16, letterSpacing: 1 }}>⋯</strong> أعلى اليمين
                </p>
                <p>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>②</span>
                  {' '}اختر <strong>"{android ? 'فتح في Chrome' : 'فتح في Safari'}"</strong>
                </p>
              </div>

              <div style={{
                marginTop: 10,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 10,
                padding: '6px 10px',
                fontSize: 11,
                color: '#15803d',
                fontWeight: 700,
              }}>
                ✓ معلوماتك محفوظة وتنتقل معك تلقائياً
              </div>
            </div>

            {/* Manual map fallback */}
            <button
              onClick={onContinue}
              dir="rtl"
              style={{
                marginTop: 8,
                width: '100%',
                background: 'rgba(255,255,255,0.90)',
                backdropFilter: 'blur(4px)',
                borderRadius: 13,
                padding: '9px 14px',
                fontSize: 12,
                fontWeight: 700,
                color: '#6b7280',
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              }}
            >
              أو حدد موقعك يدوياً على الخريطة
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
