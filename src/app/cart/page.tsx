'use client';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { CustomerGuard } from '@/components/CustomerGuard';
import { Trash2, MapPin, UserCircle, Pencil, LocateFixed, CheckCircle2, Loader2, RefreshCw, X, Phone, ShoppingBag, ChevronLeft, Plus, Minus, Check, LogOut, Ticket } from 'lucide-react';
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

// ── مواقع محفوظة ─────────────────────────────────────────────────────────────
type SavedLocation = { id: string; lat: number; lng: number; address: string; savedAt: number };
const SAVED_LOCS_KEY = 'savedLocations_v1';
const MAX_SAVED_LOCS = 5;

function loadSavedLocations(): SavedLocation[] {
  try {
    const raw = localStorage.getItem(SAVED_LOCS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistSavedLocation(loc: SavedLocation) {
  const existing = loadSavedLocations();
  const filtered = existing.filter(l =>
    Math.abs(l.lat - loc.lat) > 0.0001 || Math.abs(l.lng - loc.lng) > 0.0001
  );
  localStorage.setItem(SAVED_LOCS_KEY, JSON.stringify([loc, ...filtered].slice(0, MAX_SAVED_LOCS)));
}

function deleteSavedLocation(id: string) {
  const updated = loadSavedLocations().filter(l => l.id !== id);
  localStorage.setItem(SAVED_LOCS_KEY, JSON.stringify(updated));
}

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
  const { items, addItem, decrementItem, removeItem, clearCart, restoreCart, total, orderType, setOrderType } = useCart();
  const { primary_color, delivery_fee, min_order_amount, coupon_code, coupon_discount_pct, coupon_enabled } = useSettings();
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

  // ── كوبون الخصم ─────────────────────────────────────────────────────────
  const [couponInput,      setCouponInput]      = useState('');
  const [appliedCouponPct, setAppliedCouponPct] = useState(0);
  const [couponMsg,        setCouponMsg]        = useState<{ ok: boolean; text: string } | null>(null);

  const applyCoupon = () => {
    const entered = couponInput.trim().toUpperCase();
    if (!entered) return;
    if (coupon_enabled && coupon_code && entered === coupon_code.trim().toUpperCase()) {
      setAppliedCouponPct(coupon_discount_pct || 0);
      setCouponMsg({ ok: true, text: `تم تطبيق خصم ${coupon_discount_pct}%` });
    } else {
      setAppliedCouponPct(0);
      setCouponMsg({ ok: false, text: 'كود الكوبون غير صحيح' });
    }
  };

  // نوع الطلب: توصيل الطلب / استلام الطلب — مصدره الموحّد CartContext
  // (يُختار مبدئياً من صفحة المنيو، وقابل للتغيير هنا أيضاً بنفس المبدّل)

  // extras selection per item in review
  const [itemSelectedExtras, setItemSelectedExtras] = useState<Record<string, Set<string>>>({});
  const [cartPriceFlash, setCartPriceFlash] = useState(false);
  const [minOrderShake, setMinOrderShake] = useState(false);
  const prevGrandTotal = useRef(0);

  const getExtras = (extrasJson?: string): Extra[] => {
    try { return JSON.parse(extrasJson || '[]'); } catch { return []; }
  };

  const extrasTotal = items.reduce((sum, item) => {
    const extras  = getExtras(item.extras_json);
    const selected = itemSelectedExtras[item.id] || new Set<string>();
    const cost = extras.filter(e => selected.has(e.id)).reduce((s, e) => s + e.price, 0);
    return sum + cost * item.quantity;
  }, 0);

  const deliveryFee = orderType === 'delivery' ? (delivery_fee || 0) : 0;

  // الحد الأدنى للطلب — ينطبق فقط على طلبات التوصيل، ويُحتسب على قيمة الوجبات
  // + الإضافات (بدون رسوم التوصيل، لأنها ليست جزءاً من "قيمة الطلب")
  const orderSubtotal   = total + extrasTotal;
  const minOrderShortfall = orderType === 'delivery' && min_order_amount > 0
    ? Math.max(0, min_order_amount - orderSubtotal)
    : 0;

  // خصم الكوبون يُحتسب على قيمة الطلب (الوجبات + الإضافات) فقط، بدون رسوم التوصيل
  const discountAmount = appliedCouponPct > 0 ? Math.round(orderSubtotal * appliedCouponPct / 100 * 100) / 100 : 0;
  const grandTotal = orderSubtotal + deliveryFee - discountAmount;

  useEffect(() => {
    if (grandTotal > prevGrandTotal.current) {
      setCartPriceFlash(true);
      const t = setTimeout(() => setCartPriceFlash(false), 700);
      prevGrandTotal.current = grandTotal;
      return () => clearTimeout(t);
    }
    prevGrandTotal.current = grandTotal;
  }, [grandTotal]);

  // Phone auth state
  const [session,            setSession]            = useState<Session | null>(null);
  const [authLoading,        setAuthLoading]        = useState(true);
  const [phoneAuthLoading,   setPhoneAuthLoading]   = useState(false);
  const [authPhone,          setAuthPhone]          = useState('');
  const [authPassword,       setAuthPassword]       = useState('');
  const [authError,          setAuthError]          = useState('');
  const [showPostOrderModal,  setShowPostOrderModal]  = useState(false);
  const [postOrderStep,       setPostOrderStep]       = useState<'choice' | 'signup'>('choice');
  const [signupDone,          setSignupDone]          = useState(false);
  const [postOrderCountdown,  setPostOrderCountdown]  = useState(7);

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
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

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
  const reviewAutoOpenedRef = useRef(false);

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
  const postOrderTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // حفظ الموقع الجديد
    if (clientLat !== null && clientLng !== null) {
      const loc: SavedLocation = { id: Date.now().toString(), lat: clientLat, lng: clientLng, address: addressDetails.trim(), savedAt: Date.now() };
      persistSavedLocation(loc);
      setSavedLocations(loadSavedLocations());
    }
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

  useEffect(() => { setSavedLocations(loadSavedLocations()); }, []);

  // فتح المراجعة قبل أي رسم حتى لا يظهر وميض الصفحة
  useLayoutEffect(() => {
    if (items.length > 0 && !editing) {
      reviewAutoOpenedRef.current = true;
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
    reviewAutoOpenedRef.current = false;
    setShowOrderReview(true);
  };

const proceedFromReview = () => {
    if (minOrderShortfall > 0) {
      setMinOrderShake(true);
      setTimeout(() => setMinOrderShake(false), 600);
      return;
    }
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
    if (!name.trim()) { alert('الرجاء إدخال الاسم'); return; }
    if (!phone.trim()) { alert('الرجاء إدخال رقم الهاتف'); return; }
    if (items.length === 0) { alert('السلة فارغة'); return; }
    if (minOrderShortfall > 0) { alert(`الحد الأدنى للطلب عند التوصيل ${min_order_amount.toLocaleString()} د.ع، أضف ${minOrderShortfall.toLocaleString()} د.ع أخرى`); return; }

    if (orderType === 'delivery') {
      if (!addressDetails.trim()) {
        setAddressError(true);
        setTimeout(() => setAddressError(false), 600);
        document.getElementById('address-details-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!locationConfirmed) {
        pendingConfirmRef.current = true;
        openMap();
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const submitOrder = async () => {
    setLoading(true);
    saveInfo({ name: name.trim(), nickname: nickname.trim(), phone: phone.trim(), locationDesc: locationDesc.trim(), addressDetails: addressDetails.trim() });

    const restaurantId = localStorage.getItem('currentRestaurantId') || null;

    const { data: order, error } = await supabase.from('orders').insert([{
      client_name: nickname.trim() ? `${name.trim()} (${nickname.trim()})` : name.trim(), client_phone: phone.trim() || null,
      delivery_address: orderType === 'delivery' ? (addressDetails.trim() || null) : null,
      client_note: note || null,
      total_amount: grandTotal, status: 'pending',
      order_type: orderType,
      delivery_fee: deliveryFee,
      discount_amount: discountAmount,
      ...(discountAmount > 0 ? { coupon_code: couponInput.trim().toUpperCase() } : {}),
      ...(session?.user?.id ? { user_id: session.user.id } : {}),
      ...(clientLat !== null && clientLng !== null && orderType === 'delivery' ? { client_lat: clientLat, client_lng: clientLng } : {}),
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
          item_id: i.id,
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

    // زبون مسجّل دخوله مسبقاً — لا داعي لعرض نافذة "أنشئ حساباً/تابع كضيف"، ينتقل مباشرة لتتبع طلبه
    if (session) {
      router.push('/track');
      return;
    }

    setAuthPhone(phone.trim());
    setAuthPassword('');
    setAuthError('');
    setPostOrderStep('choice');
    setSignupDone(false);
    setShowPostOrderModal(true);
  };

  // ── مؤقت الإغلاق التلقائي لمودال ما بعد الطلب (7 ثواني) ─────────────────
  useEffect(() => {
    if (!showPostOrderModal || postOrderStep !== 'choice') return;
    setPostOrderCountdown(7);
    const interval = setInterval(() => {
      setPostOrderCountdown(prev => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    postOrderTimerRef.current = setTimeout(() => {
      setShowPostOrderModal(false);
      router.push('/track');
    }, 7000);
    return () => {
      clearInterval(interval);
      if (postOrderTimerRef.current) { clearTimeout(postOrderTimerRef.current); postOrderTimerRef.current = null; }
    };
  }, [showPostOrderModal, postOrderStep, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  const anyModalOpen = showOrderReview || showOrderSummary || showSaved || showMap || showConfirmModal || showPostOrderModal || showPreciseModal || showPermissionModal;

  return (
    <CustomerGuard>
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32 md:pr-[70px]">
      <div style={{ visibility: anyModalOpen ? 'hidden' : 'visible' }}>
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <div className="relative flex items-center justify-center">
          <h1 className="text-xl font-bold text-center" style={{ color: dark ? brandColor : '#111827' }}>سلة المشتريات</h1>
          {editing && (
            <button onClick={() => { setEditing(false); setShowOrderReview(true); }}
              className="absolute right-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all">
              <ChevronLeft size={18} style={{ transform: 'rotate(180deg)' }}/>
            </button>
          )}
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {items.length === 0 && (
          <p className="text-center text-gray-400 dark:text-slate-500 mt-24 text-base">السلة فارغة</p>
        )}

        {/* ── فورم معلومات الطلب ── */}
        {editing && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-3">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right">معلومات الطلب</h3>

            {/* نوع الطلب: توصيل الطلب / استلام الطلب */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'delivery' as const, label: 'توصيل الطلب' },
                { key: 'pickup'   as const, label: 'استلام الطلب' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setOrderType(opt.key)}
                  className="flex items-center justify-center py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border-2"
                  style={orderType === opt.key
                    ? { backgroundColor: brandColor, borderColor: brandColor, color: textOnBrand }
                    : { backgroundColor: 'transparent', borderColor: '#d1d5db', color: '#9ca3af' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

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

            {orderType === 'delivery' && (
              <>
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
                  <div className="space-y-2">
                    {/* كروت المواقع المحفوظة */}
                    {savedLocations.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 text-right mb-1.5 uppercase tracking-wider">مواقع سابقة</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-row-reverse">
                          {savedLocations.map(loc => (
                            <div key={loc.id} className="flex-shrink-0 flex items-center bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  setClientLat(loc.lat);
                                  setClientLng(loc.lng);
                                  if (loc.address) setAddressDetails(loc.address);
                                  setLocationConfirmed(true);
                                }}
                                className="flex items-center gap-2 px-3 py-2.5 active:scale-95 transition-all"
                              >
                                <div className="w-6 h-6 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                                  <MapPin size={12} className="text-red-500" />
                                </div>
                                <p className="text-xs font-bold text-gray-700 dark:text-slate-200 max-w-[110px] truncate text-right">
                                  {loc.address || `${loc.lat.toFixed(4)}° ${loc.lng.toFixed(4)}°`}
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={() => { deleteSavedLocation(loc.id); setSavedLocations(loadSavedLocations()); }}
                                className="pr-2 pl-3 py-2.5 text-gray-300 dark:text-slate-600 active:text-red-400 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <button type="button" onClick={openMap}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                      style={{ backgroundColor: '#ef4444', color: '#ffffff', boxShadow: '0 4px 14px #ef444450' }}>
                      <MapPin size={17} />
                      اضغط هنا لتحديد الموقع
                    </button>
                  </div>
                )}

                {/* تفاصيل العنوان */}
                <input id="address-details-input" type="text" value={addressDetails} onChange={e => { setAddressDetails(e.target.value); if (addressError) setAddressError(false); }}
                  placeholder="تفاصيل العنوان — أقرب دالة *" dir="rtl"
                  className={`w-full bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 border-2 transition-colors${addressError ? ' shake border-red-500' : ' border-gray-200 dark:border-slate-600'}`}
                  style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                />
              </>
            )}

            {/* كوبون الخصم — يظهر فقط إن فعّله المالك من الإعدادات */}
            {coupon_enabled && coupon_code && (
              <div className="pt-1">
                <div className="flex items-center bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden focus-within:ring-2"
                  style={{ '--tw-ring-color': brandColor } as React.CSSProperties}>
                  <div className="px-3 py-3 border-l border-gray-200 dark:border-slate-600 flex-shrink-0">
                    <Ticket size={16} className="text-gray-400" />
                  </div>
                  <input type="text" value={couponInput}
                    onChange={e => { setCouponInput(e.target.value); setCouponMsg(null); setAppliedCouponPct(0); }}
                    placeholder="كود الكوبون (اختياري)" dir="rtl"
                    className="flex-1 bg-transparent px-3 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none"
                  />
                  <button type="button" onClick={applyCoupon} disabled={!couponInput.trim()}
                    className="px-4 py-3 text-sm font-bold flex-shrink-0 disabled:opacity-40 active:scale-95 transition-all"
                    style={{ color: brandColor }}>
                    تطبيق
                  </button>
                </div>
                {couponMsg && (
                  <p className={`text-xs font-bold mt-1.5 text-right ${couponMsg.ok ? 'text-green-500' : 'text-red-500'}`}>
                    {couponMsg.ok ? '✓' : '✕'} {couponMsg.text}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── الإجمالي + زر الإرسال ── */}
        <div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              {discountAmount > 0 && (
                <span className="text-gray-400 text-sm line-through">{(grandTotal + discountAmount).toLocaleString()}</span>
              )}
              <span className="font-bold text-xl" style={{ color: brandColor }}>{grandTotal.toLocaleString()} د.ع</span>
            </div>
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
      <ClientBottomNav />
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
              <button onClick={() => { setShowOrderReview(false); if (reviewAutoOpenedRef.current) { reviewAutoOpenedRef.current = false; router.back(); } }}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 active:scale-90">
                <X size={17}/>
              </button>
              <div className="text-center">
                <p className="font-black text-gray-900 dark:text-white text-sm">مراجعة طلبك</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">{items.length} وجبة · {total.toLocaleString()} د.ع</p>
              </div>
              <button onClick={() => { if (confirm('هل تريد حذف كل شيء؟')) { clearCart(); setShowOrderReview(false); if (reviewAutoOpenedRef.current) { reviewAutoOpenedRef.current = false; router.back(); } } }}
                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all" style={{ backgroundColor: '#ef444420' }}>
                <Trash2 size={17} style={{ color: '#ef4444' }}/>
              </button>
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
                          <p className="text-xs font-bold text-right mb-1.5" style={{ color: '#ef4444' }}>الإضافات:</p>
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
                        style={{ '--tw-ring-color': '#ef4444', fontSize: 16 } as React.CSSProperties}
                      />
                    </div>
                  </div>
                );
              })}

            </div>

            {/* Footer ثابت — المجموع الكلي + زر التالي */}
            <div className="flex-shrink-0 px-4 pb-5 pt-3 border-t border-gray-100 dark:border-slate-700">
              {minOrderShortfall > 0 && (
                <p className={`text-xs font-bold text-center mb-2 ${minOrderShake ? 'shake' : ''}`} style={{ color: '#ef4444' }} dir="rtl">
                  الحد الأدنى للطلب {min_order_amount.toLocaleString()} د.ع — أضف {minOrderShortfall.toLocaleString()} د.ع أخرى
                </p>
              )}
              <button onClick={proceedFromReview}
                className={`w-full rounded-xl px-4 py-3 flex items-center justify-between transition-all active:scale-95${minOrderShortfall > 0 ? ' opacity-60' : ''}`}
                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 12px #ef444440' }}>
                <div className="flex items-center gap-1">
                  <ChevronLeft size={15} className="text-white"/>
                  <span className="font-black text-white text-xs">التالي</span>
                </div>
                <div className="text-right">
                  <motion.p
                    className="font-black text-white text-base leading-tight"
                    animate={cartPriceFlash ? { color: ['#ffffff', '#ffd700', '#ffffff'], scale: [1, 1.2, 1, 1.1, 1] } : {}}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  >{grandTotal.toLocaleString()} <span className="text-[10px] font-bold opacity-80">د.ع</span></motion.p>
                  <p className="text-[9px] text-white/70 font-bold">المجموع الكلي</p>
                </div>
              </button>
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

              {/* رسوم التوصيل */}
              {deliveryFee > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="font-bold text-gray-500 dark:text-slate-400 text-sm">{deliveryFee.toLocaleString()} د.ع</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">🛵 رسوم التوصيل</span>
                </div>
              )}

              {/* Total */}
              <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg,#ef444412,#ef444406)', border: '1.5px solid #ef444435' }}>
                <motion.span
                  className="font-black text-xl"
                  animate={cartPriceFlash ? { color: ['#dc2626', '#dc2626', '#ef4444'], scale: [1, 1.15, 1, 1.1, 1] } : {}}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  style={{ color: '#ef4444' }}
                >{grandTotal.toLocaleString()} د.ع</motion.span>
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
              <p className="font-bold" style={{ color: '#ef4444' }}>
                {orderType === 'delivery' ? 'موقعك:' : 'استلام الطلب'}
              </p>
              <div className="w-9"/>
            </div>

            {/* Mini map */}
            {orderType === 'delivery' && clientLat && clientLng && (
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
              {orderType === 'delivery' && (
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
              )}

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
              <button onClick={() => { setShowConfirmModal(false); setEditing(true); }} disabled={loading}
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
          مودال ما بعد الطلب — إنشاء حساب أو استمرار كضيف
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showPostOrderModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.78, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.78, opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden"
            style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)' }}
          >
            {/* ── شاشة الاختيار ── */}
            {postOrderStep === 'choice' && (
              <>
                {/* ─── Banner أخضر علوي ─── */}
                <div className="relative overflow-hidden text-center" style={{ background: 'linear-gradient(145deg,#15803d,#22c55e)', padding: '36px 24px 48px' }}>
                  {/* دوائر خلفية زخرفية */}
                  <div style={{ position:'absolute', top:-30, right:-30, width:130, height:130, borderRadius:'50%', background:'rgba(255,255,255,0.07)', pointerEvents:'none' }}/>
                  <div style={{ position:'absolute', bottom:-40, left:-20, width:110, height:110, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }}/>
                  <div style={{ position:'absolute', top:10, left:30, width:60, height:60, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }}/>

                  {/* أيقونة النجاح مع حلقة نابضة */}
                  <div className="relative inline-flex items-center justify-center mb-4">
                    <div className="absolute" style={{ width:88, height:88, borderRadius:'50%', background:'rgba(255,255,255,0.12)', animation:'ping 2s cubic-bezier(0,0,0.2,1) infinite' }}/>
                    <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(255,255,255,0.22)', border:'2.5px solid rgba(255,255,255,0.5)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
                      <CheckCircle2 size={38} color="white" strokeWidth={2.5}/>
                    </div>
                  </div>

                  <h2 style={{ color:'white', fontWeight:900, fontSize:22, marginBottom:6, letterSpacing:-0.3 }}>تم إرسال طلبك!</h2>
                  <p style={{ color:'rgba(255,255,255,0.88)', fontWeight:700, fontSize:15 }}>
                    أهلاً {name.split(' ')[0] || 'زبوننا الكريم'} 👋
                  </p>
                </div>

                {/* ─── شريط العداد التنازلي ─── */}
                <div style={{ height:4, background:'#f1f5f9' }} className="dark:bg-slate-800">
                  <div style={{ height:'100%', background:'linear-gradient(90deg,#22c55e,#16a34a)', width:`${(postOrderCountdown / 7) * 100}%`, transition:'width 1s linear', borderRadius:'0 2px 2px 0' }}/>
                </div>

                {/* ─── المحتوى ─── */}
                <div className="px-6 pt-5 pb-6">
                  <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed mb-5 text-center">
                    أنشئ حساباً مجانياً لتتابع طلبك من أي جهاز وتوفّر وقتك في طلباتك القادمة.
                  </p>

                  <div className="space-y-3">
                    {/* زر إنشاء الحساب */}
                    <button
                      onClick={() => {
                        if (postOrderTimerRef.current) { clearTimeout(postOrderTimerRef.current); postOrderTimerRef.current = null; }
                        if (session) router.push('/track'); else setPostOrderStep('signup');
                      }}
                      className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-all flex items-center justify-center gap-2"
                      style={{ background:'linear-gradient(135deg,#2563eb,#3b82f6)', color:'white', boxShadow:'0 8px 24px rgba(59,130,246,0.4)' }}
                    >
                      <UserCircle size={20}/>
                      إنشاء حساب ومتابعة طلبي
                    </button>

                    {/* زر الضيف مع العداد */}
                    <button
                      onClick={() => {
                        if (postOrderTimerRef.current) { clearTimeout(postOrderTimerRef.current); postOrderTimerRef.current = null; }
                        router.push('/track');
                      }}
                      className="w-full py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 border dark:border-slate-700 border-gray-200 text-gray-500 dark:text-slate-400"
                    >
                      متابعة كضيف
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black"
                        style={{ background:'#f1f5f9', color:'#6b7280', minWidth:24 }}>
                        {postOrderCountdown}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── شاشة إنشاء الحساب ── */}
            {postOrderStep === 'signup' && (
              <>
                {/* Banner أزرق مصغّر */}
                <div className="relative overflow-hidden flex items-center gap-3 px-5 py-5" style={{ background:'linear-gradient(135deg,#1d4ed8,#3b82f6)' }}>
                  <div style={{ position:'absolute', top:-20, right:-20, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,0.08)', pointerEvents:'none' }}/>
                  <button
                    onClick={() => { setPostOrderStep('choice'); setAuthError(''); }}
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-all"
                    style={{ background:'rgba(255,255,255,0.18)', border:'1.5px solid rgba(255,255,255,0.3)' }}
                  >
                    <ChevronLeft size={18} color="white" style={{ transform:'rotate(180deg)' }}/>
                  </button>
                  <div className="flex-1 text-right">
                    <h3 style={{ color:'white', fontWeight:900, fontSize:18 }}>إنشاء حساب</h3>
                    <p style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>رقم هاتفك + كلمة مرور فقط</p>
                  </div>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <UserCircle size={20} color="white"/>
                  </div>
                </div>

                <div className="px-6 pt-5 pb-6">
                  {signupDone ? (
                    <div className="text-center py-4">
                      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ background:'linear-gradient(135deg,#dcfce7,#bbf7d0)', border:'2px solid #86efac' }}>
                        <CheckCircle2 size={40} className="text-green-600"/>
                      </div>
                      <h3 className="font-black text-gray-900 dark:text-white text-xl mb-2">تم إنشاء حسابك!</h3>
                      <p className="text-gray-400 dark:text-slate-500 text-sm mb-6">يمكنك الآن متابعة طلبك من أي جهاز</p>
                      <button
                        onClick={() => router.push('/track')}
                        className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-all"
                        style={{ background:'linear-gradient(135deg,#16a34a,#22c55e)', color:'white', boxShadow:'0 8px 24px rgba(34,197,94,0.35)' }}
                      >
                        متابعة الطلب
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* رقم الهاتف — للعرض فقط، مأخوذ من الطلب تلقائياً */}
                      <div>
                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-2 text-right">رقم الهاتف</p>
                        <div className="flex items-center rounded-xl overflow-hidden"
                          style={{ background:'#eff6ff', border:'1.5px solid #bfdbfe' }}>
                          <div className="flex items-center gap-1.5 px-3 py-3 border-r border-blue-200 flex-shrink-0">
                            <span className="text-base leading-none">🇮🇶</span>
                            <span className="text-sm font-bold text-blue-500">+964</span>
                          </div>
                          <span className="flex-1 px-3 py-3 text-right text-gray-900 font-bold text-sm select-all">
                            {authPhone}
                          </span>
                        </div>
                      </div>

                      {/* كلمة المرور */}
                      <div>
                        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-2 text-right">اختر كلمة مرور</p>
                        <input
                          value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          placeholder="كلمة المرور"
                          type="password"
                          autoFocus
                          className="w-full rounded-xl px-4 py-3 text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none"
                          style={{ background:'#f8fafc', border:'1.5px solid #e2e8f0', fontSize: 16 }}
                        />
                        <p className="text-xs text-gray-400 dark:text-slate-500 text-right mt-1.5">يجب أن تكون كلمة المرور ٦ أحرف أو أرقام على الأقل</p>
                      </div>

                      {authError && (
                        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
                          <X size={14} className="text-red-500 flex-shrink-0"/>
                          <p className="text-xs text-red-600 dark:text-red-400 text-right flex-1">{authError}</p>
                        </div>
                      )}

                      <button
                        onClick={async () => {
                          const trimPhone = authPhone.trim();
                          const trimPass  = authPassword.trim();
                          if (!trimPhone || !trimPass) { setAuthError('يرجى إدخال كلمة المرور'); return; }
                          setPhoneAuthLoading(true);
                          setAuthError('');
                          const email = `${trimPhone}@c.delivery`;
                          const { error } = await supabase.auth.signUp({
                            email,
                            password: trimPass,
                            options: {
                              data: {
                                delivery_phone:   trimPhone,
                                delivery_name:    name.trim() || '',
                                delivery_nickname: nickname.trim() || '',
                                delivery_address: addressDetails.trim() || '',
                                delivery_location: locationDesc.trim() || '',
                              },
                            },
                          });
                          setPhoneAuthLoading(false);
                          if (error) {
                            setAuthError(
                              error.message.includes('already registered')
                                ? 'هذا الرقم مسجّل بالفعل — جرّب تسجيل الدخول من صفحة معلوماتي'
                                : error.message
                            );
                          } else {
                            localStorage.setItem(KEYS.phone, trimPhone);
                            setSignupDone(true);
                          }
                        }}
                        disabled={phoneAuthLoading}
                        className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        style={{ background:'linear-gradient(135deg,#2563eb,#3b82f6)', color:'white', boxShadow:'0 8px 24px rgba(59,130,246,0.35)' }}
                      >
                        {phoneAuthLoading ? <Loader2 size={20} className="animate-spin"/> : 'إنشاء الحساب'}
                      </button>

                      <button
                        onClick={() => router.push('/track')}
                        className="w-full py-3 rounded-2xl font-semibold text-sm text-gray-400 dark:text-slate-500 active:scale-95 transition-all"
                      >
                        الاستمرار كضيف
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

    </div>
    </CustomerGuard>
  );
}
