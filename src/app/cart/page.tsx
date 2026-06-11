'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { Trash2, MapPin, UserCircle, Pencil, LocateFixed, CheckCircle2, Loader2, RefreshCw, X, Phone } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '@/context/SettingsContext';
import { useDarkMode } from '@/context/ThemeContext';

const KEYS = {
  name:         'deliveryName',
  phone:        'deliveryPhone',
  locationDesc: 'deliveryLocationDesc',
};

const BASRA_CENTER: [number, number] = [30.5085, 47.7804];

type SavedInfo = { name: string; phone: string; locationDesc: string };

function loadSaved(): SavedInfo | null {
  const name  = localStorage.getItem(KEYS.name)  || '';
  const phone = localStorage.getItem(KEYS.phone) || '';
  if (!name || !phone) return null;
  return { name, phone, locationDesc: localStorage.getItem(KEYS.locationDesc) || '' };
}

function saveInfo(info: SavedInfo) {
  localStorage.setItem(KEYS.name,         info.name);
  localStorage.setItem(KEYS.phone,        info.phone);
  localStorage.setItem(KEYS.locationDesc, info.locationDesc);
}

export default function CartPage() {
  const { items, removeItem, clearCart, total } = useCart();
  const { primary_color } = useSettings();
  const { dark } = useDarkMode();
  const router = useRouter();

  const rawColor   = primary_color || '#e67e22';
  const isTooDark  = rawColor === '#000000' || rawColor.toLowerCase() === '#121212';
  const brandColor = (dark && isTooDark) ? '#ffffff' : rawColor;

  const textOnBrand = (() => {
    const hex = brandColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return L > 0.179 ? '#000000' : '#ffffff';
  })();

  // form fields
  const [name,         setName]         = useState('');
  const [phone,        setPhone]        = useState('');
  const [locationDesc, setLocationDesc] = useState('');
  const [note,         setNote]         = useState('');

  // UI state
  const [showSaved,        setShowSaved]        = useState(false);
  const [editing,          setEditing]          = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading,          setLoading]          = useState(false);

  // map state
  const [clientLat, setClientLat] = useState<number | null>(null);
  const [clientLng, setClientLng] = useState<number | null>(null);
  const [showMap,           setShowMap]           = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [gpsLocating,       setGpsLocating]       = useState(false);
  const [gpsAccuracy,       setGpsAccuracy]       = useState<number | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showPreciseModal,    setShowPreciseModal]    = useState(false);

  // refs
  const preciseTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationMapRef         = useRef<HTMLDivElement>(null);
  const locationMapInstanceRef = useRef<any>(null);
  const confirmMapRef          = useRef<HTMLDivElement>(null);
  const confirmMapInstanceRef  = useRef<any>(null);
  const pendingFlyRef          = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const submitBtnRef           = useRef<HTMLButtonElement>(null);
  const pendingConfirmRef      = useRef(false); // after map → open confirm modal
  const gpsWatchRef            = useRef<number | null>(null);
  const gpsStopTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── GPS helpers ──────────────────────────────────────────────────────────

  const stopGpsWatch = () => {
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    if (gpsStopTimerRef.current)  { clearTimeout(gpsStopTimerRef.current);  gpsStopTimerRef.current  = null; }
    if (preciseTimerRef.current)  { clearTimeout(preciseTimerRef.current);   preciseTimerRef.current  = null; }
  };

  const startGpsWatch = (onPosition: (lat: number, lng: number, accuracy: number) => void) => {
    stopGpsWatch();
    setGpsLocating(true);
    setGpsAccuracy(null);
    if (!('geolocation' in navigator)) { setGpsLocating(false); return; }

    let bestAccuracy = Infinity;
    let gotFirstReading = false;

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(Math.round(accuracy));
        if (accuracy < bestAccuracy) { bestAccuracy = accuracy; onPosition(latitude, longitude, accuracy); }
        if (!gotFirstReading) {
          gotFirstReading = true;
          if (accuracy > 1000) {
            if (preciseTimerRef.current) clearTimeout(preciseTimerRef.current);
            preciseTimerRef.current = setTimeout(() => { if (bestAccuracy > 1000) setShowPreciseModal(true); }, 6000);
          }
        }
        if (accuracy <= 500 && preciseTimerRef.current) { clearTimeout(preciseTimerRef.current); preciseTimerRef.current = null; }
        if (accuracy <= 30) { stopGpsWatch(); setGpsLocating(false); }
      },
      (err) => {
        setGpsLocating(false);
        if (err.code === 1) { setShowPermissionModal(true); setShowMap(false); }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  };

  const locateMe = () => {
    if (!locationMapInstanceRef.current) return;
    startGpsWatch((lat, lng, accuracy) => {
      if (!locationMapInstanceRef.current) return;
      const zoom = accuracy < 30 ? 18 : accuracy < 100 ? 17 : accuracy < 500 ? 16 : accuracy < 2000 ? 14 : 13;
      locationMapInstanceRef.current.flyTo([lat, lng], zoom, { animate: true, duration: 0.8 });
    });
  };

  const doOpenMap = () => {
    setShowMap(true);
    setClientLat(BASRA_CENTER[0]);
    setClientLng(BASRA_CENTER[1]);
    startGpsWatch((lat, lng, accuracy) => {
      const zoom = accuracy < 30 ? 18 : accuracy < 100 ? 17 : accuracy < 500 ? 16 : accuracy < 2000 ? 14 : 13;
      if (locationMapInstanceRef.current) {
        locationMapInstanceRef.current.flyTo([lat, lng], zoom, { animate: true, duration: 0.8 });
      } else {
        pendingFlyRef.current = { lat, lng, accuracy };
      }
    });
  };

  const openMap = () => {
    if (!('geolocation' in navigator)) { setShowPermissionModal(true); return; }
    navigator.permissions?.query({ name: 'geolocation' as PermissionName })
      .then((result: PermissionStatus) => { if (result.state === 'denied') setShowPermissionModal(true); else doOpenMap(); })
      .catch(() => doOpenMap());
  };

  const closeMap = () => {
    stopGpsWatch();
    if (locationMapInstanceRef.current) { locationMapInstanceRef.current.remove(); locationMapInstanceRef.current = null; }
    pendingFlyRef.current   = null;
    pendingConfirmRef.current = false;
    setShowMap(false);
    setLocationConfirmed(false);
    setClientLat(null);
    setClientLng(null);
    setGpsLocating(false);
    setGpsAccuracy(null);
  };

  const confirmLocation = () => {
    stopGpsWatch();
    if (locationMapInstanceRef.current) { locationMapInstanceRef.current.remove(); locationMapInstanceRef.current = null; }
    pendingFlyRef.current = null;
    setShowMap(false);
    setLocationConfirmed(true);
    setGpsLocating(false);
    setGpsAccuracy(null);
    if (pendingConfirmRef.current) {
      pendingConfirmRef.current = false;
      setShowConfirmModal(true);
    } else {
      setTimeout(() => submitBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }
  };

  // ── Leaflet CSS ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (document.querySelector('link[data-leaflet-css]')) return;
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.setAttribute('data-leaflet-css', '1');
    document.head.appendChild(link);
  }, []);

  // ── Main map lifecycle ────────────────────────────────────────────────────

  useEffect(() => {
    if (!showMap) return;
    const t = setTimeout(() => {
      if (!locationMapRef.current || locationMapInstanceRef.current) return;
      import('leaflet').then((mod) => {
        const L = (mod as any).default ?? mod;
        if (!locationMapRef.current || locationMapInstanceRef.current) return;
        const map = L.map(locationMapRef.current, { zoomControl: false }).setView(BASRA_CENTER, 13);
        locationMapInstanceRef.current = map;
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19,
        }).addTo(map);
        setTimeout(() => map.invalidateSize({ pan: false }), 100);
        setTimeout(() => map.invalidateSize({ pan: false }), 500);
        map.on('moveend', () => { const c = map.getCenter(); setClientLat(c.lat); setClientLng(c.lng); });
        if (pendingFlyRef.current) {
          const { lat, lng, accuracy } = pendingFlyRef.current;
          map.setView([lat, lng], accuracy < 100 ? 17 : accuracy < 500 ? 16 : accuracy < 2000 ? 14 : 13);
          pendingFlyRef.current = null;
        }
      });
    }, 80);
    return () => {
      clearTimeout(t);
      if (locationMapInstanceRef.current) { locationMapInstanceRef.current.remove(); locationMapInstanceRef.current = null; }
    };
  }, [showMap]);

  // ── Confirmation modal mini-map ───────────────────────────────────────────

  useEffect(() => {
    if (!showConfirmModal || !clientLat || !clientLng) return;
    const t = setTimeout(() => {
      if (!confirmMapRef.current || confirmMapInstanceRef.current) return;
      import('leaflet').then((mod) => {
        const L = (mod as any).default ?? mod;
        if (!confirmMapRef.current || confirmMapInstanceRef.current) return;
        const map = L.map(confirmMapRef.current, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false })
          .setView([clientLat!, clientLng!], 16);
        confirmMapInstanceRef.current = map;
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19,
        }).addTo(map);
        const icon = L.divIcon({
          html: `<div style="width:36px;height:36px;background:#ef4444;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 4px 12px #ef444480;display:flex;align-items:center;justify-content:center"><div style="width:10px;height:10px;background:white;border-radius:50%;transform:rotate(45deg)"></div></div>`,
          className: '', iconSize: [36, 36], iconAnchor: [18, 36],
        });
        L.marker([clientLat!, clientLng!], { icon }).addTo(map);
        setTimeout(() => map.invalidateSize({ pan: false }), 100);
      });
    }, 80);
    return () => {
      clearTimeout(t);
      if (confirmMapInstanceRef.current) { confirmMapInstanceRef.current.remove(); confirmMapInstanceRef.current = null; }
    };
  }, [showConfirmModal, clientLat, clientLng, brandColor]);

  // ── Load saved info ───────────────────────────────────────────────────────

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setName(saved.name);
      setPhone(saved.phone);
      setLocationDesc(saved.locationDesc);
      setShowSaved(true);
    } else {
      setEditing(true);
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleConfirmSaved = () => {
    if (items.length === 0) { alert('السلة فارغة'); return; }
    setShowSaved(false);
    pendingConfirmRef.current = true;
    openMap();
  };

  const handleEditSaved = () => {
    setShowSaved(false);
    setEditing(true);
  };

  const handleSubmitPress = () => {
    if (!name.trim() || !phone.trim()) { alert('الرجاء إدخال الاسم ورقم الهاتف'); return; }
    if (items.length === 0) { alert('السلة فارغة'); return; }
    if (!locationConfirmed) {
      pendingConfirmRef.current = true;
      openMap();
      return;
    }
    if (!locationDesc.trim()) { alert('الرجاء كتابة وصف عنوانك'); return; }
    setShowConfirmModal(true);
  };

  const submitOrder = async () => {
    setLoading(true);
    saveInfo({ name: name.trim(), phone: phone.trim(), locationDesc: locationDesc.trim() });

    const { data: order, error } = await supabase.from('orders').insert([{
      client_name: name.trim(), client_phone: phone.trim(),
      delivery_address: locationDesc.trim() || null,
      client_note: note.trim() || null,
      total_amount: total, status: 'pending',
      ...(clientLat !== null && clientLng !== null ? { client_lat: clientLat, client_lng: clientLng } : {}),
    }]).select().single();

    if (error || !order) { alert('حدث خطأ، حاول مجدداً'); setLoading(false); return; }

    await supabase.from('order_items').insert(
      items.map(i => ({ order_id: order.id, item_name: i.name, quantity: i.quantity, price: i.price }))
    );

    localStorage.setItem('lastOrderId', order.id);
    clearCart();
    setLoading(false);
    router.push('/track');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-center" style={{ color: brandColor }}>سلة المشتريات</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* ── عناصر السلة ── */}
        <div>
          {items.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-slate-500 mt-16">السلة فارغة</p>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 flex items-center justify-between">
                  <button onClick={() => removeItem(item.id)} className="p-2 bg-red-50 dark:bg-red-900/20 rounded-full text-red-400 active:scale-90">
                    <Trash2 size={16}/>
                  </button>
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-slate-100">{item.name}</p>
                      <p className="text-sm" style={{ color: brandColor }}>{item.price.toLocaleString()} د.ع</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-slate-700 px-3 py-1.5 rounded-xl">
                      <span className="font-bold text-gray-700 dark:text-slate-300">{item.quantity}×</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── فورم معلومات الطلب ── */}
        {editing && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-3">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right">معلومات الطلب</h3>

            {/* الاسم */}
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="الاسم *" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
            />

            {/* رقم الهاتف */}
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="رقم الهاتف *" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
            />

            {/* زر الخريطة */}
            {locationConfirmed ? (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between mt-1"
                style={{ backgroundColor: `${brandColor}12`, borderWidth: 1, borderStyle: 'solid', borderColor: `${brandColor}40` }}>
                <button type="button" onClick={() => { setLocationConfirmed(false); openMap(); }}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-400 active:scale-90 transition-all">
                  <RefreshCw size={12} /> تغيير
                </button>
                <span className="font-semibold text-sm flex items-center gap-1.5" style={{ color: brandColor }}>
                  <CheckCircle2 size={16} /> تم تحديد موقعك
                </span>
              </div>
            ) : (
              <button type="button" onClick={openMap}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                style={{ backgroundColor: '#ef444415', color: '#ef4444', borderWidth: 1.5, borderStyle: 'solid', borderColor: '#ef444450' }}>
                <MapPin size={17} />
                اضغط هنا لتحديد الموقع
              </button>
            )}

            {/* وصف العنوان — يظهر فقط بعد تحديد الموقع */}
            <AnimatePresence>
            {locationConfirmed && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}>
                <input type="text" value={locationDesc} onChange={e => setLocationDesc(e.target.value)}
                  placeholder="وصف عنوانك (حي، شارع، علامة مميزة...) *" dir="rtl"
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2"
                  style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                />
              </motion.div>
            )}
            </AnimatePresence>

            {/* ملاحظات */}
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="ملاحظات للمطبخ — مثل: بدون بصل، بدون ثوم، حار جداً، إلخ (اختياري)" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
            />
          </div>
        )}

        {/* ── الإجمالي + زر الإرسال ── */}
        <div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 flex justify-between items-center mb-4">
            <span className="font-bold text-xl" style={{ color: brandColor }}>{total.toLocaleString()} د.ع</span>
            <span className="font-bold text-gray-900 dark:text-slate-100">الإجمالي</span>
          </div>
          {editing && (
            <button ref={submitBtnRef} onClick={handleSubmitPress} disabled={items.length === 0}
              className="w-full disabled:opacity-40 font-bold py-4 rounded-xl text-lg transition-all active:scale-95"
              style={{ backgroundColor: brandColor, color: textOnBrand }}>
              إرسال الطلب
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          نافذة المعلومات المحفوظة
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showSaved && items.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-center mb-4">
              <UserCircle size={40} style={{ color: brandColor }}/>
            </div>
            <h3 className="text-lg font-bold text-center mb-1" style={{ color: brandColor }}>معلوماتك المحفوظة</h3>
            <p className="text-gray-400 dark:text-slate-500 text-center text-sm mb-5">هل تريد استخدام نفس المعلومات؟</p>

            <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 space-y-3 mb-5 text-right">
              <div className="flex justify-between items-center">
                <span className="text-gray-900 dark:text-slate-100 font-semibold">{name}</span>
                <span className="text-gray-400 dark:text-slate-500 text-sm">الاسم</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-100 dark:border-slate-600 pt-3">
                <span className="font-bold tracking-widest" style={{ color: brandColor }}>{phone}</span>
                <span className="text-gray-400 dark:text-slate-500 text-sm">الهاتف</span>
              </div>
              {locationDesc && (
                <div className="flex justify-between items-center border-t border-gray-100 dark:border-slate-600 pt-3">
                  <span className="text-gray-900 dark:text-slate-100 font-semibold text-sm">{locationDesc}</span>
                  <span className="text-gray-400 dark:text-slate-500 text-sm">الموقع</span>
                </div>
              )}
            </div>

            <button onClick={handleConfirmSaved}
              className="w-full font-bold py-3.5 rounded-xl mb-3 transition-all active:scale-95"
              style={{ backgroundColor: brandColor, color: textOnBrand }}>
              نعم، أكمل الطلب
            </button>
            <button onClick={handleEditSaved}
              className="w-full border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95">
              <Pencil size={15}/> تعديل المعلومات
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          نافذة تأكيد الطلب (خريطة + عنوان + هاتف)
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showConfirmModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="w-full bg-white dark:bg-slate-900 rounded-t-3xl overflow-hidden">

            {/* Drag pill */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-slate-700">
              <button onClick={() => setShowConfirmModal(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 active:scale-90">
                <X size={17}/>
              </button>
              <p className="font-bold text-gray-900 dark:text-slate-100">تأكيد طلبك</p>
              <div className="w-9"/>
            </div>

            {/* Mini map */}
            {clientLat && clientLng && (
              <div style={{ height: 200, position: 'relative' }}>
                <div ref={confirmMapRef} style={{ position: 'absolute', inset: 0 }} />
              </div>
            )}

            {/* Info */}
            <div className="px-5 pt-4 pb-2 space-y-3">
              <div className="flex items-start gap-3 rounded-xl p-3.5 text-right"
                style={{ backgroundColor: `${brandColor}10`, borderWidth: 1, borderStyle: 'solid', borderColor: `${brandColor}30` }}>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">العنوان</p>
                  <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm leading-relaxed">{locationDesc || '—'}</p>
                </div>
                <MapPin size={18} className="mt-0.5 flex-shrink-0" style={{ color: brandColor }}/>
              </div>

              <div className="flex items-center gap-3 rounded-xl p-3.5 text-right"
                style={{ backgroundColor: `${brandColor}10`, borderWidth: 1, borderStyle: 'solid', borderColor: `${brandColor}30` }}>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">رقم الهاتف</p>
                  <p className="font-bold tracking-widest" style={{ color: brandColor }}>{phone}</p>
                </div>
                <Phone size={18} className="flex-shrink-0" style={{ color: brandColor }}/>
              </div>
            </div>

            {/* Buttons */}
            <div className="px-5 pt-3 pb-8 space-y-3">
              <button onClick={submitOrder} disabled={loading}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`, color: textOnBrand, boxShadow: `0 8px 24px ${brandColor}50` }}>
                {loading ? <Loader2 size={20} className="animate-spin"/> : <CheckCircle2 size={20}/>}
                {loading ? 'جاري الإرسال...' : 'تأكيد وإرسال الطلب'}
              </button>
              <button onClick={() => setShowConfirmModal(false)} disabled={loading}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 transition-all active:scale-95">
                تعديل
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          نافذة الموقع الدقيق
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showPreciseModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="w-full bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-4 pb-8">
            <div className="flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700"/></div>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-amber-50 dark:bg-amber-900/20">
                <span className="text-3xl">🎯</span>
              </div>
            </div>
            <h3 className="text-center font-bold text-lg text-gray-900 dark:text-slate-100 mb-1">الموقع الدقيق غير مفعّل</h3>
            <p className="text-center text-sm text-gray-500 dark:text-slate-400 mb-5">جهازك يستخدم <strong>الموقع التقريبي</strong> مما يسبب خطأ كبير في التحديد</p>
            <div className="mb-3">
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-2 text-right">iPhone (iOS)</p>
              <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 space-y-2.5 text-right">
                <div className="flex items-center gap-3"><span className="text-base">⚙️</span><p className="text-sm text-gray-700 dark:text-slate-300">الإعدادات ← الخصوصية والأمان ← خدمات الموقع</p></div>
                <div className="flex items-center gap-3 border-t border-gray-200 dark:border-slate-700 pt-2.5"><span className="text-base">🌐</span><p className="text-sm text-gray-700 dark:text-slate-300">اختر Safari أو اسم المتصفح</p></div>
                <div className="flex items-center gap-3 border-t border-gray-200 dark:border-slate-700 pt-2.5"><span className="text-base">🎯</span><p className="text-sm text-gray-700 dark:text-slate-300">فعّل <strong>"الموقع الدقيق"</strong></p></div>
              </div>
            </div>
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-2 text-right">Android</p>
              <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 space-y-2.5 text-right">
                <div className="flex items-center gap-3"><span className="text-base">⚙️</span><p className="text-sm text-gray-700 dark:text-slate-300">الإعدادات ← الموقع ← إذونات التطبيقات</p></div>
                <div className="flex items-center gap-3 border-t border-gray-200 dark:border-slate-700 pt-2.5"><span className="text-base">🌐</span><p className="text-sm text-gray-700 dark:text-slate-300">اختر اسم المتصفح</p></div>
                <div className="flex items-center gap-3 border-t border-gray-200 dark:border-slate-700 pt-2.5"><span className="text-base">🎯</span><p className="text-sm text-gray-700 dark:text-slate-300">فعّل <strong>"الموقع الدقيق"</strong></p></div>
              </div>
            </div>
            <button onClick={() => setShowPreciseModal(false)}
              className="w-full py-4 rounded-2xl font-bold text-base mb-3 transition-all active:scale-95"
              style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`, color: textOnBrand, boxShadow: `0 8px 24px ${brandColor}50` }}>
              فعّلته — أعد المحاولة
            </button>
            <button onClick={() => setShowPreciseModal(false)}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 transition-all active:scale-95">
              تحديد موقعي يدوياً على الخريطة
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          نافذة إذن الموقع
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showPermissionModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="w-full bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-4 pb-8">
            <div className="flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700"/></div>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
                <MapPin size={30} style={{ color: brandColor }}/>
              </div>
            </div>
            <h3 className="text-center font-bold text-lg text-gray-900 dark:text-slate-100 mb-1">الموقع غير مفعّل</h3>
            <p className="text-center text-sm text-gray-500 dark:text-slate-400 mb-6">يجب السماح للموقع بالوصول لموقعك لتحديده على الخريطة</p>
            <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 mb-5 space-y-3 text-right">
              <div className="flex items-start gap-3"><span className="text-lg leading-none mt-0.5">🔒</span><p className="text-sm text-gray-700 dark:text-slate-300">اضغط على أيقونة القفل أو ℹ️ في شريط العنوان أعلى المتصفح</p></div>
              <div className="flex items-start gap-3 border-t border-gray-200 dark:border-slate-700 pt-3"><span className="text-lg leading-none mt-0.5">📍</span><p className="text-sm text-gray-700 dark:text-slate-300">اختر <strong>"الموقع"</strong> أو <strong>"Location"</strong></p></div>
              <div className="flex items-start gap-3 border-t border-gray-200 dark:border-slate-700 pt-3"><span className="text-lg leading-none mt-0.5">✅</span><p className="text-sm text-gray-700 dark:text-slate-300">اختر <strong>"السماح"</strong> أو <strong>"Allow"</strong></p></div>
            </div>
            <button onClick={() => { setShowPermissionModal(false); doOpenMap(); }}
              className="w-full py-4 rounded-2xl font-bold text-base mb-3 transition-all active:scale-95"
              style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`, color: textOnBrand, boxShadow: `0 8px 24px ${brandColor}50` }}>
              فعّلت الموقع — أعد المحاولة
            </button>
            <button onClick={() => { setShowPermissionModal(false); doOpenMap(); }}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 transition-all active:scale-95">
              تحديد موقعي يدوياً على الخريطة
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          نافذة الخريطة الكاملة
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showMap && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>

          <style>{`
            @keyframes pin-pulse  { 0%   { transform:translate(-50%,0) scale(1);           opacity:.55; } 100% { transform:translate(-50%,0) scale(3.5); opacity:0; } }
            @keyframes pin-bounce { 0%,100% { transform:translate(-50%,-100%) translateY(0); } 45% { transform:translate(-50%,-100%) translateY(-8px); } }
          `}</style>

          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="flex flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-slate-900"
            style={{ height: '92vh' }}>

            <div className="flex justify-center pt-3 pb-0.5 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700"/>
            </div>

            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
              <button type="button" onClick={closeMap}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 active:scale-90 transition-all">
                <X size={17}/>
              </button>
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-slate-100" style={{ fontSize: 15 }}>تحديد موقع التوصيل</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {gpsLocating ? 'جاري تحديد موقعك...' : 'حرّك الخريطة لضبط الدبوس'}
                </p>
              </div>
              <div className="w-9"/>
            </div>

            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <div ref={locationMapRef} style={{ position: 'absolute', inset: 0 }}/>

              <div style={{ position:'absolute', top:'50%', left:'50%', width:18, height:18, borderRadius:'50%', background:'#ef4444', animation:'pin-pulse 2s ease-out infinite', zIndex:999, pointerEvents:'none' }}/>

              <div style={{ position:'absolute', top:'50%', left:'50%', animation:'pin-bounce 2.4s ease-in-out infinite', pointerEvents:'none', zIndex:1000, transform:'translate(-50%, -100%)' }}>
                <div style={{ width:42, height:42, background:'#ef4444', borderRadius:'50% 50% 50% 0', transform:'rotate(-45deg)', border:'3.5px solid white', boxShadow:'0 6px 20px #ef444470, 0 2px 8px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:11, height:11, background:'white', borderRadius:'50%', transform:'rotate(45deg)', opacity:0.9 }}/>
                </div>
              </div>

              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, 4px)', width:14, height:6, background:'rgba(0,0,0,0.18)', borderRadius:'50%', pointerEvents:'none', zIndex:999, filter:'blur(2px)' }}/>

              {(gpsLocating || gpsAccuracy !== null) && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 rounded-full px-4 py-2 shadow-xl text-xs font-bold"
                  style={{ background:'white', boxShadow:'0 4px 20px rgba(0,0,0,0.15)',
                    color: gpsAccuracy !== null && gpsAccuracy <= 50 ? '#16a34a' : gpsAccuracy !== null && gpsAccuracy <= 300 ? '#d97706' : brandColor }}>
                  {gpsLocating && gpsAccuracy === null
                    ? <><Loader2 size={13} className="animate-spin"/> جاري تحديد موقعك...</>
                    : gpsLocating && gpsAccuracy !== null
                      ? <><Loader2 size={13} className="animate-spin"/> جاري تحسين الدقة... {gpsAccuracy >= 1000 ? `${(gpsAccuracy/1000).toFixed(1)}كم` : `${gpsAccuracy}م`}</>
                    : gpsAccuracy !== null && gpsAccuracy <= 100
                      ? <><CheckCircle2 size={13}/> دقة ممتازة — {gpsAccuracy}م</>
                      : <><MapPin size={13}/> دقة: {gpsAccuracy !== null && gpsAccuracy >= 1000 ? `${(gpsAccuracy/1000).toFixed(1)}كم` : `${gpsAccuracy}م`}</>
                  }
                </div>
              )}

              <button type="button" onClick={locateMe}
                className="absolute bottom-4 right-4 z-[1000] rounded-full flex items-center justify-center active:scale-90 transition-all"
                style={{ width:50, height:50, background:'white', boxShadow:'0 4px 16px rgba(0,0,0,0.18)', border:'2px solid #ef444430' }}>
                {gpsLocating
                  ? <Loader2 size={22} className="animate-spin" style={{ color: '#ef4444' }}/>
                  : <LocateFixed size={22} style={{ color: '#ef4444' }}/>
                }
              </button>
            </div>

            <div className="px-4 pt-3 pb-7 flex-shrink-0 bg-white dark:bg-slate-900" style={{ boxShadow:'0 -1px 0 rgba(0,0,0,0.06)' }}>
              {gpsAccuracy !== null && gpsAccuracy > 500 && (
                <div className="flex items-start gap-2 mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2.5 text-right">
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed flex-1">الدقة ضعيفة — فعّل GPS الجهاز أو تحرك للخارج، أو حرّك الخريطة يدوياً لموقعك الصحيح</p>
                  <span className="text-lg">⚠️</span>
                </div>
              )}
              <button type="button" onClick={confirmLocation}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{ background:'linear-gradient(135deg, #ef4444, #dc2626)', color:'#ffffff', boxShadow:'0 8px 24px #ef444450' }}>
                <CheckCircle2 size={20}/> تأكيد الموقع
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <ClientBottomNav />
    </div>
  );
}
