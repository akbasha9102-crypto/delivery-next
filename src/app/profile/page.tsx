'use client';
import { useState, useEffect, useRef } from 'react';
import { ClientBottomNav } from '@/components/BottomNav';
import { User, Pencil, Check, Phone, LogOut, MapPin, Plus, Trash2, X, LocateFixed, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '@/context/SettingsContext';
import { CustomerGuard } from '@/components/CustomerGuard';
import { useDarkMode } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

const KEYS = {
  name:           'deliveryName',
  phone:          'deliveryPhone',
  nickname:       'deliveryNickname',
  addressDetails: 'deliveryAddressDetails',
  locationDesc:   'deliveryLocationDesc',
};

type SavedLocation = { id: string; lat: number; lng: number; address: string; savedAt: number };
const SAVED_LOCS_KEY = 'savedLocations_v1';
const MAX_SAVED_LOCS = 5;
const BASRA_CENTER: [number, number] = [30.5085, 47.7804];

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

function updateLocationAddress(id: string, address: string) {
  const updated = loadSavedLocations().map(l => l.id === id ? { ...l, address } : l);
  localStorage.setItem(SAVED_LOCS_KEY, JSON.stringify(updated));
}

function EditableRow({
  label,
  value,
  icon,
  type = 'text',
  color,
  pencilColor,
  onSave,
  maxLength,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  type?: string;
  color: string;
  pencilColor: string;
  onSave: (v: string) => void;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    if (draft.trim()) { onSave(draft.trim()); setEditing(false); }
  };

  return (
    <div className="flex justify-between items-center py-3.5 border-b border-gray-50 dark:border-slate-700 last:border-0">
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <button onClick={commit} className="active:scale-95 transition-all" style={{ color }}>
            <Check size={17} />
          </button>
          <input
            ref={inputRef}
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && commit()}
            dir="rtl"
            maxLength={maxLength}
            className="flex-1 bg-transparent border-b-2 text-right text-gray-900 dark:text-slate-100 outline-none text-sm py-0.5"
            style={{ borderColor: color }}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="active:scale-95 transition-all" style={{ color: pencilColor }}>
              <Pencil size={15} />
            </button>
            <span className="text-gray-800 dark:text-slate-200 font-semibold text-sm">
              {value || <span className="text-gray-400 text-xs">غير محدد</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 dark:text-slate-500 text-sm">{label}</span>
            <span style={{ color }}>{icon}</span>
          </div>
        </>
      )}
    </div>
  );
}


export default function ProfilePage() {
  const { dark } = useDarkMode();
  const { primary_color } = useSettings();

  const rawColor   = primary_color || '#e67e22';
  const isTooDark  = rawColor === '#000000' || rawColor.toLowerCase() === '#121212';
  const brandColor = dark && isTooDark ? '#ffffff' : rawColor;
  const pencilColor = dark ? brandColor : '#111827';

  const [name,        setName]        = useState('');
  const [phone,       setPhone]       = useState('');
  const [saved,       setSaved]       = useState(false);
  const [mounted,     setMounted]     = useState(false);
  const [session,          setSession]          = useState<Session | null>(null);
  const [authLoading,      setAuthLoading]      = useState(true);
  const [phoneAuthLoading, setPhoneAuthLoading] = useState(false);
  const [authPhone,        setAuthPhone]        = useState('');
  const [authPassword,     setAuthPassword]     = useState('');
  const [authError,        setAuthError]        = useState('');
  const [authMode,         setAuthMode]         = useState<'signin'|'signup'>('signin');

  // ── عناوين ────────────────────────────────────────────────────────────────
  const [savedLocations,    setSavedLocations]    = useState<SavedLocation[]>([]);
  const [showAddressPanel,  setShowAddressPanel]  = useState(false);
  const [editingAddressId,  setEditingAddressId]  = useState<string | null>(null);
  const [editDraft,         setEditDraft]         = useState('');

  // ── خريطة إضافة عنوان ────────────────────────────────────────────────────
  const [showAddMap,     setShowAddMap]     = useState(false);
  const [addMapLat,      setAddMapLat]      = useState<number | null>(null);
  const [addMapLng,      setAddMapLng]      = useState<number | null>(null);
  const [addAddressText, setAddAddressText] = useState('');
  const [addGpsLocating, setAddGpsLocating] = useState(false);
  const [addGpsAccuracy, setAddGpsAccuracy] = useState<number | null>(null);

  const addMapRef         = useRef<HTMLDivElement>(null);
  const addMapInstanceRef = useRef<any>(null);
  const addGpsWatchRef    = useRef<number | null>(null);
  const addPendingFlyRef  = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const addPreciseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setName(localStorage.getItem(KEYS.name)  || '');
    setPhone(localStorage.getItem(KEYS.phone) || '');
    setSavedLocations(loadSavedLocations());
    setMounted(true);
  }, []);

  useEffect(() => {
    const applySession = (s: typeof session) => {
      if (!s?.user) return;
      const meta = s.user.user_metadata as Record<string, string | undefined>;
      const fields: Array<[string, keyof typeof KEYS, string | undefined]> = [
        ['name',           'name',           meta?.delivery_name     || meta?.full_name],
        ['phone',          'phone',          meta?.delivery_phone],
        ['nickname',       'nickname',       meta?.delivery_nickname],
        ['addressDetails', 'addressDetails', meta?.delivery_address],
        ['locationDesc',   'locationDesc',   meta?.delivery_location],
      ];
      for (const [setter, key, val] of fields) {
        if (val && !localStorage.getItem(KEYS[key])) {
          localStorage.setItem(KEYS[key], val);
          if (setter === 'name')  setName(val);
          if (setter === 'phone') setPhone(val);
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      applySession(s);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      applySession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── تجميد الخلفية عند فتح الخريطة ────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = (showAddressPanel || showAddMap) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showAddressPanel, showAddMap]);

  // ── GPS helpers ───────────────────────────────────────────────────────────

  const stopAddGps = () => {
    if (addGpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(addGpsWatchRef.current);
      addGpsWatchRef.current = null;
    }
    if (addPreciseTimerRef.current) { clearTimeout(addPreciseTimerRef.current); addPreciseTimerRef.current = null; }
  };

  const startAddGps = (onPos: (lat: number, lng: number, accuracy: number) => void) => {
    stopAddGps();
    setAddGpsLocating(true);
    setAddGpsAccuracy(null);
    if (!('geolocation' in navigator)) { setAddGpsLocating(false); return; }
    let best = Infinity;
    addGpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setAddGpsAccuracy(Math.round(accuracy));
        if (accuracy < best) { best = accuracy; onPos(latitude, longitude, accuracy); }
        if (accuracy <= 30) { stopAddGps(); setAddGpsLocating(false); }
      },
      () => setAddGpsLocating(false),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  };

  const locateAddMe = () => {
    if (!addMapInstanceRef.current) return;
    startAddGps((lat, lng, accuracy) => {
      if (!addMapInstanceRef.current) return;
      const zoom = accuracy < 30 ? 18 : accuracy < 100 ? 17 : accuracy < 500 ? 16 : accuracy < 2000 ? 14 : 13;
      addMapInstanceRef.current.flyTo([lat, lng], zoom, { animate: true, duration: 0.8 });
    });
  };

  // ── فتح خريطة إضافة العنوان ───────────────────────────────────────────────

  useEffect(() => {
    if (document.querySelector('link[data-leaflet-css]')) return;
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.setAttribute('data-leaflet-css', '1');
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    if (!showAddMap) return;
    const t = setTimeout(() => {
      if (!addMapRef.current || addMapInstanceRef.current) return;
      import('leaflet').then((mod) => {
        const L = (mod as any).default ?? mod;
        if (!addMapRef.current || addMapInstanceRef.current) return;
        const center: [number, number] = BASRA_CENTER;
        const map = L.map(addMapRef.current, { zoomControl: false, attributionControl: false }).setView(center, 13);
        addMapInstanceRef.current = map;
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19,
        }).addTo(map);
        setTimeout(() => map.invalidateSize({ pan: false }), 100);
        setTimeout(() => map.invalidateSize({ pan: false }), 500);
        map.on('moveend', () => { const c = map.getCenter(); setAddMapLat(c.lat); setAddMapLng(c.lng); });
        if (addPendingFlyRef.current) {
          const { lat, lng, accuracy } = addPendingFlyRef.current;
          map.setView([lat, lng], accuracy < 100 ? 17 : 14);
          addPendingFlyRef.current = null;
        }
        // بدء GPS تلقائياً
        startAddGps((lat, lng, accuracy) => {
          const zoom = accuracy < 30 ? 18 : accuracy < 100 ? 17 : accuracy < 500 ? 16 : 13;
          if (addMapInstanceRef.current) {
            addMapInstanceRef.current.flyTo([lat, lng], zoom, { animate: true, duration: 0.8 });
          } else {
            addPendingFlyRef.current = { lat, lng, accuracy };
          }
        });
      });
    }, 80);
    return () => {
      clearTimeout(t);
      if (addMapInstanceRef.current) { addMapInstanceRef.current.remove(); addMapInstanceRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddMap]);

  const openAddMap = () => {
    setAddMapLat(BASRA_CENTER[0]);
    setAddMapLng(BASRA_CENTER[1]);
    setAddAddressText('');
    setShowAddMap(true);
  };

  const closeAddMap = () => {
    stopAddGps();
    if (addMapInstanceRef.current) { addMapInstanceRef.current.remove(); addMapInstanceRef.current = null; }
    addPendingFlyRef.current = null;
    setShowAddMap(false);
    setAddGpsLocating(false);
    setAddGpsAccuracy(null);
  };

  const confirmAddLocation = () => {
    stopAddGps();
    if (addMapInstanceRef.current) { addMapInstanceRef.current.remove(); addMapInstanceRef.current = null; }
    addPendingFlyRef.current = null;
    if (addMapLat !== null && addMapLng !== null) {
      const loc: SavedLocation = {
        id: Date.now().toString(),
        lat: addMapLat,
        lng: addMapLng,
        address: addAddressText.trim(),
        savedAt: Date.now(),
      };
      persistSavedLocation(loc);
      setSavedLocations(loadSavedLocations());
    }
    setShowAddMap(false);
    setAddGpsLocating(false);
    setAddGpsAccuracy(null);
  };

  const handleAuth = async () => {
    const trimPhone = authPhone.trim();
    const trimPass  = authPassword.trim();
    if (!trimPhone || !trimPass) {
      setAuthError('يرجى إدخال رقم الهاتف وكلمة المرور');
      return;
    }
    setPhoneAuthLoading(true);
    setAuthError('');
    const email = `${trimPhone}@c.delivery`;
    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password: trimPass,
        options: { data: { delivery_phone: trimPhone, delivery_name: name || '' } },
      });
      if (error) {
        setAuthError(
          error.message.includes('already registered')
            ? 'هذا الرقم مسجّل، جرّب تسجيل الدخول'
            : error.message
        );
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
        localStorage.setItem(KEYS.phone, trimPhone);
        setPhone(trimPhone);
      }
    }
    setPhoneAuthLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const saveName  = (v: string) => { setName(v);  localStorage.setItem(KEYS.name,  v); flash(); };
  const savePhone = (v: string) => { setPhone(v); localStorage.setItem(KEYS.phone, v); flash(); };
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  if (!mounted) return null;

  return (
    <CustomerGuard>
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32 md:pr-[70px]">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-center text-gray-900 dark:text-white">معلوماتي</h1>
      </header>

      <div className="px-4 pt-5 max-w-lg mx-auto space-y-4">

        {/* Avatar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-20 h-20 rounded-full flex items-center justify-center bg-blue-600 shadow-lg shadow-blue-500/40">
            {name ? (
              <span className="text-white font-bold text-base text-center leading-tight px-2 break-words max-w-full">
                {name}
              </span>
            ) : (
              <User size={36} className="text-white" />
            )}
          </div>
        </div>

        {/* Personal info */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-2 border-b border-gray-50 dark:border-slate-700 text-right">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 py-2">معلوماتك الشخصية</h3>
          </div>
          <div className="px-5 pb-2">
            <EditableRow label="الاسم"   value={name}  icon={<User  size={14}/>} color={brandColor} pencilColor={pencilColor} onSave={saveName}  />
            <EditableRow label="الهاتف"  value={phone} icon={<Phone size={14}/>} color={brandColor} pencilColor={pencilColor} onSave={savePhone} type="tel" maxLength={11} />
          </div>
        </div>

        {/* ── العناوين ── */}
        <button
          onClick={() => setShowAddressPanel(true)}
          className="w-full bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden active:scale-[0.98] transition-all text-right"
        >
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChevronRight size={16} className="text-gray-400 dark:text-slate-500" style={{ transform: 'rotate(180deg)' }}/>
              <span className="text-xs text-gray-400 dark:text-slate-500">
                {savedLocations.length > 0 ? `${savedLocations.length} عنوان محفوظ` : 'لا توجد عناوين'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-slate-100">العناوين</span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}18` }}>
                <MapPin size={16} style={{ color: brandColor }}/>
              </div>
            </div>
          </div>
        </button>

        {saved && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-center">
            <p className="text-green-700 dark:text-green-400 font-semibold text-sm">✓ تم الحفظ</p>
          </div>
        )}

        {/* قسم تسجيل الدخول بالهاتف */}
        {!authLoading && (
          session ? (
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-red-600 text-white font-bold text-sm active:scale-95 transition-all"
            >
              <LogOut size={18} />
              تسجيل الخروج
            </button>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50 dark:border-slate-700 flex items-center justify-between">
                <div className="flex gap-3 text-sm font-bold">
                  <button
                    onClick={() => { setAuthMode('signin'); setAuthError(''); }}
                    className={`pb-0.5 transition-all ${authMode === 'signin' ? 'text-gray-900 dark:text-white border-b-2' : 'text-gray-400 dark:text-slate-500'}`}
                    style={authMode === 'signin' ? { borderColor: brandColor } : {}}
                  >تسجيل الدخول</button>
                  <button
                    onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                    className={`pb-0.5 transition-all ${authMode === 'signup' ? 'text-gray-900 dark:text-white border-b-2' : 'text-gray-400 dark:text-slate-500'}`}
                    style={authMode === 'signup' ? { borderColor: brandColor } : {}}
                  >إنشاء حساب</button>
                </div>
                <Phone size={16} className="text-gray-400"/>
              </div>
              <div className="px-5 py-4 space-y-3">
                <input
                  value={authPhone}
                  onChange={e => setAuthPhone(e.target.value.replace(/\D/g,'').slice(0,11))}
                  placeholder="رقم الهاتف"
                  type="tel"
                  dir="rtl"
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none text-sm"
                />
                <input
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  type="password"
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none text-sm"
                />
                {authError && <p className="text-xs text-red-500 text-right">{authError}</p>}
                <button
                  onClick={handleAuth}
                  disabled={phoneAuthLoading}
                  className="w-full py-3 rounded-xl font-black text-white text-sm active:scale-95 transition-all disabled:opacity-60 bg-blue-600"
                >
                  {phoneAuthLoading ? '...' : authMode === 'signin' ? 'دخول' : 'إنشاء حساب'}
                </button>
              </div>
            </div>
          )
        )}

        {session && (
          <p className="text-center text-xs text-gray-400 dark:text-slate-600 pb-2">
            أنت مسجّل الدخول بحسابك
          </p>
        )}
      </div>

      <ClientBottomNav />
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        لوحة العناوين
    ══════════════════════════════════════════════════════════════════════ */}
    <AnimatePresence>
    {showAddressPanel && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) setShowAddressPanel(false); }}
      >
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 32 }}
          className="w-full bg-white dark:bg-slate-900 rounded-t-3xl flex flex-col"
          style={{ maxHeight: '85vh' }}
        >
          {/* Drag pill */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700"/>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
            <button
              onClick={() => setShowAddressPanel(false)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 active:scale-90"
            >
              <X size={17}/>
            </button>
            <p className="font-bold text-gray-900 dark:text-white">عناوينك المحفوظة</p>
            <div className="w-9"/>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
            {savedLocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-gray-100 dark:bg-slate-800">
                  <MapPin size={28} className="text-gray-300 dark:text-slate-600"/>
                </div>
                <p className="font-bold text-gray-400 dark:text-slate-500 text-sm">لا توجد عناوين محفوظة</p>
                <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">اضغط الزر أدناه لإضافة عنوان</p>
              </div>
            ) : (
              savedLocations.map((loc, idx) => (
                <div
                  key={loc.id}
                  className="bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden"
                >
                  <div className="p-3.5 flex items-start gap-3">
                    {/* رقم العنوان */}
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: `${brandColor}18` }}>
                      <span className="text-xs font-black" style={{ color: brandColor }}>{idx + 1}</span>
                    </div>

                    {/* نص العنوان */}
                    <div className="flex-1 min-w-0 text-right">
                      {editingAddressId === loc.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              updateLocationAddress(loc.id, editDraft.trim());
                              setSavedLocations(loadSavedLocations());
                              setEditingAddressId(null);
                            }}
                            className="flex-shrink-0 active:scale-90 transition-all"
                            style={{ color: brandColor }}
                          >
                            <Check size={16}/>
                          </button>
                          <input
                            autoFocus
                            type="text"
                            value={editDraft}
                            onChange={e => setEditDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                updateLocationAddress(loc.id, editDraft.trim());
                                setSavedLocations(loadSavedLocations());
                                setEditingAddressId(null);
                              }
                            }}
                            dir="rtl"
                            className="flex-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-500 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-slate-100 outline-none text-right"
                          />
                        </div>
                      ) : (
                        <>
                          <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm leading-snug truncate">
                            {loc.address || <span className="text-gray-400 text-xs">بدون وصف</span>}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 font-mono">
                            {loc.lat.toFixed(4)}° {loc.lng.toFixed(4)}°
                          </p>
                        </>
                      )}
                    </div>

                    {/* أزرار التحكم */}
                    {editingAddressId !== loc.id && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => { setEditingAddressId(loc.id); setEditDraft(loc.address); }}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 active:scale-90 transition-all"
                        >
                          <Pencil size={13} className="text-gray-400 dark:text-slate-500"/>
                        </button>
                        <button
                          onClick={() => {
                            deleteSavedLocation(loc.id);
                            setSavedLocations(loadSavedLocations());
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 active:scale-90 transition-all"
                        >
                          <Trash2 size={13} className="text-red-400"/>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer — زر إضافة عنوان */}
          <div className="flex-shrink-0 px-4 pb-8 pt-3 border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={() => { setShowAddressPanel(false); openAddMap(); }}
              className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`, color: '#fff', boxShadow: `0 6px 20px ${brandColor}40` }}
            >
              <Plus size={18}/>
              إضافة عنوان جديد
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
    </AnimatePresence>

    {/* ══════════════════════════════════════════════════════════════════════
        خريطة إضافة عنوان جديد
    ══════════════════════════════════════════════════════════════════════ */}
    <AnimatePresence>
    {showAddMap && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex flex-col justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      >
        <style>{`
          @keyframes pin-pulse-p  { 0%   { transform:translate(-50%,0) scale(1); opacity:.55; } 100% { transform:translate(-50%,0) scale(3.5); opacity:0; } }
          @keyframes pin-bounce-p { 0%,100% { transform:translate(-50%,-100%) translateY(0); } 45% { transform:translate(-50%,-100%) translateY(-8px); } }
        `}</style>

        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 32 }}
          className="flex flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-slate-900"
          style={{ height: '92vh' }}
        >
          <div className="flex justify-center pt-3 pb-0.5 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700"/>
          </div>

          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
            <button
              onClick={() => { closeAddMap(); setShowAddressPanel(true); }}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 active:scale-90 transition-all"
            >
              <X size={17}/>
            </button>
            <div className="text-center">
              <p className="font-bold text-gray-900 dark:text-slate-100" style={{ fontSize: 15 }}>تحديد الموقع</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                {addGpsLocating ? 'جاري تحديد موقعك...' : 'حرّك الخريطة لضبط الدبوس'}
              </p>
            </div>
            <div className="w-9"/>
          </div>

          {/* Map */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <div ref={addMapRef} style={{ position: 'absolute', inset: 0 }}/>

            {/* Pin animations */}
            <div style={{ position:'absolute', top:'50%', left:'50%', width:18, height:18, borderRadius:'50%', background:'#ef4444', animation:'pin-pulse-p 2s ease-out infinite', zIndex:999, pointerEvents:'none' }}/>
            <div style={{ position:'absolute', top:'50%', left:'50%', animation:'pin-bounce-p 2.4s ease-in-out infinite', pointerEvents:'none', zIndex:1000, transform:'translate(-50%, -100%)' }}>
              <div style={{ width:42, height:42, background:'#ef4444', borderRadius:'50% 50% 50% 0', transform:'rotate(-45deg)', border:'3.5px solid white', boxShadow:'0 6px 20px #ef444470', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:11, height:11, background:'white', borderRadius:'50%', transform:'rotate(45deg)', opacity:0.9 }}/>
              </div>
            </div>
            <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, 4px)', width:14, height:6, background:'rgba(0,0,0,0.18)', borderRadius:'50%', pointerEvents:'none', zIndex:999, filter:'blur(2px)' }}/>

            {/* GPS accuracy badge */}
            {(addGpsLocating || addGpsAccuracy !== null) && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 rounded-full px-4 py-2 shadow-xl text-xs font-bold"
                style={{ background:'white', color: addGpsAccuracy !== null && addGpsAccuracy <= 50 ? '#16a34a' : addGpsAccuracy !== null && addGpsAccuracy <= 300 ? '#d97706' : brandColor }}>
                {addGpsLocating && addGpsAccuracy === null
                  ? <><Loader2 size={13} className="animate-spin"/> جاري تحديد موقعك...</>
                  : addGpsLocating && addGpsAccuracy !== null
                    ? <><Loader2 size={13} className="animate-spin"/> دقة: {addGpsAccuracy >= 1000 ? `${(addGpsAccuracy/1000).toFixed(1)}كم` : `${addGpsAccuracy}م`}</>
                  : addGpsAccuracy !== null && addGpsAccuracy <= 100
                    ? <><CheckCircle2 size={13}/> دقة ممتازة — {addGpsAccuracy}م</>
                    : <><MapPin size={13}/> دقة: {addGpsAccuracy !== null && addGpsAccuracy >= 1000 ? `${(addGpsAccuracy/1000).toFixed(1)}كم` : `${addGpsAccuracy}م`}</>
                }
              </div>
            )}

            {/* Locate me button */}
            <button
              onClick={locateAddMe}
              className="absolute bottom-4 right-4 z-[1000] rounded-full flex items-center justify-center active:scale-90 transition-all"
              style={{ width:50, height:50, background:'white', boxShadow:'0 4px 16px rgba(0,0,0,0.18)', border:'2px solid #ef444430' }}
            >
              {addGpsLocating
                ? <Loader2 size={22} className="animate-spin" style={{ color: '#ef4444' }}/>
                : <LocateFixed size={22} style={{ color: '#ef4444' }}/>
              }
            </button>
          </div>

          {/* Footer */}
          <div className="px-4 pt-3 pb-7 flex-shrink-0 bg-white dark:bg-slate-900 space-y-2.5" style={{ boxShadow:'0 -1px 0 rgba(0,0,0,0.06)' }}>
            <input
              type="text"
              value={addAddressText}
              onChange={e => setAddAddressText(e.target.value)}
              placeholder="وصف العنوان — مثال: بجانب الجامع الكبير"
              dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none text-sm"
            />
            <button
              onClick={confirmAddLocation}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{ background:'linear-gradient(135deg, #ef4444, #dc2626)', color:'#ffffff', boxShadow:'0 8px 24px #ef444450' }}
            >
              <CheckCircle2 size={20}/> حفظ العنوان
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
    </AnimatePresence>

    </CustomerGuard>
  );
}
