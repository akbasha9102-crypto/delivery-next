'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { Search, MessageSquare, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/context/SettingsContext';
import { CustomerGuard } from '@/components/CustomerGuard';
import { useDarkMode } from '@/context/ThemeContext';

const STEPS = [
  { key: 'pending',   label: 'انتظار',      icon: '⏳', desc: 'تم إرسال طلبك، بانتظار القبول' },
  { key: 'preparing', label: 'تجهيز',       icon: '🍳', desc: 'طلبك قيد التجهيز الآن' },
  { key: 'ready',     label: 'في الطريق',   icon: '🏍️', desc: 'طلبك في الطريق إليك' },
  { key: 'completed', label: 'تم التوصيل', icon: '🎉', desc: 'تم توصيل طلبك بنجاح' },
];

const CSS = `
  @keyframes line-fill { 0%{width:0%} 100%{width:100%} }
  @keyframes spin-w   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes road-m   { from{transform:translateX(0)} to{transform:translateX(-52px)} }
  @keyframes moto-b   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
  @keyframes speed-l  { 0%{opacity:0;transform:translateX(30px)} 60%{opacity:0.6} 100%{opacity:0;transform:translateX(-10px)} }
  @keyframes flame-l  { 0%,100%{transform:scaleY(1) skewX(-5deg)} 50%{transform:scaleY(1.3) skewX(6deg)} }
  @keyframes flame-m  { 0%,100%{transform:scaleY(1.1)} 50%{transform:scaleY(0.8) skewX(-4deg)} }
  @keyframes flame-r  { 0%,100%{transform:scaleY(0.95) skewX(5deg)} 50%{transform:scaleY(1.25) skewX(-6deg)} }
  @keyframes steam    { 0%{opacity:0;transform:translateY(0)} 45%{opacity:0.5} 100%{opacity:0;transform:translateY(-26px) scaleX(1.5)} }
  @keyframes sizzle   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.09)} }
  @keyframes confetti-a { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(55px) rotate(380deg);opacity:0} }
  @keyframes confetti-b { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(45px) rotate(-260deg);opacity:0} }
  @keyframes pop-in   { 0%{transform:scale(0)} 65%{transform:scale(1.15)} 100%{transform:scale(1)} }
  @keyframes doc-b    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes exhaust  { 0%{opacity:0.7;transform:translateX(0) scale(1)} 100%{opacity:0;transform:translateX(-20px) scale(2)} }
  @keyframes pan-x    { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes sway     { 0%,100%{transform:rotate(-1deg)} 50%{transform:rotate(1deg)} }
  @keyframes status-enter {
    0%   { opacity:0; transform:scale(0.82) translateY(18px) }
    60%  { transform:scale(1.04) translateY(-3px) }
    100% { opacity:1; transform:scale(1) translateY(0) }
  }
  @keyframes fire-glow {
    0%,100% { opacity:0.12 }
    50%     { opacity:0.22 }
  }
  @keyframes driver-slide-up {
    0%   { opacity:0; transform:translateY(40px) scale(0.95) }
    55%  { transform:translateY(-6px) scale(1.02) }
    75%  { transform:translateY(3px) scale(0.99) }
    100% { opacity:1; transform:translateY(0) scale(1) }
  }
  @keyframes driver-avatar-pop {
    0%   { transform:scale(0) rotate(-15deg) }
    60%  { transform:scale(1.18) rotate(6deg) }
    80%  { transform:scale(0.93) rotate(-3deg) }
    100% { transform:scale(1) rotate(0deg) }
  }
  @keyframes driver-name-reveal {
    0%   { opacity:0; transform:translateX(16px) }
    100% { opacity:1; transform:translateX(0) }
  }
  @keyframes driver-ring-pulse {
    0%     { transform:scale(1);    opacity:0.55 }
    18.5%  { transform:scale(1.55); opacity:0 }
    26.5%  { transform:scale(1);    opacity:0 }
    100%   { transform:scale(1);    opacity:0 }
  }
  @keyframes driver-ring-pulse2 {
    0%     { transform:scale(1);    opacity:0.35 }
    18.5%  { transform:scale(1.75); opacity:0 }
    26.5%  { transform:scale(1);    opacity:0 }
    100%   { transform:scale(1);    opacity:0 }
  }
  @keyframes driver-accepted-glow {
    0%,100% { box-shadow: 0 0 0 0 rgba(156,163,175,0) }
    50%     { box-shadow: 0 0 0 8px rgba(156,163,175,0.45) }
  }
`;

function PendingAnimation() {
  return (
    <div className="w-32 h-32 mx-auto flex items-center justify-center">
      <style>{CSS}</style>
      <svg viewBox="0 0 100 100" fill="none" className="w-full h-full"
           style={{ animation: 'doc-b 1.2s ease-in-out infinite' }}>
        <rect x="18" y="8" width="64" height="78" rx="7" fill="#fff3e0" stroke="#e67e22" strokeWidth="3"/>
        <rect x="18" y="8" width="64" height="20" rx="7" fill="#e67e22"/>
        <rect x="18" y="20" width="64" height="8" fill="#e67e22"/>
        <line x1="30" y1="42" x2="70" y2="42" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="30" y1="54" x2="70" y2="54" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="30" y1="66" x2="52" y2="66" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="68" cy="74" r="14" fill="#e67e22"/>
        <path d="M 61 74 L 66 79 L 76 67" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function PreparingAnimation() {
  return (
    <div className="relative w-44 h-44 mx-auto flex items-end justify-center">
      <style>{CSS}</style>
      <svg viewBox="0 0 140 130" className="w-full h-full">

        {/* ── FLAMES — drawn first so pan covers their bases ── */}
        {/* orange glow under pan */}
        <ellipse cx="70" cy="100" rx="46" ry="14" fill="#ff6b00"
                 style={{ animation: 'fire-glow 0.8s ease-in-out infinite' }}/>
        {/* left flame */}
        <path d="M42 128 C38 116 34 109 38 97 C41 105 46 102 44 113 C48 103 53 98 50 87 C56 96 57 108 52 128Z"
              fill="#ff6b00" style={{ transformOrigin:'46px 128px', animation:'flame-l 0.55s ease-in-out infinite' }}/>
        {/* center flame (tallest — tip hidden by pan) */}
        <path d="M63 126 C59 111 53 102 59 87 C63 98 69 95 66 108 C71 96 77 90 73 76 C81 88 83 104 76 126Z"
              fill="#ff4500" style={{ transformOrigin:'68px 126px', animation:'flame-m 0.45s ease-in-out infinite' }}/>
        {/* right flame */}
        <path d="M88 128 C84 116 81 109 85 97 C87 105 92 102 90 113 C94 103 97 98 95 87 C100 96 102 108 97 128Z"
              fill="#ff6b00" style={{ transformOrigin:'91px 128px', animation:'flame-r 0.65s ease-in-out infinite' }}/>
        {/* inner bright yellow flame */}
        <path d="M57 125 C56 112 62 105 67 98 C69 107 72 104 70 115 C74 106 78 100 75 89 C82 100 82 113 77 125Z"
              fill="#ffb300" opacity="0.9" style={{ transformOrigin:'68px 125px', animation:'flame-m 0.38s ease-in-out infinite reverse' }}/>

        {/* ── BURNER RING — sits between flames and pan ── */}
        <ellipse cx="70" cy="85" rx="43" ry="5.5" fill="#37474f"/>
        <ellipse cx="70" cy="84" rx="36" ry="3.5" fill="#263238"/>

        {/* ── PAN — drawn after flames, covers their upper halves ── */}
        <ellipse cx="70" cy="77" rx="45" ry="6"  fill="#00000012"/>
        <ellipse cx="70" cy="71" rx="44" ry="13" fill="#757575"/>
        <ellipse cx="70" cy="67" rx="44" ry="13" fill="#9e9e9e"/>
        <ellipse cx="70" cy="65" rx="40" ry="10" fill="#bdbdbd"/>
        <path d="M112 60 Q130 58 133 64 Q130 70 112 70Z" fill="#616161"/>
        <path d="M112 61 Q129 59 132 64 Q129 69 112 69Z" fill="#757575"/>

        {/* ── FOOD inside pan ── */}
        <ellipse cx="52" cy="61" rx="14" ry="7" fill="#ef9a9a"
                 style={{ transformOrigin:'52px 61px', animation:'sizzle 0.7s ease-in-out infinite' }}/>
        <ellipse cx="83" cy="60" rx="11" ry="6" fill="#fff9c4"
                 style={{ transformOrigin:'83px 60px', animation:'sizzle 0.85s ease-in-out infinite 0.2s' }}/>
        <circle cx="83" cy="60" r="4" fill="#ffcc02"/>
        <ellipse cx="67" cy="57" rx="7" ry="4" fill="#a5d6a7" opacity="0.9"
                 style={{ transformOrigin:'67px 57px', animation:'sizzle 0.6s ease-in-out infinite 0.1s' }}/>

        {/* ── STEAM — drawn last, above everything ── */}
        <path d="M52 52 Q49 40 52 28 Q55 18 52 6" stroke="#b0bec5" strokeWidth="2.5" strokeLinecap="round" fill="none"
              style={{ animation: 'steam 1.6s ease-out infinite' }}/>
        <path d="M70 49 Q67 35 70 22 Q73 12 70 -1" stroke="#b0bec5" strokeWidth="2.5" strokeLinecap="round" fill="none"
              style={{ animation: 'steam 1.6s ease-out infinite 0.55s' }}/>
        <path d="M88 52 Q85 41 88 30" stroke="#b0bec5" strokeWidth="2" strokeLinecap="round" fill="none"
              style={{ animation: 'steam 1.6s ease-out infinite 1.1s' }}/>

      </svg>
    </div>
  );
}



function CompletedAnimation() {
  return (
    <div className="w-32 h-32 mx-auto relative">
      <style>{CSS}</style>
      <div className="absolute top-1 left-3 w-3 h-3 bg-yellow-400 rounded-sm"  style={{ animation:'confetti-a 1.4s ease-in infinite' }}/>
      <div className="absolute top-3 right-3 w-2 h-4 bg-pink-400 rounded-sm"   style={{ animation:'confetti-b 1.4s ease-in infinite 0.3s' }}/>
      <div className="absolute top-1 right-9 w-3 h-2 bg-blue-400 rounded-sm"   style={{ animation:'confetti-a 1.4s ease-in infinite 0.6s' }}/>
      <div className="absolute top-5 left-9 w-2 h-3 bg-green-400 rounded-sm"   style={{ animation:'confetti-b 1.4s ease-in infinite 0.9s' }}/>
      <div className="absolute top-2 left-1/2 w-2 h-2 bg-purple-400 rounded-sm" style={{ animation:'confetti-a 1.4s ease-in infinite 0.45s' }}/>
      <svg viewBox="0 0 100 100" className="w-full h-full relative z-10" style={{ animation:'pop-in 0.5s ease-out' }}>
        <circle cx="50" cy="50" r="44" fill="#e67e22"/>
        <path d="M28 50 L44 66 L72 34" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    </div>
  );
}

const STATUS_ANIMATION: Record<string, React.ReactNode> = {
  pending:   <PendingAnimation />,
  preparing: <PreparingAnimation />,
  pickup:    <PreparingAnimation />,
  completed: <CompletedAnimation />,
  rejected:  null,
};

type Order = {
  id: string; client_name: string; client_phone: string;
  delivery_address: string | null; total_amount: number;
  status: string; created_at: string;
  driver_id?: string | null;
  driver_name?: string | null; driver_phone?: string | null;
  driver_arrived?: boolean | null;
  driver_lat?: number | null; driver_lng?: number | null;
  client_lat?: number | null; client_lng?: number | null;
};


const MOTO_ICON_HTML = `<div style="width:46px;height:46px;background:#2563eb;border-radius:50%;border:3px solid white;box-shadow:0 4px 16px rgba(37,99,235,0.45);display:flex;align-items:center;justify-content:center;font-size:24px;line-height:1;">🏍️</div>`;

export default function TrackPage() {
  const { dark } = useDarkMode();
  const { primary_color } = useSettings();
  
  const rawColor   = primary_color || "#e67e22";
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

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const order = orders.find(o => o.id === selectedOrderId) ?? null;
  const [notFound, setNotFound] = useState(false);
  const [inputPhone, setInputPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [driverPhone, setDriverPhone] = useState<string | null>(null);

  // Keep driverPhone in sync — use order.driver_phone if set,
  // otherwise look it up from the drivers table via driver_id.
  useEffect(() => {
    if (!order?.driver_id) { setDriverPhone(null); return; }
    if (order.driver_phone) { setDriverPhone(order.driver_phone); return; }
    supabase.from('drivers').select('phone').eq('id', order.driver_id).single()
      .then(({ data }) => { if (data?.phone) setDriverPhone(data.phone); });
  }, [order?.driver_id, order?.driver_phone]);

  useEffect(() => {
    if (!order || order.status !== 'pending') return;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [order?.status]);

  const pendingCountdown = useMemo(() => {
    if (!order?.created_at || order.status !== 'pending') return null;
    void tick;
    const total   = 5 * 60;
    const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000);
    const secs    = Math.max(0, total - elapsed);
    const pct     = secs / total;
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return { secs, pct, label: `${m}:${s}`, urgent: secs <= 60 };
  }, [order?.created_at, order?.status, tick]);

  // حفظ معلومات التوصيل في حساب جوجل بعد العودة من OAuth
  useEffect(() => {
    if (localStorage.getItem('pendingProfileSave') !== '1') return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const deliveryName  = localStorage.getItem('deliveryName')  || '';
      const deliveryPhone = localStorage.getItem('deliveryPhone') || '';
      if (deliveryName || deliveryPhone) {
        await supabase.auth.updateUser({
          data: { delivery_name: deliveryName, delivery_phone: deliveryPhone },
        });
      }
      localStorage.removeItem('pendingProfileSave');
    });
  }, []);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackStep, setFeedbackStep] = useState<'choose' | 'write'>('choose');
  const [feedbackType, setFeedbackType] = useState<'feedback' | 'complaint'>('feedback');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [alreadySentFeedback, setAlreadySentFeedback] = useState(false);

  const trackMapRef          = useRef<HTMLDivElement>(null);
  const trackMapInstance     = useRef<any>(null);
  const trackDriverMarker    = useRef<any>(null);
  const trackLeafletCss      = useRef<HTMLLinkElement | null>(null);
  const orderIdRef           = useRef<string | null>(null);
  const trackRouteLineRef    = useRef<any>(null);
  const trackRouteLastFetch  = useRef<number>(0);

  const fetchOrders = useCallback(async (phone: string) => {
    if (!phone) { setLoading(false); setNotFound(true); return; }
    setLoading(true);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: active }, { data: recent }] = await Promise.all([
      supabase.from('orders').select('*')
        .eq('client_phone', phone)
        .not('status', 'in', '("completed","rejected")')
        .order('created_at', { ascending: false }),
      supabase.from('orders').select('*')
        .eq('client_phone', phone)
        .in('status', ['completed', 'rejected'])
        .gte('created_at', since24h)
        .order('created_at', { ascending: false }),
    ]);
    const all: Order[] = [...(active || []), ...(recent || [])];
    if (all.length === 0) {
      setOrders([]); setNotFound(true);
    } else {
      setOrders(all); setNotFound(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const run = async () => {
      let saved = localStorage.getItem('deliveryPhone') || '';

      if (!saved) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email?.endsWith('@c.delivery')) {
          saved = session.user.email.replace('@c.delivery', '');
          localStorage.setItem('deliveryPhone', saved);
          const meta = session.user.user_metadata as Record<string, string | undefined> | undefined;
          if (meta?.delivery_name && !localStorage.getItem('deliveryName'))
            localStorage.setItem('deliveryName', meta.delivery_name);
        }
      }

      setInputPhone(saved);
      if (sessionStorage.getItem('trackDismissed') === '1') {
        setNotFound(true);
        setLoading(false);
      } else {
        fetchOrders(saved);
      }
    };
    run();
  }, [fetchOrders]);

  const activeOrderIdsKey = useMemo(
    () => orders.filter(o => !['completed','rejected'].includes(o.status)).map(o => o.id).join(','),
    [orders]
  );

  // Auto-select first order
  useEffect(() => {
    if (orders.length === 0) { setSelectedOrderId(null); return; }
    setSelectedOrderId(prev => (prev && orders.find(o => o.id === prev)) ? prev : orders[0].id);
  }, [orders]);

  // Sync feedback flag when selected order changes
  useEffect(() => {
    setAlreadySentFeedback(order?.id ? !!localStorage.getItem(`fb_sent_${order.id}`) : false);
  }, [order?.id]);

  // Reset extra time estimate when switching orders
  useEffect(() => { setExtraMins(0); }, [selectedOrderId]);

  // Realtime for all active orders
  useEffect(() => {
    const activeIds = activeOrderIdsKey.split(',').filter(Boolean);
    if (!activeIds.length) return;
    const channels = activeIds.map(oid =>
      supabase.channel(`track-${oid}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${oid}` },
          async () => {
            const { data } = await supabase.from('orders').select('*').eq('id', oid).single();
            if (data) setOrders(prev => prev.map(o => o.id === oid ? data as Order : o));
          })
        .subscribe()
    );
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [activeOrderIdsKey]);

  // keep a stable ref to the current order id so polling closures don't go stale
  orderIdRef.current = order?.id ?? null;

  const destroyMap = useCallback(() => {
    if (trackMapInstance.current) {
      trackMapInstance.current.remove();
      trackMapInstance.current = null;
      trackDriverMarker.current = null;
      trackRouteLineRef.current = null;
    }
    if (trackLeafletCss.current?.parentNode) {
      trackLeafletCss.current.parentNode.removeChild(trackLeafletCss.current);
      trackLeafletCss.current = null;
    }
  }, []);

  // Effect A: map lifecycle — depends only on status + client location.
  // This effect NEVER re-runs due to driver position changes, so the map
  // is not torn down every time the driver moves.
  useEffect(() => {
    if (order?.status !== 'ready') { destroyMap(); return destroyMap; }
    if (trackMapInstance.current) return; // already initialized by a previous run
    if (!order.client_lat || !order.client_lng || !trackMapRef.current) return;
    // client location available — create the base map with home marker
    if (!trackLeafletCss.current) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      trackLeafletCss.current = link;
    }
    import('leaflet').then((mod) => {
      const L = (mod as any).default ?? mod;
      if (!trackMapRef.current || trackMapInstance.current) return;
      const map = L.map(trackMapRef.current, { attributionControl: false })
        .setView([order.client_lat!, order.client_lng!], 15);
      trackMapInstance.current = map;
      setTimeout(() => map.invalidateSize(), 100);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map);
      const homeIcon = L.divIcon({
        html: `<div style="width:34px;height:34px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:18px">🏠</div>`,
        className: '', iconSize: [34, 34], iconAnchor: [17, 17],
      });
      L.marker([order.client_lat!, order.client_lng!], { icon: homeIcon })
        .addTo(map)
        .bindPopup(`<div dir="rtl" style="font-family:sans-serif"><b>موقعك</b></div>`);
    });
    return destroyMap;
  }, [order?.status, order?.client_lat, order?.client_lng, destroyMap]);

  // Effect B: driver marker — runs on every position update but NEVER destroys the map.
  // Also handles the case where client_lat is null (initialises the map on first driver fix).
  useEffect(() => {
    if (order?.status !== 'ready' || !order.driver_lat || !order.driver_lng) return;
    const dLat = order.driver_lat;
    const dLng = order.driver_lng;

    import('leaflet').then((mod) => {
      const L = (mod as any).default ?? mod;

      // If no map yet (client never shared location), create one centred on driver
      if (!trackMapInstance.current && trackMapRef.current) {
        if (!trackLeafletCss.current) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
          trackLeafletCss.current = link;
        }
        const map = L.map(trackMapRef.current, { attributionControl: false }).setView([dLat, dLng], 15);
        trackMapInstance.current = map;
        setTimeout(() => map.invalidateSize(), 100);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap', maxZoom: 19,
        }).addTo(map);
      }

      if (!trackMapInstance.current) return;

      if (trackDriverMarker.current) {
        trackDriverMarker.current.setLatLng([dLat, dLng]);
      } else {
        const icon = L.divIcon({
          html: MOTO_ICON_HTML,
          className: '', iconSize: [46, 46], iconAnchor: [23, 23],
        });
        trackDriverMarker.current = L.marker([dLat, dLng], { icon })
          .addTo(trackMapInstance.current)
          .bindPopup(`<div dir="rtl" style="font-family:sans-serif"><b>السائق في الطريق إليك</b></div>`);
        if (order.client_lat && order.client_lng) {
          try {
            trackMapInstance.current.fitBounds(
              L.latLngBounds([order.client_lat, order.client_lng], [dLat, dLng]),
              { padding: [50, 50] }
            );
          } catch (_) {}
        }
      }

      // رسم مسار الطريق من موقع السائق إلى العميل
      if (order.client_lat && order.client_lng) {
        const shouldFetch = !trackRouteLineRef.current || (Date.now() - trackRouteLastFetch.current > 30_000);
        if (shouldFetch) {
          trackRouteLastFetch.current = Date.now();
          const cLat = order.client_lat, cLng = order.client_lng;
          fetch(`https://router.project-osrm.org/route/v1/driving/${dLng},${dLat};${cLng},${cLat}?overview=full&geometries=geojson`)
            .then(r => r.json())
            .then(json => {
              const coords = json.routes?.[0]?.geometry?.coordinates?.map(
                ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
              );
              if (!coords?.length || !trackMapInstance.current) return;
              if (trackRouteLineRef.current) {
                trackRouteLineRef.current.setLatLngs(coords);
              } else {
                trackRouteLineRef.current = L.polyline(coords, {
                  color: '#2563eb', weight: 4, opacity: 0.85,
                }).addTo(trackMapInstance.current);
                trackRouteLineRef.current.bringToBack();
              }
            })
            .catch(() => {});
        }
      }
    });
  }, [order?.status, order?.driver_lat, order?.driver_lng]);

  // Polling fallback every 3s for all active orders
  useEffect(() => {
    const activeIds = activeOrderIdsKey.split(',').filter(Boolean);
    if (!activeIds.length) return;
    const id = setInterval(async () => {
      const { data } = await supabase.from('orders').select('*').in('id', activeIds);
      if (data) setOrders(prev => prev.map(o => {
        const upd = (data as Order[]).find(d => d.id === o.id);
        return upd ?? o;
      }));
    }, 3000);
    return () => clearInterval(id);
  }, [activeOrderIdsKey]);

  // Re-fetch all on tab visible
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const phone = localStorage.getItem('deliveryPhone') || inputPhone;
      if (phone) fetchOrders(phone);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchOrders, inputPhone]);

  const submitFeedback = async () => {
    if (!feedbackText.trim() || !order) return;
    setFeedbackSending(true);
    await supabase.from('order_feedback').insert({
      order_id: order.id,
      client_name: order.client_name,
      client_phone: order.client_phone,
      type: feedbackType,
      message: feedbackText.trim(),
    });
    setFeedbackSending(false);
    setFeedbackDone(true);
    localStorage.setItem(`fb_sent_${order.id}`, '1');
    setAlreadySentFeedback(true);
  };

  // ── الوقت التقديري ──
  const [extraMins, setExtraMins] = useState(0);

  const estimatedAt = useMemo(() => {
    if (!order?.created_at || order.status === 'completed' || order.status === 'rejected') return null;
    return new Date(new Date(order.created_at).getTime() + (20 + extraMins) * 60_000);
  }, [order?.created_at, order?.status, extraMins]);

  useEffect(() => {
    if (!estimatedAt) return;
    const check = () => { if (Date.now() > estimatedAt.getTime()) setExtraMins(m => m + 10); };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [estimatedAt]);

  const fmtEta = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const stepIndex = (s: string) => s === 'pickup' ? 1 : STEPS.findIndex(x => x.key === s);
  const current = order ? stepIndex(order.status) : -1;

  return (
    <CustomerGuard>
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-center text-gray-900 dark:text-white">تتبع طلبك</h1>
      </header>

      <div className="px-4 pt-5 pb-24">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: brandColor, borderTopColor: 'transparent' }}/>
          </div>
        ) : notFound ? (
          <AnimatePresence mode="wait">
          <motion.div
            key="search-box"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="text-center mt-16"
          >
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">لا يوجد طلب حالي</h2>
            <p className="text-gray-500 dark:text-slate-400 mb-6 text-sm">ابحث عن طلبك برقم هاتفك</p>
            <div className="flex gap-2 max-w-sm mx-auto">
              <button onClick={() => { sessionStorage.removeItem('trackDismissed'); fetchOrders(inputPhone); }}
                className="px-4 py-3 rounded-xl font-bold active:scale-95 transition-all"
                style={{ backgroundColor: brandColor, color: textOnBrand }}>
                <Search size={18}/>
              </button>
              <input value={inputPhone} onChange={e => setInputPhone(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { sessionStorage.removeItem('trackDismissed'); fetchOrders(inputPhone); } }}
                placeholder="ادخل رقم هاتفك" dir="rtl"
                className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2"
                style={{ '--tw-ring-color': brandColor } as any}
              />
            </div>
          </motion.div>
          </AnimatePresence>
        ) : orders.length === 0 ? null : order?.status === 'rejected' ? (
          <div className="max-w-lg mx-auto mt-10 text-center space-y-4" style={{ animation: 'status-enter 0.5s ease-out' }}>
            <div className="text-7xl">❌</div>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-2 border-red-200 dark:border-red-800">
              <h2 className="text-xl font-black text-red-600 dark:text-red-400 mb-2">تم رفض طلبك</h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-1">عذراً، لم نتمكن من قبول طلبك في الوقت الحالي.</p>
              <p className="text-gray-400 dark:text-slate-500 text-sm">يمكنك التواصل معنا أو إعادة الطلب.</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 text-right space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900 dark:text-white">{order.client_name}</span>
                <span className="text-gray-400 text-sm">الاسم</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-red-500">{order.total_amount.toLocaleString()} د.ع</span>
                <span className="text-gray-400 text-sm">المبلغ</span>
              </div>
            </div>
          </div>
        ) : order && (
          <div className="space-y-4 max-w-lg mx-auto">

            {/* ── كارتات الطلبات المتعددة ── */}
            {orders.length > 1 && (
              <div className="space-y-2">
                {orders.map((o, idx) => {
                  const sIdx = o.status === 'pickup' ? 1 : STEPS.findIndex(s => s.key === o.status);
                  const step = STEPS[sIdx >= 0 ? sIdx : 0];
                  const isSelected = o.id === selectedOrderId;
                  const statusStyle: Record<string, { color: string; bg: string; border: string }> = {
                    pending:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                    preparing: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
                    ready:     { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                    completed: { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
                    rejected:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                  };
                  const ss = statusStyle[o.status] ?? statusStyle.completed;
                  return (
                    <button key={o.id}
                      onClick={() => setSelectedOrderId(o.id)}
                      className="w-full text-right rounded-2xl p-4 flex items-center gap-4 transition-all active:scale-[0.98]"
                      style={{
                        backgroundColor: isSelected ? ss.bg : (dark ? '#1e293b' : 'white'),
                        border: `2px solid ${isSelected ? ss.border : (dark ? '#334155' : '#f3f4f6')}`,
                        boxShadow: isSelected ? `0 4px 16px ${ss.color}20` : 'none',
                      }}
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                           style={{ backgroundColor: `${ss.color}15` }}>
                        {step?.icon ?? '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-sm" style={{ color: ss.color }}>{step?.label ?? o.status}</span>
                          <span className="font-black text-sm text-gray-900 dark:text-white whitespace-nowrap">
                            {o.total_amount.toLocaleString()} <span className="text-xs font-bold text-gray-400">د.ع</span>
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                          طلب #{orders.length - idx} · {new Date(o.created_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ss.color }}/>}
                    </button>
                  );
                })}
                <div className="border-t border-gray-100 dark:border-slate-700 pt-1"/>
              </div>
            )}
            <style>{`
              @keyframes line-fill-rtl {
                0%   { width: 0% }
                25%  { width: 52% }
                50%  { width: 72% }
                70%  { width: 82% }
                85%  { width: 87% }
                100% { width: 91% }
              }
            `}</style>

            {/* ── شريط الطلب المشترك (Timeline) ── */}
            {(() => {
              const timeline = (
                <div className="flex items-start">
                  {STEPS.map((step, idx) => (
                    <React.Fragment key={step.key}>
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all duration-500 ${
                          idx <= current ? 'bg-red-500' : 'bg-gray-100 dark:bg-slate-700 text-gray-300 dark:text-slate-600'
                        }`}>{step.icon}</div>
                        <span className={`text-xs mt-1.5 font-medium text-center leading-tight max-w-[52px] ${
                          idx <= current ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'
                        }`}>{step.label}</span>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div className="flex-1 h-1 rounded mx-1 relative overflow-hidden bg-gray-100 dark:bg-slate-700" style={{ marginTop: '21px' }}>
                          <div key={`${idx}-${current}`} className="absolute inset-y-0 right-0 rounded bg-red-500"
                            style={
                              idx < current  ? { width: '100%', transition: 'width 0.4s ease-out' }
                              : idx === current ? { width: '0%', animation: 'line-fill-rtl 80s linear forwards' }
                              : { width: '0%' }
                            }/>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              );

              /* ── حالة "في الطريق": خريطة → شريط → سائق → تفاصيل ── */
              if (order.status === 'ready') return (
                <>
                  {/* الخريطة */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${order.driver_lat ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-slate-500'}`}/>
                        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                          {order.driver_lat ? 'مباشر' : 'في انتظار السائق'}
                        </span>
                      </div>
                      <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">تتبع السائق 🏍️</p>
                    </div>
                    <div style={{ position: 'relative', height: 280 }}>
                      <div ref={trackMapRef} style={{ height: 280 }}/>
                      {!order.driver_lat && !order.client_lat && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-slate-700">
                          <div className="text-4xl">🏍️</div>
                          <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">جاري تحديد موقع السائق...</p>
                        </div>
                      )}
                      {order.client_lat && !order.driver_lat && (
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                          <div className="bg-white/90 dark:bg-slate-800/90 text-xs text-gray-500 dark:text-slate-400 px-3 py-1.5 rounded-full shadow flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse"/>
                            في انتظار موقع السائق...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* شريط حالة الطلب */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700">
                    {timeline}
                  </div>

                  {/* بطاقة السائق */}
                  {order.driver_name && (
                    <div key={order.driver_name}
                         className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700"
                         dir="rtl"
                         style={{ animation: 'driver-slide-up 0.65s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">السائق الذي سيوصل طلبك</p>
                      <div className="flex items-center gap-4">
                        <div className="relative flex-shrink-0 w-16 h-16 flex items-center justify-center"
                             style={{ animation: 'driver-avatar-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both' }}>
                          <img src="/driver-cartoon.svg" alt="" className="w-16 h-16 relative z-10 rounded-full bg-gray-400 border-2 border-gray-300"
                               style={{ animation: 'driver-accepted-glow 2s ease-in-out infinite' }}/>
                        </div>
                        <div className="flex-1" style={{ animation: 'driver-name-reveal 0.4s ease-out 0.35s both' }}>
                          <p className="font-black text-xl text-red-500 dark:text-red-400 leading-tight">{order.driver_name}</p>
                          <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">سيوصل طلبك وفي طريقه إليك 🏍️</p>
                        </div>
                        {driverPhone && (
                          <a href={`https://wa.me/${driverPhone.replace(/\D/g, '')}`}
                             target="_blank" rel="noopener noreferrer"
                             className="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-90 transition-all flex-shrink-0"
                             style={{ backgroundColor: '#25D366', animation: 'driver-name-reveal 0.4s ease-out 0.5s both' }}>
                            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* السائق وصل */}
                  {order.driver_arrived && (
                    <div className="rounded-2xl p-5 text-center border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700"
                         style={{ animation: 'status-enter 0.5s ease-out' }}>
                      <div className="text-4xl mb-2">🏍️</div>
                      <p className="font-black text-orange-800 dark:text-orange-300 text-lg mb-1">السائق وصل!</p>
                      <p className="text-orange-600 dark:text-orange-400 text-sm">الرجاء الاستعداد لاستلام طلبك</p>
                    </div>
                  )}

                  {/* تفاصيل الطلب */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700">
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-4">تفاصيل الطلب</h3>
                    {[
                      { label: 'الاسم',     value: order.client_name },
                      { label: 'المنطقة',   value: order.delivery_address || '—' },
                      { label: 'الإجمالي', value: `${order.total_amount.toLocaleString()} د.ع` },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center py-3 border-b border-gray-50 dark:border-slate-700 last:border-0">
                        <span className="font-semibold text-gray-900 dark:text-white">{row.value}</span>
                        <span className="text-gray-500 dark:text-slate-400 text-sm">{row.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              );

              /* ── باقي الحالات: أنيميشن + شريط → سائق/وقت → تفاصيل ── */
              return (
                <>
                  {/* أنيميشن + شريط في نفس الخانة */}
                  <div key={order.status}
                       className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700"
                       style={{ animation: 'status-enter 0.5s ease-out' }}>
                    <div className="text-center mb-5">
                      <div className="mb-3">
                        {STATUS_ANIMATION[order.status] ?? <div className="text-5xl">{STEPS[current]?.icon}</div>}
                      </div>
                      <p className="font-bold text-lg mb-1 text-gray-900 dark:text-white">{STEPS[current]?.label}</p>
                      <p className="text-gray-500 dark:text-slate-400 text-sm">{STEPS[current]?.desc}</p>
                      {order.status === 'completed' && !alreadySentFeedback && (
                        <button
                          onClick={() => { setShowFeedbackModal(true); setFeedbackStep('choose'); setFeedbackDone(false); setFeedbackText(''); }}
                          className="mt-4 flex items-center gap-2 mx-auto px-5 py-2.5 rounded-2xl border-2 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 font-bold text-sm active:scale-95 transition-all"
                        >
                          <MessageSquare size={16}/>
                          <span>تقديم ملاحظة أو شكوى</span>
                        </button>
                      )}
                      {order.status === 'completed' && alreadySentFeedback && (
                        <p className="mt-4 text-xs text-gray-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>
                          تم إرسال ملاحظتك، شكراً!
                        </p>
                      )}
                    </div>
                    {timeline}
                  </div>

                  {/* الوقت التقديري */}
                  {estimatedAt && !order.driver_name && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl px-5 py-4 border border-gray-100 dark:border-slate-700">
                      <div className="text-right">
                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">الوقت التقديري للتوصيل</p>
                        <p className="font-black text-gray-900 dark:text-white text-lg">
                          سيصلك طلبك عند الساعة{' '}
                          <span className="text-orange-500">{fmtEta(estimatedAt)}</span>
                        </p>
                        {extraMins > 0 && <p className="text-xs text-amber-500 mt-0.5">⏳ تم تمديد الوقت التقديري</p>}
                      </div>
                    </div>
                  )}

                  {/* بطاقة السائق */}
                  {order.driver_name && !['pending', 'rejected', 'completed'].includes(order.status) && (
                    <div key={order.driver_name}
                         className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700"
                         dir="rtl"
                         style={{ animation: 'driver-slide-up 0.65s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">السائق الذي سيوصل طلبك</p>
                      <div className="flex items-center gap-4">
                        <div className="relative flex-shrink-0 w-16 h-16 flex items-center justify-center"
                             style={{ animation: 'driver-avatar-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both' }}>
                          <img src="/driver-cartoon.svg" alt="" className="w-16 h-16 relative z-10 rounded-full bg-gray-400 border-2 border-gray-300"
                               style={{ animation: 'driver-accepted-glow 2s ease-in-out infinite' }}/>
                        </div>
                        <div className="flex-1" style={{ animation: 'driver-name-reveal 0.4s ease-out 0.35s both' }}>
                          <p className="font-black text-xl text-red-500 dark:text-red-400 leading-tight">{order.driver_name}</p>
                          <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">سيوصل طلبك 🏍️</p>
                        </div>
                        {driverPhone && (
                          <a href={`https://wa.me/${driverPhone.replace(/\D/g, '')}`}
                             target="_blank" rel="noopener noreferrer"
                             className="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-90 transition-all flex-shrink-0"
                             style={{ backgroundColor: '#25D366', animation: 'driver-name-reveal 0.4s ease-out 0.5s both' }}>
                            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* تفاصيل الطلب */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700">
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-4">تفاصيل الطلب</h3>
                    {[
                      { label: 'الاسم',     value: order.client_name },
                      { label: 'المنطقة',   value: order.delivery_address || '—' },
                      { label: 'الإجمالي', value: `${order.total_amount.toLocaleString()} د.ع` },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center py-3 border-b border-gray-50 dark:border-slate-700 last:border-0">
                        <span className="font-semibold text-gray-900 dark:text-white">{row.value}</span>
                        <span className="text-gray-500 dark:text-slate-400 text-sm">{row.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

          </div>

        )}
      </div>

      {/* زر X — يظهر فقط عند عرض طلب نشط */}
      {!loading && order && (
        <div className="flex justify-center pb-28 pt-2">
          <button
            onClick={() => { sessionStorage.setItem('trackDismissed', '1'); setOrders([]); setSelectedOrderId(null); setNotFound(true); setInputPhone(''); }}
            className="w-11 h-11 rounded-full flex items-center justify-center text-gray-400 dark:text-slate-500 active:scale-95 transition-all border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800"
          >
            <X size={18}/>
          </button>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
             onClick={() => !feedbackSending && setShowFeedbackModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg p-6 pb-8"
               onClick={e => e.stopPropagation()}>
            {feedbackDone ? (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">🙏</div>
                <p className="font-bold text-xl text-gray-900 dark:text-white mb-1">شكراً!</p>
                <p className="text-gray-500 dark:text-slate-400 text-sm">تم استلام ملاحظتك وسنعمل على تحسين خدمتنا</p>
                <button onClick={() => setShowFeedbackModal(false)}
                  className="mt-6 px-8 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold active:scale-95 transition-all">
                  إغلاق
                </button>
              </div>
            ) : feedbackStep === 'choose' ? (
              <>
                <p className="font-bold text-xl text-gray-900 dark:text-white text-center mb-2">ماذا تريد أن تقدم؟</p>
                <p className="text-gray-400 dark:text-slate-500 text-sm text-center mb-6">اختر نوع رسالتك</p>
                <div className="flex gap-3" dir="rtl">
                  <button
                    onClick={() => { setFeedbackType('feedback'); setFeedbackStep('write'); }}
                    className="flex-1 flex flex-col items-center gap-3 py-7 rounded-3xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 active:scale-95 transition-all"
                  >
                    <span className="text-4xl">💡</span>
                    <span className="font-black text-blue-600 dark:text-blue-400 text-base">ملاحظة</span>
                    <span className="text-xs text-blue-400 dark:text-blue-500 text-center leading-relaxed px-2">اقتراح أو رأي<br/>في الوجبة</span>
                  </button>
                  <button
                    onClick={() => { setFeedbackType('complaint'); setFeedbackStep('write'); }}
                    className="flex-1 flex flex-col items-center gap-3 py-7 rounded-3xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 active:scale-95 transition-all"
                  >
                    <span className="text-4xl">⚠️</span>
                    <span className="font-black text-red-600 dark:text-red-400 text-base">شكوى</span>
                    <span className="text-xs text-red-400 dark:text-red-500 text-center leading-relaxed px-2">مشكلة في<br/>الطلب أو التوصيل</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5" dir="rtl">
                  <button onClick={() => setFeedbackStep('choose')}
                    className="p-2 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-500 active:scale-90 transition-all">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                  <span className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full ${feedbackType === 'feedback' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' : 'bg-red-50 dark:bg-red-900/20 text-red-500'}`}>
                    {feedbackType === 'feedback' ? '💡 ملاحظة' : '⚠️ شكوى'}
                  </span>
                </div>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder={feedbackType === 'feedback' ? 'اكتب ملاحظتك أو اقتراحك هنا...' : 'اشرح المشكلة التي واجهتها...'}
                  dir="rtl"
                  rows={5}
                  autoFocus
                  className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none text-sm resize-none mb-4"
                />
                <button
                  onClick={submitFeedback}
                  disabled={!feedbackText.trim() || feedbackSending}
                  className="w-full py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-base active:scale-95 transition-all disabled:opacity-50">
                  {feedbackSending ? 'جاري الإرسال...' : 'إرسال'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <ClientBottomNav />
    </div>
    </CustomerGuard>
  );
}
