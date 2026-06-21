'use client';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { CustomerGuard } from '@/components/CustomerGuard';
import { Trash2, MapPin, UserCircle, Pencil, LocateFixed, CheckCircle2, Loader2, RefreshCw, X, Phone, ShoppingBag, ChevronLeft, Plus, Minus, Check, LogOut } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '@/context/SettingsContext';
import { useDarkMode } from '@/context/ThemeContext';
import InAppBrowserBanner, { isInAppBrowser } from '@/components/InAppBrowserBanner';
import type { Session } from '@supabase/supabase-js';

type Extra = { id: string; name: string; price: number };

const KEYS = {
  name:           'deliveryName',
  nickname:       'deliveryNickname',
  phone:          'deliveryPhone',
  locationDesc:   'deliveryLocationDesc',
  addressDetails: 'deliveryAddressDetails',
};

const BASRA_CENTER: [number, number]      = [30.5085, 47.7804];
const ABU_KHASEEB_CENTER: [number, number] = [30.4632, 47.9769];


type SavedInfo = { name: string; nickname: string; phone: string; locationDesc: string; addressDetails: string };

function loadSaved(): SavedInfo | null {
  const name  = localStorage.getItem(KEYS.name)  || '';
  const phone = localStorage.getItem(KEYS.phone) || '';
  if (!name || !phone) return null;
  return { name, nickname: localStorage.getItem(KEYS.nickname) || '', phone, locationDesc: localStorage.getItem(KEYS.locationDesc) || '', addressDetails: localStorage.getItem(KEYS.addressDetails) || '' };
}

function saveInfo(info: SavedInfo) {
  localStorage.setItem(KEYS.name,           info.name);
  localStorage.setItem(KEYS.nickname,       info.nickname);
  localStorage.setItem(KEYS.phone,          info.phone);
  localStorage.setItem(KEYS.locationDesc,   info.locationDesc);
  localStorage.setItem(KEYS.addressDetails, info.addressDetails);
}

export default function CartPage() {
  const { items, addItem, decrementItem, removeItem, clearCart, restoreCart, total } = useCart();
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
  const [nickname,     setNickname]     = useState('');
  const [phone,        setPhone]        = useState('');
  const [locationDesc,    setLocationDesc]    = useState('');
  const [addressDetails,  setAddressDetails]  = useState('');
  const [note,            setNote]            = useState('');
  const [addressError,    setAddressError]    = useState(false);

  // extras selection per item in review
  const [itemSelectedExtras, setItemSelectedExtras] = useState<Record<string, Set<string>>>({});

  const getExtras = (extrasJson?: string): Extra[] => {
    try { return JSON.parse(extrasJson || '[]'); } catch { return []; }
  };

  const extrasTotal = items.reduce((sum, item) => {
    const extras  = getExtras(item.extras_json);
    const selected = itemSelectedExtras[item.id] || new Set<string>();
    const cost = extras.filter(e => selected.has(e.id)).reduce((s, e) => s + e.price, 0);
    return sum + cost * item.quantity;
  }, 0);

  const grandTotal = total + extrasTotal;

  // Phone auth state
  const [session,            setSession]            = useState<Session | null>(null);
  const [authLoading,        setAuthLoading]        = useState(true);
  const [phoneAuthLoading,   setPhoneAuthLoading]   = useState(false);
  const [authPhone,          setAuthPhone]          = useState('');
  const [authPassword,       setAuthPassword]       = useState('');
  const [authError,          setAuthError]          = useState('');
  const [showPostOrderModal, setShowPostOrderModal] = useState(false);

  // UI state
  const [showOrderReview,  setShowOrderReview]  = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [itemNotes,        setItemNotes]        = useState<Record<string, string>>({});
  const [showSaved,        setShowSaved]        = useState(false);
  const [editing,          setEditing]          = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [editingName,           setEditingName]           = useState(false);
  const [editingPhone,          setEditingPhone]          = useState(false);
  const [editingConfirmAddress, setEditingConfirmAddress] = useState(false);
  const [editingConfirmPhone,   setEditingConfirmPhone]   = useState(false);
  const hasSavedInfoRef = useRef(false);

  // map state
  const [clientLat, setClientLat] = useState<number | null>(null);
  const [clientLng, setClientLng] = useState<number | null>(null);
  const [showMap,           setShowMap]           = useState(false);
  const [editingFromConfirm, setEditingFromConfirm] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [gpsLocating,       setGpsLocating]       = useState(false);
  const [gpsAccuracy,       setGpsAccuracy]       = useState<number | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showPreciseModal,    setShowPreciseModal]    = useState(false);
  const [showInAppBanner,     setShowInAppBanner]     = useState(false);
  const pendingOpenMapRef = useRef<(() => void) | null>(null);

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
        if (err.code === 1) { setShowPermissionModal(true); }
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

  // فتح الخريطة يدوياً بدون GPS
  const doOpenMapManual = (center: [number, number] = BASRA_CENTER) => {
    setShowPermissionModal(false);
    setShowPreciseModal(false);
    stopGpsWatch();
    setGpsLocating(false);
    setGpsAccuracy(null);
    setShowMap(true);
    setClientLat(center[0]);
    setClientLng(center[1]);
  };

  const openMap = () => {
    if (isInAppBrowser()) {
      pendingOpenMapRef.current = () => {
        if (!('geolocation' in navigator)) { setShowPermissionModal(true); return; }
        navigator.permissions?.query({ name: 'geolocation' as PermissionName })
          .then((result: PermissionStatus) => { if (result.state === 'denied') setShowPermissionModal(true); else doOpenMap(); })
          .catch(() => doOpenMap());
      };
      setShowInAppBanner(true);
      return;
    }
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
    setEditingFromConfirm(false);
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
    setEditingFromConfirm(false);
    if (pendingConfirmRef.current) {
      pendingConfirmRef.current = false;
      setShowConfirmModal(true);
    } else {
      setTimeout(() => submitBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }
  };

  const editLocationFromConfirm = () => {
    setShowConfirmModal(false);
    setEditingFromConfirm(true);
    pendingConfirmRef.current = true;
    if (clientLat && clientLng) {
      pendingFlyRef.current = { lat: clientLat, lng: clientLng, accuracy: 50 };
    }
    setShowMap(true);
    startGpsWatch((lat, lng, accuracy) => {
      const zoom = accuracy < 30 ? 18 : accuracy < 100 ? 17 : accuracy < 500 ? 16 : accuracy < 2000 ? 14 : 13;
      if (locationMapInstanceRef.current) {
        locationMapInstanceRef.current.flyTo([lat, lng], zoom, { animate: true, duration: 0.8 });
      } else {
        pendingFlyRef.current = { lat, lng, accuracy };
      }
    });
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
        const initialCenter: [number, number] = (clientLat && clientLng) ? [clientLat, clientLng] : BASRA_CENTER;
        const map = L.map(locationMapRef.current, { zoomControl: false, attributionControl: false }).setView(initialCenter, 13);
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
        const map = L.map(confirmMapRef.current, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, attributionControl: false })
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

  // ── Google auth ───────────────────────────────────────────────────────────

  const applySessionData = (s: Session | null) => {
    if (!s?.user) return;
    const meta = s.user.user_metadata as Record<string, string | undefined>;
    const savedName  = meta?.delivery_name  || meta?.full_name;
    const savedPhone = meta?.delivery_phone;
    if (savedName && !localStorage.getItem(KEYS.name)) {
      setName(savedName);
      localStorage.setItem(KEYS.name, savedName);
    }
    if (savedPhone && !localStorage.getItem(KEYS.phone)) {
      setPhone(savedPhone);
      localStorage.setItem(KEYS.phone, savedPhone);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      applySessionData(s);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      applySessionData(s);
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuth = async (mode: 'signin' | 'signup') => {
    const trimPhone = authPhone.trim();
    const trimPass  = authPassword.trim();
    if (!trimPhone || !trimPass) {
      setAuthError('يرجى إدخال رقم الهاتف وكلمة المرور');
      return;
    }
    setPhoneAuthLoading(true);
    setAuthError('');
    const email = `${trimPhone}@c.delivery`;
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password: trimPass,
        options: { data: { delivery_phone: trimPhone, delivery_name: name || '' } },
      });
      if (error) {
        setAuthError(error.message);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: trimPass });
      if (error) {
        setAuthError(
          error.message.includes('not confirmed') || error.message.includes('Email not confirmed')
            ? 'الحساب غير مفعّل — يجب إيقاف "Confirm email" في إعدادات Supabase'
            : error.message.includes('Invalid login')
            ? 'رقم الهاتف أو كلمة المرور غير صحيحة'
            : error.message
        );
      } else {
        // الرقم مضمون من الإيميل نفسه → حفظه دائماً بعد الدخول
        localStorage.setItem(KEYS.phone, trimPhone);
        setPhone(trimPhone);
      }
    }
    setPhoneAuthLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // ── Load saved info + restore from external-browser redirect ─────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasRedirectData = params.has('_name') || params.has('_phone') || params.has('_cart');

    if (hasRedirectData) {
      // Restore form data
      const n  = params.get('_name')  || '';
      const ni = params.get('_nick')  || '';
      const ph = params.get('_phone') || '';
      const lo = params.get('_loc')   || '';
      const ad = params.get('_addr')  || '';

      if (n)  { setName(n);             localStorage.setItem('deliveryName',           n);  }
      if (ni) { setNickname(ni);        localStorage.setItem('deliveryNickname',       ni); }
      if (ph) { setPhone(ph);           localStorage.setItem('deliveryPhone',          ph); }
      if (lo) { setLocationDesc(lo);    localStorage.setItem('deliveryLocationDesc',   lo); }
      if (ad) { setAddressDetails(ad);  localStorage.setItem('deliveryAddressDetails', ad); }

      if (n || ph) hasSavedInfoRef.current = true;

      // Restore cart items
      const cartParam = params.get('_cart');
      if (cartParam) {
        try {
          const decoded = JSON.parse(decodeURIComponent(atob(cartParam)));
          if (Array.isArray(decoded) && decoded.length > 0) restoreCart(decoded);
        } catch { /* ignore */ }
      }

      // Show form directly
      setEditing(true);

      // Clean URL
      const clean = new URL(window.location.href);
      ['_name','_nick','_phone','_loc','_addr','_cart'].forEach(k => clean.searchParams.delete(k));
      window.history.replaceState({}, '', clean.toString());
      return;
    }

    const saved = loadSaved();
    if (saved) {
      setName(saved.name);
      setNickname(saved.nickname);
      setPhone(saved.phone);
      setLocationDesc(saved.locationDesc);
      setAddressDetails(saved.addressDetails);
      hasSavedInfoRef.current = true;
    }
  }, []);

  // فتح المراجعة قبل أي رسم حتى لا يظهر وميض الصفحة
  useLayoutEffect(() => {
    if (items.length > 0 && !editing) {
      setShowOrderReview(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // تجميد الصفحة الخلفية عند فتح أي نافذة
  useEffect(() => {
    const anyModal = showOrderReview || showOrderSummary || showSaved || showMap || showConfirmModal;
    document.body.style.overflow = anyModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showOrderReview, showOrderSummary, showSaved, showMap, showConfirmModal]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openOrderReview = () => {
    if (items.length === 0) { alert('السلة فارغة'); return; }
    setShowOrderReview(true);
  };

const proceedFromReview = () => {
    setShowOrderReview(false);
    setShowOrderSummary(true);
  };

  const proceedFromSummary = () => {
    const parts: string[] = [];
    for (const item of items) {
      const iNote = (itemNotes[item.id] || '').trim();
      if (iNote) parts.push(`${item.name}: ${iNote}`);
    }
    setNote(parts.join('\n'));
    setShowOrderSummary(false);
    if (hasSavedInfoRef.current) {
      setShowSaved(true);
    } else {
      setEditing(true);
    }
  };

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

    if (!addressDetails.trim()) {
      setAddressError(true);
      setTimeout(() => setAddressError(false), 600);
      document.getElementById('address-details-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (items.length === 0) { alert('السلة فارغة'); return; }
    if (!locationConfirmed) {
      pendingConfirmRef.current = true;
      openMap();
      return;
    }
    setShowConfirmModal(true);
  };

  const submitOrder = async () => {
    setLoading(true);
    saveInfo({ name: name.trim(), nickname: nickname.trim(), phone: phone.trim(), locationDesc: locationDesc.trim(), addressDetails: addressDetails.trim() });

    const restaurantId = localStorage.getItem('currentRestaurantId') || null;

    const { data: order, error } = await supabase.from('orders').insert([{
      client_name: nickname.trim() ? `${name.trim()} (${nickname.trim()})` : name.trim(), client_phone: phone.trim(),
      delivery_address: addressDetails.trim() || null,
      client_note: note || null,
      total_amount: grandTotal, status: 'pending',
      ...(session?.user?.id ? { user_id: session.user.id } : {}),
      ...(clientLat !== null && clientLng !== null ? { client_lat: clientLat, client_lng: clientLng } : {}),
      ...(restaurantId ? { restaurant_id: restaurantId } : {}),
    }]).select().single();

    if (error || !order) { alert('حدث خطأ، حاول مجدداً'); setLoading(false); return; }

    const { error: itemsError } = await supabase.from('order_items').insert(
      items.map(i => {
        const extras = getExtras(i.extras_json);
        const selected = itemSelectedExtras[i.id] || new Set<string>();
        const selectedArr = extras.filter(e => selected.has(e.id));
        const extraCost = selectedArr.reduce((s, e) => s + e.price, 0);
        const extraNames = selectedArr.map(e => e.name).join('، ');
        return {
          order_id: order.id,
          item_name: extraNames ? `${i.name} (${extraNames})` : i.name,
          quantity: i.quantity,
          price: i.price + extraCost,
        };
      })
    );

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      alert('حدث خطأ في حفظ الطلب، حاول مجدداً');
      setLoading(false);
      return;
    }

    localStorage.setItem('lastOrderId', order.id);
    clearCart();
    setLoading(false);
    setShowConfirmModal(false);
    setShowPostOrderModal(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <CustomerGuard>
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-center" style={{ color: dark ? brandColor : '#111827' }}>سلة المشتريات</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {items.length === 0 && (
          <p className="text-center text-gray-400 dark:text-slate-500 mt-24 text-base">السلة فارغة</p>
        )}

        {/* ── فورم معلومات الطلب ── */}
        {editing && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-3">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right">معلومات الطلب</h3>

            {/* حالة الحساب */}
            {!authLoading && session && (
              <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
                <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-red-500 font-semibold active:scale-90 transition-all">
                  <LogOut size={13}/> خروج
                </button>
                <span className="text-xs font-bold text-green-700 dark:text-green-400">مسجّل الدخول ✓</span>
              </div>
            )}

            {/* الاسم */}
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="الاسم *" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
            />

            {/* اللقب */}
            <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
              placeholder="اللقب (اختياري)" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
            />

            {/* رقم الهاتف */}
            <div className="flex items-center bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden focus-within:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}>
              <div className="flex items-center gap-1.5 px-3 py-3 border-r border-gray-200 dark:border-slate-600 flex-shrink-0 select-none">
                <span className="text-base leading-none">🇮🇶</span>
                <span className="text-sm font-bold text-gray-500 dark:text-slate-400">+964</span>
              </div>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="رقم الهاتف *" dir="rtl"
                className="flex-1 bg-transparent px-3 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none"
              />
            </div>

            {/* زر الخريطة */}
            {locationConfirmed ? (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between mt-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                <button type="button" onClick={() => { setLocationConfirmed(false); openMap(); }}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-400 active:scale-90 transition-all">
                  <RefreshCw size={12} /> تغيير
                </button>
                <span className="flex items-center gap-2 bg-green-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl">
                  <CheckCircle2 size={17} /> تم تحديد موقعك
                </span>
              </div>
            ) : (
              <button type="button" onClick={openMap}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                style={{ backgroundColor: '#ef4444', color: '#ffffff', boxShadow: '0 4px 14px #ef444450' }}>
                <MapPin size={17} />
                اضغط هنا لتحديد الموقع
              </button>
            )}

            {/* تفاصيل العنوان */}
            <input id="address-details-input" type="text" value={addressDetails} onChange={e => { setAddressDetails(e.target.value); if (addressError) setAddressError(false); }}
              placeholder="تفاصيل العنوان — أقرب دالة *" dir="rtl"
              className={`w-full bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 border-2 transition-colors${addressError ? ' shake border-red-500' : ' border-gray-200 dark:border-slate-600'}`}
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
          {editing ? (
            <button ref={submitBtnRef} onClick={handleSubmitPress} disabled={items.length === 0}
              className="w-full disabled:opacity-40 font-bold py-4 rounded-xl text-lg transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', boxShadow: '0 8px 28px #ef444445' }}>
              إرسال الطلب
            </button>
          ) : (
            <button onClick={openOrderReview} disabled={items.length === 0}
              className="w-full disabled:opacity-40 font-black py-4 rounded-2xl text-lg transition-all active:scale-95 flex items-center justify-center gap-3"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', boxShadow: '0 8px 28px #ef444445' }}>
              <ShoppingBag size={20}/>
              مراجعة وإتمام الطلب
              <ChevronLeft size={20}/>
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          نافذة مراجعة الطلب (مع إضافات + ملاحظات لكل وجبة)
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showOrderReview && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="w-full bg-white dark:bg-slate-900 rounded-t-3xl flex flex-col"
            style={{ height: 'calc(100svh - 12px)', maxHeight: 'calc(100svh - 12px)' }}>

            {/* Drag pill */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700"/>
            </div>

            {/* Header sticky */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
              <button onClick={() => setShowOrderReview(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 active:scale-90">
                <X size={17}/>
              </button>
              <div className="text-center">
                <p className="font-black text-gray-900 dark:text-white text-sm">مراجعة طلبك</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">{items.length} وجبة · {total.toLocaleString()} د.ع</p>
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ef444420' }}>
                <ShoppingBag size={17} style={{ color: '#ef4444' }}/>
              </div>
            </div>

            {/* Scrollable body — items first */}
            <div className="px-4 py-4 space-y-4" style={{ flex: '1 1 0', overflowY: 'auto', overflowX: 'hidden', minHeight: 0, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              {items.map(item => {
                const iNote   = itemNotes[item.id]  || '';
                return (
                  <div key={item.id} className="bg-gray-50 dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">

                    {/* Row: image + name + qty controls + price */}
                    <div className="p-3 flex items-center gap-3">
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-sm"/>
                        : <div className="w-16 h-16 rounded-xl bg-gray-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <ShoppingBag size={20} className="text-gray-400 dark:text-slate-500"/>
                          </div>
                      }
                      <div className="flex-1 text-right min-w-0">
                        <p className="font-black text-gray-900 dark:text-white text-sm leading-snug">{item.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{item.price.toLocaleString()} د.ع / وجبة</p>
                      </div>
                      {/* qty controls */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => decrementItem(item.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all"
                          style={{ backgroundColor: item.quantity === 1 ? '#fee2e2' : '#f1f5f9' }}>
                          {item.quantity === 1
                            ? <Trash2 size={13} style={{ color: '#ef4444' }}/>
                            : <Minus size={13} className="text-gray-500 dark:text-slate-400"/>}
                        </button>
                        <span className="font-black text-sm text-gray-900 dark:text-white w-5 text-center">{item.quantity}</span>
                        <button onClick={() => addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url })}
                          className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all"
                          style={{ backgroundColor: '#ef4444' }}>
                          <Plus size={13} className="text-white"/>
                        </button>
                      </div>
                      {/* item total */}
                      <div className="text-left flex-shrink-0 ml-1">
                        <p className="font-black text-sm" style={{ color: '#ef4444' }}>{(item.price * item.quantity).toLocaleString()}</p>
                        <p className="text-[9px] text-gray-400 text-center">د.ع</p>
                      </div>
                    </div>

                    {/* Extras for this item */}
                    {(() => {
                      const extras = getExtras(item.extras_json);
                      if (extras.length === 0) return null;
                      const selected = itemSelectedExtras[item.id] || new Set<string>();
                      return (
                        <div className="px-3 pb-2 pt-1">
                          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 text-right mb-1.5">الإضافات</p>
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {extras.map(e => {
                              const on = selected.has(e.id);
                              return (
                                <button key={e.id}
                                  onClick={() => setItemSelectedExtras(prev => {
                                    const next = new Set(prev[item.id] || new Set<string>());
                                    on ? next.delete(e.id) : next.add(e.id);
                                    return { ...prev, [item.id]: next };
                                  })}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 border"
                                  style={on
                                    ? { backgroundColor: '#ef4444', borderColor: '#ef4444', color: 'white' }
                                    : { backgroundColor: 'transparent', borderColor: '#d1d5db', color: '#9ca3af' }
                                  }
                                >
                                  {on ? <Check size={10}/> : <Plus size={10}/>}
                                  <span>{e.name}</span>
                                  {e.price > 0 && <span className="opacity-75">+{e.price.toLocaleString()}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Notes for this item */}
                    <div className="px-3 pb-4 pt-1">
                      <input type="text" value={iNote}
                        onChange={e => setItemNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="ملاحظة خاصة لهذه الوجبة... (مثل: حار، بدون بصل)" dir="rtl"
                        className="w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-1"
                        style={{ '--tw-ring-color': '#ef4444' } as React.CSSProperties}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Total + زر التالي */}
              <button onClick={proceedFromReview}
                className="w-full rounded-xl px-4 py-2.5 flex items-center justify-between transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 12px #ef444440' }}>
                <div className="flex items-center gap-1">
                  <ChevronLeft size={15} className="text-white"/>
                  <span className="font-black text-white text-xs">التالي</span>
                </div>
                <div className="text-right">
                  <p className="font-black text-white text-base leading-tight">{grandTotal.toLocaleString()} <span className="text-[10px] font-bold opacity-80">د.ع</span></p>
                  <p className="text-[9px] text-white/70 font-bold">المجموع الكلي</p>
                </div>
              </button>

              <div className="h-2"/>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          نافذة ملخص الطلب المنبثقة
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showOrderSummary && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.82, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.82, y: 30 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm overflow-hidden"
            style={{ maxHeight: '82vh' }}>

            {/* Summary header */}
            <div className="px-5 pt-6 pb-4 text-center border-b border-gray-100 dark:border-slate-700">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#ef444418' }}>
                <CheckCircle2 size={30} style={{ color: '#ef4444' }}/>
              </div>
              <h3 className="font-black text-gray-900 dark:text-white text-lg">ملخص طلبك</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">تأكد من الطلب قبل إدخال معلوماتك</p>
            </div>

            {/* Summary body */}
            <div className="overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: '44vh' }}>
              {items.map(item => {
                const iNote  = (itemNotes[item.id] || '').trim();
                const extras  = getExtras(item.extras_json);
                const selected = itemSelectedExtras[item.id] || new Set<string>();
                const selectedExtrasArr = extras.filter(e => selected.has(e.id));
                const extraCost = selectedExtrasArr.reduce((s, e) => s + e.price, 0);
                const itemTotal = (item.price + extraCost) * item.quantity;
                return (
                  <div key={item.id} className="bg-gray-50 dark:bg-slate-700 rounded-2xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm" style={{ color: '#ef4444' }}>
                        {itemTotal.toLocaleString()} د.ع
                      </span>
                      <span className="font-black text-gray-900 dark:text-white text-sm text-right">
                        {item.name} <span className="text-gray-400 font-bold">×{item.quantity}</span>
                      </span>
                    </div>
                    {selectedExtrasArr.length > 0 && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 text-right mt-0.5">
                        ✨ {selectedExtrasArr.map(e => e.name).join('، ')}
                      </p>
                    )}
                    {iNote && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 text-right mt-0.5">
                        📝 {iNote}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Total */}
              <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg,#ef444412,#ef444406)', border: '1.5px solid #ef444435' }}>
                <span className="font-black text-xl" style={{ color: '#ef4444' }}>{grandTotal.toLocaleString()} د.ع</span>
                <span className="font-black text-gray-900 dark:text-white text-sm">المجموع</span>
              </div>
            </div>

            {/* Summary footer */}
            <div className="px-4 pb-5 pt-3 space-y-2 border-t border-gray-100 dark:border-slate-700">
              <button onClick={proceedFromSummary}
                className="w-full py-4 rounded-2xl font-black text-base transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', boxShadow: '0 8px 24px #ef444450' }}>
                تم ← أدخل معلوماتك
              </button>
              <button onClick={() => { setShowOrderSummary(false); setShowOrderReview(true); }}
                className="w-full py-3 rounded-xl font-bold text-sm text-gray-400 dark:text-slate-500 active:scale-95 transition-all">
                تعديل الطلب
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

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
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${brandColor}18` }}>
                <UserCircle size={30} style={{ color: brandColor }}/>
              </div>
              <div className="flex-1 text-right">
                <h3 className="font-black text-gray-900 dark:text-slate-100 text-base leading-snug">هل تريد استخدام نفس المعلومات؟</h3>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">معلوماتك المحفوظة</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 space-y-3 mb-5 text-right">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {editingName ? (
                    <input
                      type="text" value={name} onChange={e => setName(e.target.value)}
                      onBlur={() => setEditingName(false)} autoFocus dir="rtl"
                      className="bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-slate-100 outline-none"
                    />
                  ) : (
                    <>
                      <button onClick={() => setEditingName(true)} className="text-gray-900 dark:text-gray-400 active:scale-90 transition-all"><Pencil size={13}/></button>
                      <span className="text-gray-900 dark:text-slate-100 font-semibold">{name}</span>
                    </>
                  )}
                </div>
                <span className="text-gray-400 dark:text-slate-500 text-sm">الاسم</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-100 dark:border-slate-600 pt-3">
                <div className="flex items-center gap-2">
                  {editingPhone ? (
                    <div className="flex items-center bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-1 px-2 py-1 border-r border-gray-200 dark:border-slate-500 flex-shrink-0">
                        <span className="text-sm leading-none">🇮🇶</span>
                        <span className="text-xs font-bold text-gray-400">+964</span>
                      </div>
                      <input
                        type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        onBlur={() => setEditingPhone(false)} autoFocus dir="rtl"
                        className="bg-transparent px-2 py-1 text-sm text-gray-900 dark:text-slate-100 outline-none w-28"
                      />
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setEditingPhone(true)} className="text-gray-900 dark:text-gray-400 active:scale-90 transition-all"><Pencil size={13}/></button>
                      <span className="font-bold tracking-widest" style={{ color: '#ef4444' }}>
                        <span className="text-gray-400 font-normal text-xs ml-1">🇮🇶 +964</span>{phone}
                      </span>
                    </>
                  )}
                </div>
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
              className="w-full font-bold py-3.5 rounded-xl mb-3 transition-all active:scale-95 bg-red-500 text-white">
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
              <p className="font-bold" style={{ color: '#ef4444' }}>موقعك:</p>
              <div className="w-9"/>
            </div>

            {/* Mini map */}
            {clientLat && clientLng && (
              <div style={{ height: 200, position: 'relative' }}>
                <div ref={confirmMapRef} style={{ position: 'absolute', inset: 0 }} />
                <button
                  type="button"
                  onClick={editLocationFromConfirm}
                  className="absolute bottom-3 left-3 z-[1000] flex items-center gap-1.5 rounded-full px-3 py-2 active:scale-90 transition-all"
                  style={{ background: 'white', boxShadow: '0 4px 16px rgba(0,0,0,0.22)', border: '2px solid #ef444430' }}>
                  <Pencil size={14} style={{ color: '#ef4444' }}/>
                  <span className="text-xs font-bold" style={{ color: '#ef4444' }}>تعديل</span>
                </button>
              </div>
            )}

            {/* Info */}
            <div className="px-5 pt-4 pb-2 space-y-3">
              <div className="flex items-start gap-3 rounded-xl p-3.5 text-right"
                style={{ backgroundColor: `${brandColor}10`, borderWidth: 1, borderStyle: 'solid', borderColor: `${brandColor}30` }}>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">العنوان</p>
                  {editingConfirmAddress ? (
                    <input
                      type="text" value={addressDetails} onChange={e => setAddressDetails(e.target.value)}
                      onBlur={() => setEditingConfirmAddress(false)} autoFocus dir="rtl"
                      className="w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-500 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-slate-100 outline-none"
                    />
                  ) : (
                    <div className="flex items-center gap-2 justify-end">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm leading-relaxed flex-1">{addressDetails || '—'}</p>
                      <button type="button" onClick={() => setEditingConfirmAddress(true)} className="text-gray-400 active:scale-90 transition-all flex-shrink-0">
                        <Pencil size={13}/>
                      </button>
                    </div>
                  )}
                </div>
                <MapPin size={18} className="mt-0.5 flex-shrink-0" style={{ color: brandColor }}/>
              </div>

              <div className="flex items-center gap-3 rounded-xl p-3.5 text-right"
                style={{ backgroundColor: `${brandColor}10`, borderWidth: 1, borderStyle: 'solid', borderColor: `${brandColor}30` }}>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">رقم الهاتف</p>
                  {editingConfirmPhone ? (
                    <div className="flex items-center bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-500 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-1 px-2 py-1 border-r border-gray-200 dark:border-slate-500 flex-shrink-0">
                        <span className="text-sm leading-none">🇮🇶</span>
                        <span className="text-xs font-bold text-gray-400">+964</span>
                      </div>
                      <input
                        type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        onBlur={() => setEditingConfirmPhone(false)} autoFocus dir="rtl"
                        className="bg-transparent px-2 py-1 text-sm font-bold outline-none flex-1"
                        style={{ color: brandColor }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 justify-end">
                      <p className="font-bold tracking-widest flex-1" style={{ color: '#ef4444' }}>
                        <span className="text-gray-400 font-normal text-xs ml-1">🇮🇶 +964</span>{phone}
                      </p>
                      <button type="button" onClick={() => setEditingConfirmPhone(true)} className="text-gray-400 active:scale-90 transition-all flex-shrink-0">
                        <Pencil size={13}/>
                      </button>
                    </div>
                  )}
                </div>
                <Phone size={18} className="flex-shrink-0" style={{ color: brandColor }}/>
              </div>

              {/* الأصناف المطلوبة */}
              <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800">
                  <span className="font-black text-sm" style={{ color: '#ef4444' }}>{grandTotal.toLocaleString()} د.ع</span>
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag size={13} className="text-gray-400 dark:text-slate-500"/>
                    <p className="text-xs font-bold text-gray-500 dark:text-slate-400">طلبك :</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                  {items.map(item => {
                    const extras = getExtras(item.extras_json);
                    const selected = itemSelectedExtras[item.id] || new Set<string>();
                    const selectedExtrasArr = extras.filter(e => selected.has(e.id));
                    const extraCost = selectedExtrasArr.reduce((s, e) => s + e.price, 0);
                    const iNote = (itemNotes[item.id] || '').trim();
                    return (
                      <div key={item.id} className="px-3.5 py-2.5 text-right">
                        <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                          {item.name} <span className="text-gray-400 font-bold text-xs">×{item.quantity}</span>
                        </p>
                        {iNote && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">📝 {iNote}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="px-5 pt-3 pb-8 space-y-3">
              <button onClick={submitOrder} disabled={loading}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#ffffff', boxShadow: '0 8px 24px #ef444450' }}>
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
            <button onClick={() => doOpenMapManual()}
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
            <button onClick={() => doOpenMapManual()}
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
                <CheckCircle2 size={20}/> {editingFromConfirm ? 'تم' : 'تأكيد الموقع'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <InAppBrowserBanner
        show={showInAppBanner}
        onDismiss={() => setShowInAppBanner(false)}
        onContinue={() => {
          setShowInAppBanner(false);
          pendingOpenMapRef.current = null;
          doOpenMapManual(ABU_KHASEEB_CENTER);
        }}
        formData={{ name, nickname, phone, locationDesc, addressDetails }}
        cartItems={items}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          مودال ما بعد الطلب — تسجيل دخول أو استمرار كضيف
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showPostOrderModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ scale: 0.82, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.82, opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative"
          >
            {/* زر الإغلاق */}
            <button
              onClick={() => router.push('/track')}
              className="absolute top-4 left-4 w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 active:scale-90 transition-all z-10"
            >
              <X size={17}/>
            </button>

            {/* المحتوى */}
            <div className="px-6 pt-8 pb-7 text-center">
              {/* أيقونة */}
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg,#22c55e18,#22c55e08)', border: '2px solid #22c55e30' }}>
                <span className="text-3xl">✅</span>
              </div>

              <h2 className="font-black text-gray-900 dark:text-white text-xl mb-1">
                تم إرسال طلبك!
              </h2>
              <p className="font-bold text-gray-900 dark:text-slate-100 text-base mb-1">
                عزيزي {name.split(' ')[0] || 'زبوننا الكريم'} 👋
              </p>
              {session ? (
                <>
                  <p className="text-green-600 dark:text-green-400 font-bold text-sm mb-5">✓ أنت مسجّل الدخول</p>
                  <button
                    onClick={() => router.push('/track')}
                    className="w-full py-3.5 rounded-2xl font-black text-sm active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#ffffff' }}
                  >
                    متابعة الطلب
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed mb-4">
                    سجّل دخولك لمتابعة طلبك من أي جهاز وحفظ معلوماتك.
                  </p>

                  <div className="space-y-2.5 mb-3 text-right">
                    <input
                      value={authPhone}
                      onChange={e => setAuthPhone(e.target.value.replace(/\D/g,'').slice(0,11))}
                      placeholder="رقم الهاتف"
                      type="tel"
                      dir="rtl"
                      className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none text-sm"
                    />
                    <input
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      placeholder="كلمة المرور"
                      type="password"
                      className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none text-sm"
                    />
                    {authError && <p className="text-xs text-red-500">{authError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAuth('signin')}
                        disabled={phoneAuthLoading}
                        className="flex-1 py-3 rounded-xl font-black text-sm active:scale-95 transition-all disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#ffffff' }}
                      >
                        {phoneAuthLoading ? '...' : 'دخول'}
                      </button>
                      <button
                        onClick={() => handleAuth('signup')}
                        disabled={phoneAuthLoading}
                        className="flex-1 py-3 rounded-xl font-bold text-sm border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 active:scale-95 transition-all disabled:opacity-60"
                      >
                        إنشاء حساب
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push('/track')}
                    className="w-full py-3 rounded-2xl font-bold text-sm text-gray-400 dark:text-slate-500 active:scale-95 transition-all border border-gray-100 dark:border-slate-800"
                  >
                    استمرار كضيف
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <ClientBottomNav />
    </div>
    </CustomerGuard>
  );
}
