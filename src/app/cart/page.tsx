'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { Trash2, MapPin, ChevronDown, UserCircle, Pencil, LocateFixed, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '@/context/SettingsContext';
import { useDarkMode } from '@/context/ThemeContext';

const KEYS = {
  name:     'deliveryName',
  phone:    'deliveryPhone',
  district: 'deliveryDistrict',
  address:  'deliveryAddress',
};

const BASRA_CENTER: [number, number] = [30.5085, 47.7804];

const BASRA_DISTRICTS = [
  { id: 'ashar',      name: 'العشار',      desc: 'قلب البصرة التجاري والاقتصادي' },
  { id: 'maqal',      name: 'المعقل',      desc: 'حي راقٍ شمال البصرة على ضفاف شط العرب' },
  { id: 'qibla',      name: 'القبلة',      desc: 'الحي التاريخي العريق وسط المدينة' },
  { id: 'jazira',     name: 'الجزيرة',     desc: 'منطقة هادئة بين الأنهار قريبة من المركز' },
  { id: 'asmai',      name: 'الأصمعي',     desc: 'حي سكني شعبي غرب مركز المدينة' },
  { id: 'jazayer',    name: 'الجزائر',     desc: 'حي شعبي بين العشار والمعقل' },
  { id: 'haritha',    name: 'الهارثة',     desc: 'شمال البصرة على ضفاف شط العرب' },
  { id: 'zubayr',     name: 'الزبير',      desc: 'قضاء تاريخي جنوب غرب البصرة' },
  { id: 'abu_khasib', name: 'أبو الخصيب', desc: 'جنوب البصرة، منطقة النخيل والأنهار الجميلة' },
  { id: 'tanuma',     name: 'التنومة',     desc: 'حي شرق البصرة بالقرب من أبو الخصيب' },
  { id: 'qurna',      name: 'القرنة',      desc: 'شمال البصرة عند ملتقى دجلة والفرات' },
  { id: 'faw',        name: 'الفاو',       desc: 'أقصى جنوب البصرة على الخليج العربي' },
  { id: 'madina',     name: 'المدينة',     desc: 'المنطقة الإدارية والمركزية في البصرة' },
  { id: 'khor',       name: 'خور الزبير', desc: 'منطقة صناعية وميناء جنوب الزبير' },
] as const;

type SavedInfo = { name: string; phone: string; district: string; address: string };

function loadSaved(): SavedInfo | null {
  const name  = localStorage.getItem(KEYS.name)  || '';
  const phone = localStorage.getItem(KEYS.phone) || '';
  if (!name || !phone) return null;
  return {
    name,
    phone,
    district: localStorage.getItem(KEYS.district) || '',
    address:  localStorage.getItem(KEYS.address)  || '',
  };
}

function saveInfo(info: SavedInfo) {
  localStorage.setItem(KEYS.name,     info.name);
  localStorage.setItem(KEYS.phone,    info.phone);
  localStorage.setItem(KEYS.district, info.district);
  localStorage.setItem(KEYS.address,  info.address);
}

export default function CartPage() {
  const { items, removeItem, clearCart, total } = useCart();
  const { primary_color } = useSettings();
  const { dark } = useDarkMode();
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

  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [district, setDistrict] = useState('');
  const [address,  setAddress]  = useState('');
  const [note,     setNote]     = useState('');

  // modal states
  const [showSaved,   setShowSaved]   = useState(false); // نافذة المعلومات المحفوظة
  const [showConfirm, setShowConfirm] = useState(false); // نافذة تأكيد الهاتف
  const [editing,     setEditing]     = useState(false); // وضع التعديل

  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const [clientLat, setClientLat] = useState<number | null>(null);
  const [clientLng, setClientLng] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [gpsLocating, setGpsLocating] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const locationMapRef = useRef<HTMLDivElement>(null);
  const locationMapInstanceRef = useRef<any>(null);
  const pendingFlyRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const pendingSubmitRef = useRef(false);
  const gpsWatchRef = useRef<number | null>(null);
  const gpsStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopGpsWatch = () => {
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    if (gpsStopTimerRef.current) {
      clearTimeout(gpsStopTimerRef.current);
      gpsStopTimerRef.current = null;
    }
  };

  const closeMap = () => {
    stopGpsWatch();
    if (locationMapInstanceRef.current) {
      locationMapInstanceRef.current.remove();
      locationMapInstanceRef.current = null;
    }
    pendingFlyRef.current = null;
    pendingSubmitRef.current = false;
    setShowMap(false);
    setLocationConfirmed(false);
    setClientLat(null);
    setClientLng(null);
    setGpsLocating(false);
    setGpsAccuracy(null);
  };

  const confirmLocation = () => {
    stopGpsWatch();
    if (locationMapInstanceRef.current) {
      locationMapInstanceRef.current.remove();
      locationMapInstanceRef.current = null;
    }
    pendingFlyRef.current = null;
    setShowMap(false);
    setLocationConfirmed(true);
    setGpsLocating(false);
    setGpsAccuracy(null);
    if (pendingSubmitRef.current) {
      pendingSubmitRef.current = false;
      submitOrder();
    } else {
      setTimeout(() => submitBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }
  };

  const startGpsWatch = (onPosition: (lat: number, lng: number, accuracy: number) => void) => {
    stopGpsWatch();
    setGpsLocating(true);
    setGpsAccuracy(null);
    if (!('geolocation' in navigator)) { setGpsLocating(false); return; }

    let bestAccuracy = Infinity;

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(Math.round(accuracy));
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          onPosition(latitude, longitude, accuracy);
        }
        if (accuracy <= 30) {
          stopGpsWatch();
          setGpsLocating(false);
        }
      },
      (err) => {
        setGpsLocating(false);
        if (err.code === 1) { // PERMISSION_DENIED
          setShowPermissionModal(true);
          setShowMap(false);
        }
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
      .then((result: PermissionStatus) => {
        if (result.state === 'denied') { setShowPermissionModal(true); }
        else { doOpenMap(); }
      })
      .catch(() => doOpenMap()); // المتصفح لا يدعم permissions API — افتح مباشرة
  };

  // load Leaflet CSS once — never remove it so tiles don't flash
  useEffect(() => {
    if (document.querySelector('link[data-leaflet-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.setAttribute('data-leaflet-css', '1');
    document.head.appendChild(link);
  }, []);

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

        map.on('moveend', () => {
          const c = map.getCenter();
          setClientLat(c.lat);
          setClientLng(c.lng);
        });

        if (pendingFlyRef.current) {
          const { lat, lng, accuracy } = pendingFlyRef.current;
          const zoom = accuracy < 100 ? 17 : accuracy < 500 ? 16 : accuracy < 2000 ? 14 : 13;
          map.setView([lat, lng], zoom);
          pendingFlyRef.current = null;
        }
      });
    }, 80);
    return () => {
      clearTimeout(t);
      if (locationMapInstanceRef.current) {
        locationMapInstanceRef.current.remove();
        locationMapInstanceRef.current = null;
      }
    };
  }, [showMap]);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setName(saved.name);
      setPhone(saved.phone);
      setDistrict(saved.district);
      setAddress(saved.address);
      setShowSaved(true); // فيه معلومات محفوظة → شوّل النافذة
    } else {
      setEditing(true); // أول مرة → شوّل الفورم مباشرة
    }
  }, []);

  const selectedDistrict = BASRA_DISTRICTS.find(d => d.id === district);

  const fullAddress = selectedDistrict
    ? `${selectedDistrict.name}${address.trim() ? ' — ' + address.trim() : ''}`
    : address.trim() || null;

  const handleConfirmSaved = () => {
    if (items.length === 0) { alert('السلة فارغة'); return; }
    setShowSaved(false);
    pendingSubmitRef.current = true;
    openMap();
  };

  const handleEditSaved = () => {
    setShowSaved(false);
    setEditing(true);
  };

  const handleConfirmForm = () => {
    if (!name.trim() || !phone.trim()) { alert('الرجاء إدخال الاسم ورقم الهاتف'); return; }
    if (items.length === 0) { alert('السلة فارغة'); return; }
    if (!locationConfirmed) {
      pendingSubmitRef.current = true;
      openMap();
      return;
    }
    submitOrder();
  };

  const submitOrder = async () => {
    setLoading(true);
    saveInfo({ name: name.trim(), phone: phone.trim(), district, address: address.trim() });

    const { data: order, error } = await supabase.from('orders').insert([{
      client_name: name.trim(), client_phone: phone.trim(),
      delivery_address: fullAddress, client_note: note.trim() || null,
      total_amount: total, status: 'pending',
      ...(clientLat !== null && clientLng !== null ? { client_lat: clientLat, client_lng: clientLng } : {}),
    }]).select().single();

    if (error || !order) { alert('حدث خطأ، حاول مجدداً'); setLoading(false); return; }

    await supabase.from('order_items').insert(
      items.map(i => ({ order_id: order.id, item_name: i.name, quantity: i.quantity, price: i.price }))
    );

    localStorage.setItem('lastOrderId', order.id);
    clearCart();
    setShowConfirm(false);
    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center pb-24">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">تم إرسال طلبك!</h2>
          <p className="text-gray-500 dark:text-slate-400 mb-6">سيتم التواصل معك قريباً</p>
          <Link href="/track" className="font-bold px-6 py-3 rounded-xl inline-block" style={{ backgroundColor: brandColor, color: textOnBrand }}>تتبع طلبك</Link>
        </div>
        <ClientBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-center" style={{ color: brandColor }}>سلة المشتريات</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Items */}
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

        {/* فورم التعديل — يظهر فقط إذا ما فيه معلومات محفوظة أو المستخدم يريد التعديل */}
        {editing && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-3">معلومات الطلب</h3>

            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="الاسم *" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 mb-3"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
            />
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="رقم الهاتف *" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 mb-3"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
            />

            {/* District picker */}
            <div className="mb-3">
              <div className="relative">
                <select value={district} onChange={e => setDistrict(e.target.value)} dir="rtl"
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 appearance-none"
                  style={{ '--tw-ring-color': brandColor } as React.CSSProperties}>
                  <option value="">اختر منطقة التوصيل</option>
                  {BASRA_DISTRICTS.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
              </div>
              {selectedDistrict && (
                <div className="mt-2 rounded-xl px-4 py-2.5 flex items-center gap-2.5" style={{ backgroundColor: `${brandColor}15`, borderWidth: 1, borderStyle: 'solid', borderColor: `${brandColor}40` }}>
                  <MapPin size={14} className="flex-shrink-0" style={{ color: brandColor }}/>
                  <p className="text-sm text-gray-600 dark:text-slate-400 text-right flex-1">{selectedDistrict.desc}</p>
                </div>
              )}
            </div>

            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="تفاصيل العنوان (شارع، زقاق...)" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 mb-3"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
            />
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="ملاحظات (اختياري)" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
            />

            {/* GPS location */}
            {locationConfirmed ? (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: `${brandColor}12`, borderWidth: 1, borderStyle: 'solid', borderColor: `${brandColor}40` }}>
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
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed font-semibold text-sm transition-all active:scale-95"
                style={{ borderColor: `${brandColor}60`, color: brandColor }}>
                <LocateFixed size={16} /> 📍 تحديد موقعك على الخارطة
              </button>
            )}
          </div>
        )}

        {/* Total + Button */}
        <div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 flex justify-between items-center mb-4">
            <span className="font-bold text-xl" style={{ color: brandColor }}>{total.toLocaleString()} د.ع</span>
            <span className="font-bold text-gray-900 dark:text-slate-100">الإجمالي</span>
          </div>
          {editing && (
            <button ref={submitBtnRef} onClick={handleConfirmForm} disabled={items.length === 0}
              className="w-full disabled:opacity-40 font-bold py-4 rounded-xl text-lg transition-all active:scale-95"
              style={{ backgroundColor: brandColor, color: textOnBrand }}>
              تأكيد الطلب
            </button>
          )}
        </div>
      </div>

      {/* ── نافذة المعلومات المحفوظة ── */}
      <AnimatePresence>
      {showSaved && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
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
              {selectedDistrict && (
                <div className="flex justify-between items-center border-t border-gray-100 dark:border-slate-600 pt-3">
                  <span className="text-gray-900 dark:text-slate-100 font-semibold">{selectedDistrict.name}</span>
                  <span className="text-gray-400 dark:text-slate-500 text-sm">المنطقة</span>
                </div>
              )}
              {address && (
                <div className="flex justify-between items-center border-t border-gray-100 dark:border-slate-600 pt-3">
                  <span className="text-gray-900 dark:text-slate-100 font-semibold text-sm">{address}</span>
                  <span className="text-gray-400 dark:text-slate-500 text-sm">العنوان</span>
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
              <Pencil size={15}/>
              تعديل المعلومات
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── نافذة إذن الموقع ── */}
      <AnimatePresence>
      {showPermissionModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="w-full bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-4 pb-8">

            {/* Drag pill */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700" />
            </div>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
                <MapPin size={30} style={{ color: brandColor }} />
              </div>
            </div>

            <h3 className="text-center font-bold text-lg text-gray-900 dark:text-slate-100 mb-1">الموقع غير مفعّل</h3>
            <p className="text-center text-sm text-gray-500 dark:text-slate-400 mb-6">يجب السماح للموقع بالوصول لموقعك لتحديده على الخريطة</p>

            {/* Steps */}
            <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 mb-5 space-y-3 text-right">
              <div className="flex items-start gap-3">
                <span className="text-lg leading-none mt-0.5">🔒</span>
                <p className="text-sm text-gray-700 dark:text-slate-300">اضغط على أيقونة القفل أو ℹ️ في شريط العنوان أعلى المتصفح</p>
              </div>
              <div className="flex items-start gap-3 border-t border-gray-200 dark:border-slate-700 pt-3">
                <span className="text-lg leading-none mt-0.5">📍</span>
                <p className="text-sm text-gray-700 dark:text-slate-300">اختر <strong>"الموقع"</strong> أو <strong>"Location"</strong></p>
              </div>
              <div className="flex items-start gap-3 border-t border-gray-200 dark:border-slate-700 pt-3">
                <span className="text-lg leading-none mt-0.5">✅</span>
                <p className="text-sm text-gray-700 dark:text-slate-300">اختر <strong>"السماح"</strong> أو <strong>"Allow"</strong></p>
              </div>
            </div>

            <button
              onClick={() => { setShowPermissionModal(false); doOpenMap(); }}
              className="w-full py-4 rounded-2xl font-bold text-base mb-3 transition-all active:scale-95"
              style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`, color: textOnBrand, boxShadow: `0 8px 24px ${brandColor}50` }}>
              فعّلت الموقع — أعد المحاولة
            </button>
            <button
              onClick={() => { setShowPermissionModal(false); doOpenMap(); }}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 transition-all active:scale-95">
              تحديد موقعي يدوياً على الخريطة
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── نافذة الخريطة المنفصلة ── */}
      <AnimatePresence>
      {showMap && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>

          <style>{`
            @keyframes pin-pulse { 0% { transform:translate(-50%,0) scale(1); opacity:.55; } 100% { transform:translate(-50%,0) scale(3.5); opacity:0; } }
            @keyframes pin-bounce { 0%,100% { transform:translate(-50%,-100%) translateY(0); } 45% { transform:translate(-50%,-100%) translateY(-8px); } }
          `}</style>

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="flex flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-slate-900"
            style={{ height: '92vh' }}>

            {/* Drag pill */}
            <div className="flex justify-center pt-3 pb-0.5 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
              <button type="button" onClick={closeMap}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 active:scale-90 transition-all">
                <X size={17} />
              </button>
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-slate-100" style={{ fontSize: 15 }}>تحديد موقع التوصيل</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {gpsLocating ? 'جاري تحديد موقعك...' : 'حرّك الخريطة لضبط الدبوس'}
                </p>
              </div>
              <div className="w-9" />
            </div>

            {/* Map area */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <div ref={locationMapRef} style={{ position: 'absolute', inset: 0 }} />

              {/* Pulsing ring under pin */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                width: 18, height: 18, borderRadius: '50%',
                background: brandColor,
                animation: 'pin-pulse 2s ease-out infinite',
                zIndex: 999, pointerEvents: 'none',
              }} />

              {/* Pin */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                animation: 'pin-bounce 2.4s ease-in-out infinite',
                pointerEvents: 'none', zIndex: 1000,
                transform: 'translate(-50%, -100%)',
              }}>
                <div style={{
                  width: 42, height: 42,
                  background: brandColor,
                  borderRadius: '50% 50% 50% 0',
                  transform: 'rotate(-45deg)',
                  border: '3.5px solid white',
                  boxShadow: `0 6px 20px ${brandColor}70, 0 2px 8px rgba(0,0,0,0.25)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: 11, height: 11, background: 'white', borderRadius: '50%', transform: 'rotate(45deg)', opacity: 0.9 }} />
                </div>
              </div>

              {/* Pin shadow */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, 4px)',
                width: 14, height: 6,
                background: 'rgba(0,0,0,0.18)',
                borderRadius: '50%',
                pointerEvents: 'none', zIndex: 999,
                filter: 'blur(2px)',
              }} />

              {/* GPS status toast */}
              {(gpsLocating || gpsAccuracy !== null) && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 rounded-full px-4 py-2 shadow-xl text-xs font-bold"
                  style={{ background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    color: gpsAccuracy !== null && gpsAccuracy <= 50 ? '#16a34a' : gpsAccuracy !== null && gpsAccuracy <= 300 ? '#d97706' : brandColor }}>
                  {gpsLocating && gpsAccuracy === null
                    ? <><Loader2 size={13} className="animate-spin" /> جاري تحديد موقعك...</>
                    : gpsLocating && gpsAccuracy !== null
                      ? <><Loader2 size={13} className="animate-spin" /> جاري تحسين الدقة... {gpsAccuracy >= 1000 ? `${(gpsAccuracy/1000).toFixed(1)}كم` : `${gpsAccuracy}م`}</>
                    : gpsAccuracy !== null && gpsAccuracy <= 100
                      ? <><CheckCircle2 size={13} /> دقة ممتازة — {gpsAccuracy}م</>
                      : <><MapPin size={13} /> دقة: {gpsAccuracy !== null && gpsAccuracy >= 1000 ? `${(gpsAccuracy/1000).toFixed(1)}كم` : `${gpsAccuracy}م`}</>
                  }
                </div>
              )}

              {/* GPS FAB */}
              <button type="button" onClick={locateMe}
                className="absolute bottom-4 right-4 z-[1000] w-13 h-13 rounded-full flex items-center justify-center active:scale-90 transition-all"
                style={{
                  width: 50, height: 50,
                  background: 'white',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  border: `2px solid ${brandColor}30`,
                }}>
                {gpsLocating
                  ? <Loader2 size={22} className="animate-spin" style={{ color: brandColor }} />
                  : <LocateFixed size={22} style={{ color: brandColor }} />
                }
              </button>
            </div>

            {/* Bottom bar */}
            <div className="px-4 pt-3 pb-7 flex-shrink-0 bg-white dark:bg-slate-900"
              style={{ boxShadow: '0 -1px 0 rgba(0,0,0,0.06)' }}>
              {gpsAccuracy !== null && gpsAccuracy > 500 && (
                <div className="flex items-start gap-2 mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2.5 text-right">
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed flex-1">
                    الدقة ضعيفة — فعّل GPS الجهاز أو تحرك للخارج، أو حرّك الخريطة يدوياً لموقعك الصحيح
                  </p>
                  <span className="text-lg">⚠️</span>
                </div>
              )}
              <button type="button" onClick={confirmLocation}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`,
                  color: textOnBrand,
                  boxShadow: `0 8px 24px ${brandColor}50`,
                }}>
                <CheckCircle2 size={20} />
                تأكيد الموقع
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
