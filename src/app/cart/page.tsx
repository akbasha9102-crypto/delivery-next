'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { Trash2, MapPin, ChevronDown, UserCircle, Pencil, LocateFixed, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '@/context/SettingsContext';
import { useDarkMode } from '@/context/ThemeContext';

const KEYS = {
  name:     'deliveryName',
  phone:    'deliveryPhone',
  district: 'deliveryDistrict',
  address:  'deliveryAddress',
};

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
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const locationMapRef = useRef<HTMLDivElement>(null);
  const locationMapInstanceRef = useRef<any>(null);
  const locationMarkerRef = useRef<any>(null);
  const locationCircleRef = useRef<any>(null);
  const isUserMoveRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  };

  const shareLocation = () => {
    if (!('geolocation' in navigator)) { alert('المتصفح لا يدعم تحديد الموقع'); return; }
    stopWatch();
    setGpsLoading(true);
    setGpsAccuracy(null);
    isUserMoveRef.current = false;

    // إذا ما وصل لدقة جيدة خلال 45 ثانية، نوقف ونعرض أفضل موقع متاح
    fallbackTimerRef.current = setTimeout(() => {
      setGpsLoading(false);
      stopWatch();
    }, 45000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!isUserMoveRef.current) {
          setClientLat(latitude);
          setClientLng(longitude);
        }
        setGpsAccuracy(accuracy);
        // نعرض الخريطة بمجرد ما نحصل على أي موقع
        setGpsLoading(false);
        // نوقف المراقبة فقط عند دقة ممتازة (15م أو أقل)
        if (accuracy <= 50) {
          stopWatch();
        }
      },
      () => {
        alert('تعذّر تحديد موقعك — تأكد من السماح للمتصفح باستخدام الموقع');
        setGpsLoading(false);
        stopWatch();
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
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
    if (clientLat === null || clientLng === null) return;

    const init = () => {
      if (!locationMapRef.current) return;

      if (locationMapInstanceRef.current) {
        if (!isUserMoveRef.current) {
          locationMapInstanceRef.current.flyTo([clientLat, clientLng], locationMapInstanceRef.current.getZoom(), { animate: true, duration: 0.8 });
          locationMarkerRef.current?.setLatLng([clientLat, clientLng]);
          if (locationCircleRef.current && gpsAccuracy !== null) {
            locationCircleRef.current.setLatLng([clientLat, clientLng]);
            locationCircleRef.current.setRadius(gpsAccuracy);
          } else if (!locationCircleRef.current && gpsAccuracy !== null) {
            import('leaflet').then((mod) => {
              const L = (mod as any).default ?? mod;
              if (locationMapInstanceRef.current) {
                locationCircleRef.current = L.circle([clientLat, clientLng], {
                  radius: gpsAccuracy, color: brandColor, fillColor: brandColor,
                  fillOpacity: 0.1, weight: 1,
                }).addTo(locationMapInstanceRef.current);
              }
            });
          }
        }
        return;
      }

      import('leaflet').then((mod) => {
        const L = (mod as any).default ?? mod;
        if (!locationMapRef.current || locationMapInstanceRef.current) return;

        const map = L.map(locationMapRef.current, { zoomControl: true }).setView([clientLat, clientLng], 17);
        locationMapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap', maxZoom: 19,
        }).addTo(map);

        // Leaflet needs the container fully painted — call twice to handle slow layout
        setTimeout(() => map.invalidateSize({ pan: false }), 100);
        setTimeout(() => map.invalidateSize({ pan: false }), 500);

        const icon = L.divIcon({
          html: `<div style="width:34px;height:34px;background:${brandColor};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35)"></div>`,
          className: '', iconSize: [34, 34], iconAnchor: [17, 34],
        });

        if (gpsAccuracy !== null) {
          locationCircleRef.current = L.circle([clientLat, clientLng], {
            radius: gpsAccuracy, color: brandColor, fillColor: brandColor,
            fillOpacity: 0.1, weight: 1,
          }).addTo(map);
        }

        const marker = L.marker([clientLat, clientLng], { icon, draggable: true }).addTo(map)
          .bindPopup('<div dir="rtl" style="font-family:sans-serif;font-weight:bold">اسحب البن لتصحيح موقعك</div>', { offset: [0, -16] })
          .openPopup();

        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng();
          isUserMoveRef.current = true;
          stopWatch();
          setClientLat(lat);
          setClientLng(lng);
        });

        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          isUserMoveRef.current = true;
          stopWatch();
          setClientLat(e.latlng.lat);
          setClientLng(e.latlng.lng);
        });

        locationMarkerRef.current = marker;
      });
    };

    // small delay to ensure the div is mounted after state update
    const t = setTimeout(init, 80);
    return () => clearTimeout(t);
  }, [clientLat, clientLng, gpsAccuracy]);

  useEffect(() => () => stopWatch(), []);

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
    setShowConfirm(true);
  };

  const handleEditSaved = () => {
    setShowSaved(false);
    setEditing(true);
  };

  const handleConfirmForm = () => {
    if (!name.trim() || !phone.trim()) { alert('الرجاء إدخال الاسم ورقم الهاتف'); return; }
    if (items.length === 0) { alert('السلة فارغة'); return; }
    setShowConfirm(true);
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

            {/* GPS location — optional */}
            {clientLat !== null ? (
              <div className="rounded-xl overflow-hidden border-2" style={{ borderColor: `${brandColor}50` }}>
                <div className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor: `${brandColor}12` }}>
                  <button type="button" onClick={() => { stopWatch(); setClientLat(null); setClientLng(null); setGpsAccuracy(null); isUserMoveRef.current = false; if (locationMapInstanceRef.current) { locationMapInstanceRef.current.remove(); locationMapInstanceRef.current = null; locationMarkerRef.current = null; locationCircleRef.current = null; } }} className="flex items-center gap-1 text-xs font-semibold text-gray-400 active:scale-90 transition-all">
                    <RefreshCw size={12} /> تغيير
                  </button>
                  <span className="font-semibold text-sm flex items-center gap-1.5" style={{ color: gpsAccuracy !== null && !gpsLoading && gpsAccuracy > 50 ? '#f59e0b' : brandColor }}>
                    {gpsLoading
                      ? <><Loader2 size={14} className="animate-spin" /> جاري تحديد موقعك...</>
                      : gpsAccuracy !== null && watchIdRef.current !== null
                        ? <><Loader2 size={14} className="animate-spin" /> جاري تحسين الدقة ±{Math.round(gpsAccuracy)}م</>
                        : gpsAccuracy !== null && gpsAccuracy > 50
                          ? <><span className="text-amber-500">⚠</span> دقة ±{Math.round(gpsAccuracy)}م — صحّح موقعك بالسحب</>
                          : <><CheckCircle2 size={16} /> تم تحديد موقعك ±{gpsAccuracy !== null ? Math.round(gpsAccuracy) : ''}م</>
                    }
                  </span>
                </div>
                <div ref={locationMapRef} style={{ height: 200 }} />
                <p className="text-center text-xs text-gray-400 py-1.5">اسحب البن أو اضغط على الخريطة لتصحيح موقعك</p>
              </div>
            ) : (
              <button type="button" onClick={shareLocation} disabled={gpsLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
                style={{ borderColor: `${brandColor}60`, color: brandColor }}>
                {gpsLoading
                  ? <><Loader2 size={16} className="animate-spin" /> جاري تحديد موقعك...</>
                  : <><LocateFixed size={16} /> 📍 شارك موقعك على الخارطة (اختياري)</>
                }
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
            <button onClick={handleConfirmForm} disabled={items.length === 0}
              className="w-full disabled:opacity-40 font-bold py-4 rounded-xl text-lg transition-all active:scale-95"
              style={{ backgroundColor: brandColor, color: textOnBrand }}>
              تأكيد الطلب
            </button>
          )}
        </div>
      </div>

      {/* ── نافذة المعلومات المحفوظة ── */}
      <AnimatePresence>
      {showSaved && (
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

      {/* ── نافذة تأكيد الهاتف ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-center mb-2" style={{ color: brandColor }}>تأكيد رقم الهاتف</h3>
            <p className="text-gray-500 dark:text-slate-400 text-center text-sm mb-5">تأكد أن رقمك صحيح قبل الإرسال</p>
            <div className="rounded-xl p-4 text-center mb-5 border-2" style={{ backgroundColor: `${brandColor}15`, borderColor: brandColor }}>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">رقم هاتفك</p>
              <p className="text-2xl font-bold tracking-widest" style={{ color: brandColor }}>{phone}</p>
            </div>
            <button onClick={submitOrder} disabled={loading}
              className="w-full font-bold py-3.5 rounded-xl mb-3 transition-all active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: brandColor, color: textOnBrand }}>
              {loading ? 'جاري الإرسال...' : 'نعم، الرقم صحيح — أرسل الطلب'}
            </button>
            <button onClick={() => { setShowConfirm(false); setShowSaved(false); setEditing(true); }}
              className="w-full border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 font-semibold py-3 rounded-xl transition-all active:scale-95">
              تعديل المعلومات
            </button>
          </div>
        </div>
      )}

      <ClientBottomNav />
    </div>
  );
}
