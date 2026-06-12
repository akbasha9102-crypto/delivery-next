'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { Search } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useDarkMode } from '@/context/ThemeContext';

const STEPS = [
  { key: 'pending',   label: 'استلام',      icon: '📋', desc: 'تم استلام طلبك وسيبدأ التجهيز' },
  { key: 'preparing', label: 'تجهيز',       icon: '🍳', desc: 'طلبك قيد التجهيز الآن' },
  { key: 'ready',     label: 'في الطريق',   icon: '🏍️', desc: 'طلبك في الطريق إليك' },
  { key: 'completed', label: 'تم التوصيل', icon: '🎉', desc: 'تم توصيل طلبك بنجاح' },
];

const CSS = `
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

function MotorcycleAnimation() {
  return (
    <div className="relative w-72 h-44 mx-auto rounded-2xl overflow-hidden">
      <style>{`
        @keyframes rd-scroll  { from{transform:translateX(0)} to{transform:translateX(-80px)} }
        @keyframes cl-scroll  { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes sc-bob     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes streak-in  { 0%{opacity:0;transform:translateX(16px)} 45%{opacity:0.9} 100%{opacity:0;transform:translateX(-24px)} }
        @keyframes pin-drop   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.2);opacity:0} }
        @keyframes exhaust    { 0%{opacity:0.5;transform:translate(0,0) scale(1)} 100%{opacity:0;transform:translate(-22px,-8px) scale(2.8)} }
      `}</style>

      {/* Sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-700" />

      {/* Sun */}
      <div className="absolute top-3 right-7">
        <div className="w-8 h-8 rounded-full bg-amber-300 dark:bg-amber-400/30 shadow-lg shadow-amber-200/60" />
        <div className="absolute inset-0 rounded-full bg-amber-200/50 dark:opacity-0 scale-150" />
      </div>

      {/* Clouds */}
      <div className="absolute top-0 left-0 overflow-hidden" style={{ width: '100%', height: 52 }}>
        <div className="absolute top-0 flex" style={{ width: '200%', animation: 'cl-scroll 16s linear infinite' }}>
          {[0, 1].map(k => (
            <div key={k} className="relative flex-shrink-0" style={{ width: '50%', height: 52 }}>
              <div className="absolute top-5 left-[8%]  w-16 h-5 rounded-full bg-white/80" />
              <div className="absolute top-3 left-[13%] w-10 h-7 rounded-full bg-white/90" />
              <div className="absolute top-6 left-[53%] w-20 h-4 rounded-full bg-white/70" />
              <div className="absolute top-4 left-[58%] w-12 h-6 rounded-full bg-white/85" />
            </div>
          ))}
        </div>
      </div>

      {/* Ground strip */}
      <div className="absolute bottom-0 left-0 right-0 h-14 bg-slate-500 dark:bg-slate-600">
        <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
        {/* Road dashes */}
        <div className="absolute top-1/2 -translate-y-1/2 overflow-hidden w-full h-2">
          <div className="flex" style={{ width: '200%', animation: 'rd-scroll 0.45s linear infinite' }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-8 h-1.5 rounded-full bg-white/60 mx-3" />
            ))}
          </div>
        </div>
      </div>

      {/* Destination pin (right side) */}
      <div className="absolute right-8 bottom-11" style={{ animation: 'pin-drop 1s ease-in-out infinite' }}>
        <div className="relative">
          <div className="w-7 h-7 rounded-full bg-red-500 shadow-lg flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          </div>
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #ef4444' }} />
          {/* Pulse rings */}
          <div className="absolute inset-0 rounded-full bg-red-400 opacity-60"
            style={{ animation: 'pulse-ring 1.4s ease-out infinite' }} />
          <div className="absolute inset-0 rounded-full bg-red-400 opacity-40"
            style={{ animation: 'pulse-ring 1.4s ease-out infinite 0.5s' }} />
        </div>
      </div>

      {/* Scooter + rider (emoji, clean) */}
      <div className="absolute bottom-11 left-[38%] -translate-x-1/2"
        style={{ animation: 'sc-bob 0.45s ease-in-out infinite' }}>
        {/* Exhaust puffs */}
        <div className="absolute -left-3 top-4 w-3 h-3 rounded-full bg-slate-300/60"
          style={{ animation: 'exhaust 1s ease-out infinite' }} />
        <div className="absolute -left-2 top-5 w-2 h-2 rounded-full bg-slate-300/40"
          style={{ animation: 'exhaust 1s ease-out infinite 0.5s' }} />

        {/* Clean scooter SVG */}
        <svg viewBox="0 0 96 58" width="110" fill="none">
          {/* Rear wheel */}
          <circle cx="18" cy="44" r="11" fill="#1e293b" />
          <circle cx="18" cy="44" r="5.5" fill="#334155" />
          <circle cx="18" cy="44" r="2" fill="#94a3b8" />
          {/* Front wheel */}
          <circle cx="76" cy="44" r="11" fill="#1e293b" />
          <circle cx="76" cy="44" r="5.5" fill="#334155" />
          <circle cx="76" cy="44" r="2" fill="#94a3b8" />
          {/* Body */}
          <path d="M22 40 Q20 28 34 24 L58 20 Q70 18 74 28 L80 40 Z" fill="#2563eb" />
          <path d="M34 24 L58 20 Q68 18 72 26 L74 23 Q68 14 56 16 L32 20 Z" fill="#93c5fd" opacity="0.5" />
          {/* Seat */}
          <rect x="30" y="36" width="30" height="6" rx="3" fill="#1d4ed8" />
          {/* Delivery box */}
          <rect x="2" y="18" width="28" height="22" rx="4" fill="#ef4444" />
          <rect x="1" y="14" width="30" height="8" rx="4" fill="#dc2626" />
          <line x1="16" y1="14" x2="16" y2="40" stroke="#b91c1c" strokeWidth="1.5" />
          <path d="M8 30 L13 35 L24 24" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="30" y1="36" x2="36" y2="42" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
          {/* Fork */}
          <line x1="74" y1="28" x2="76" y2="42" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
          {/* Handlebar */}
          <line x1="72" y1="28" x2="82" y2="23" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
          <line x1="80" y1="21" x2="86" y2="25" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
          {/* Headlight */}
          <ellipse cx="80" cy="33" rx="4" ry="3" fill="#fef08a" opacity="0.9" />
          <ellipse cx="80" cy="33" rx="2" ry="1.5" fill="#fffbeb" />
          {/* Rider */}
          <path d="M44 26 C42 16 48 8 56 6 L66 5 C72 4 73 11 67 14 L52 22 C47 26 46 30 47 32 Z" fill="#f97316" />
          <line x1="58" y1="7" x2="72" y2="18" stroke="#c2855b" strokeWidth="5" strokeLinecap="round" />
          <circle cx="73" cy="19" r="3" fill="#b07346" />
          <line x1="56" y1="8" x2="66" y2="2" stroke="#c2855b" strokeWidth="4" strokeLinecap="round" />
          <circle cx="67" cy="0" r="8" fill="#f1c27d" />
          <path d="M59 0 C58 -6 62 -11 67 -11 C72 -11 76 -6 75 0" fill="#f97316" />
          <path d="M59 0 Q59 4 62 5 L72 4 Q74 3 75 0" fill="#ea580c" />
          <path d="M60 -1 Q67 -4 74 -1 L74 2 Q67 -1 60 2 Z" fill="#1e3a5f" opacity="0.5" />
        </svg>
      </div>

      {/* Speed lines */}
      {[
        { top: 50, w: 24, delay: '0s'    },
        { top: 64, w: 16, delay: '0.22s' },
        { top: 78, w: 30, delay: '0.42s' },
      ].map((l, i) => (
        <div key={i} className="absolute h-px rounded-full bg-white/75"
          style={{ top: l.top, left: '5%', width: l.w, animation: `streak-in 0.65s ease-in-out infinite ${l.delay}` }}
        />
      ))}
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
  ready:     <MotorcycleAnimation />,
  completed: <CompletedAnimation />,
};

type Order = {
  id: string; client_name: string; client_phone: string;
  delivery_address: string | null; total_amount: number;
  status: string; created_at: string;
  driver_name?: string | null; driver_phone?: string | null;
  driver_arrived?: boolean | null;
  driver_lat?: number | null; driver_lng?: number | null;
  client_lat?: number | null; client_lng?: number | null;
};

function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  return (Math.atan2(Math.sin(dLng) * Math.cos(phi2), Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng)) * 180 / Math.PI + 360) % 360;
}

const MOTO_ICON_HTML = `<div style="width:46px;height:46px;background:#2563eb;border-radius:50%;border:3px solid white;box-shadow:0 4px 16px rgba(37,99,235,0.45);display:flex;align-items:center;justify-content:center;"><div class="driver-moto" style="transform:rotate(-90deg);transition:transform 0.5s ease;line-height:0;"><svg viewBox="0 0 60 30" width="36" height="18" fill="none"><circle cx="10" cy="22" r="7" fill="white" opacity="0.9"/><circle cx="10" cy="22" r="3.5" fill="#bfdbfe"/><circle cx="50" cy="22" r="7" fill="white" opacity="0.9"/><circle cx="50" cy="22" r="3.5" fill="#bfdbfe"/><path d="M14 18 Q20 6 32 5 L44 4 Q53 4 55 15 L57 22 L6 22 Z" fill="white" opacity="0.95"/><rect x="22" y="13" width="17" height="4" rx="2" fill="#93c5fd"/><circle cx="33" cy="3" r="3.5" fill="#fde68a"/><ellipse cx="55" cy="17" rx="3" ry="2.5" fill="#fef08a" opacity="0.85"/></svg></div></div>`;

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

  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [inputPhone, setInputPhone] = useState('');
  const [loading, setLoading] = useState(true);

  const trackMapRef        = useRef<HTMLDivElement>(null);
  const trackMapInstance   = useRef<any>(null);
  const trackDriverMarker  = useRef<any>(null);
  const trackLeafletCss    = useRef<HTMLLinkElement | null>(null);
  const prevDriverPos      = useRef<[number, number] | null>(null);

  const fetchOrder = useCallback(async (phone: string) => {
    if (!phone) { setLoading(false); setNotFound(true); return; }
    setLoading(true);
    const { data } = await supabase
      .from('orders').select('*')
      .eq('client_phone', phone)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (data) { setOrder(data); setNotFound(false); }
    else { setOrder(null); setNotFound(true); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('deliveryPhone') || '';
    setInputPhone(saved);
    fetchOrder(saved);
  }, [fetchOrder]);

  useEffect(() => {
    if (!order) return;
    const channel = supabase.channel('track-order')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        payload => setOrder(payload.new as Order))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [order?.id]);

  // Map: initialize, update, or cleanup based on status + location data
  useEffect(() => {
    const destroyMap = () => {
      if (trackMapInstance.current) {
        trackMapInstance.current.remove();
        trackMapInstance.current = null;
        trackDriverMarker.current = null;
      }
      if (trackLeafletCss.current?.parentNode) {
        trackLeafletCss.current.parentNode.removeChild(trackLeafletCss.current);
        trackLeafletCss.current = null;
      }
    };

    if (order?.status !== 'ready') { destroyMap(); return destroyMap; }

    const centerLat = order.driver_lat || order.client_lat;
    const centerLng = order.driver_lng || order.client_lng;
    if (!centerLat || !centerLng || !trackMapRef.current) return destroyMap;

    const hasDriver = !!(order.driver_lat && order.driver_lng);

    // Map already exists — just update the driver marker
    if (trackMapInstance.current) {
      if (hasDriver) {
        if (trackDriverMarker.current) {
          const newLat = order.driver_lat!;
          const newLng = order.driver_lng!;
          if (prevDriverPos.current) {
            const bearing = getBearing(prevDriverPos.current[0], prevDriverPos.current[1], newLat, newLng);
            const el = trackDriverMarker.current.getElement();
            if (el) {
              const moto = el.querySelector('.driver-moto') as HTMLElement | null;
              if (moto) moto.style.transform = `rotate(${Math.round(bearing - 90)}deg)`;
            }
          }
          prevDriverPos.current = [newLat, newLng];
          trackDriverMarker.current.setLatLng([newLat, newLng]);
        } else {
          // First driver location arrived — add marker to existing map
          import('leaflet').then((mod) => {
            const L = (mod as any).default ?? mod;
            if (!trackMapInstance.current) return;
            const icon = L.divIcon({
              html: MOTO_ICON_HTML,
              className: '', iconSize: [46, 46], iconAnchor: [23, 23],
            });
            trackDriverMarker.current = L.marker([order.driver_lat!, order.driver_lng!], { icon })
              .addTo(trackMapInstance.current)
              .bindPopup(`<div dir="rtl" style="font-family:sans-serif"><b>السائق في الطريق إليك</b></div>`);
            prevDriverPos.current = [order.driver_lat!, order.driver_lng!];
            if (order.client_lat && order.client_lng) {
              try { trackMapInstance.current.fitBounds(L.latLngBounds([order.client_lat, order.client_lng], [order.driver_lat!, order.driver_lng!]), { padding: [50, 50] }); } catch (_) {}
            }
          });
        }
      }
      return destroyMap;
    }

    // Initialize the map for the first time
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

      const map = L.map(trackMapRef.current).setView([centerLat!, centerLng!], 15);
      trackMapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map);

      if (order.client_lat && order.client_lng) {
        const homeIcon = L.divIcon({
          html: `<div style="width:34px;height:34px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:18px">🏠</div>`,
          className: '', iconSize: [34, 34], iconAnchor: [17, 17],
        });
        L.marker([order.client_lat, order.client_lng], { icon: homeIcon })
          .addTo(map)
          .bindPopup(`<div dir="rtl" style="font-family:sans-serif"><b>موقعك</b></div>`);
      }

      if (hasDriver) {
        const driverIcon = L.divIcon({
          html: MOTO_ICON_HTML,
          className: '', iconSize: [46, 46], iconAnchor: [23, 23],
        });
        trackDriverMarker.current = L.marker([order.driver_lat!, order.driver_lng!], { icon: driverIcon })
          .addTo(map)
          .bindPopup(`<div dir="rtl" style="font-family:sans-serif"><b>السائق في الطريق إليك</b></div>`);
        prevDriverPos.current = [order.driver_lat!, order.driver_lng!];
        if (order.client_lat && order.client_lng) {
          try { map.fitBounds(L.latLngBounds([order.client_lat, order.client_lng], [order.driver_lat!, order.driver_lng!]), { padding: [50, 50] }); } catch (_) {}
        }
      }
    });

    return destroyMap;
  }, [order?.status, order?.driver_lat, order?.driver_lng, order?.client_lat, order?.client_lng]);

  const stepIndex = (s: string) => STEPS.findIndex(x => x.key === s);
  const current = order ? stepIndex(order.status) : -1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-center text-gray-900 dark:text-white">تتبع طلبك</h1>
      </header>

      <div className="px-4 pt-5">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: brandColor, borderTopColor: 'transparent' }}/>
          </div>
        ) : notFound ? (
          <div className="text-center mt-16">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">لا يوجد طلب حالي</h2>
            <p className="text-gray-500 dark:text-slate-400 mb-6 text-sm">ابحث عن طلبك برقم هاتفك</p>
            <div className="flex gap-2 max-w-sm mx-auto">
              <button onClick={() => fetchOrder(inputPhone)}
                className="px-4 py-3 rounded-xl font-bold active:scale-95 transition-all"
                style={{ backgroundColor: brandColor, color: textOnBrand }}>
                <Search size={18}/>
              </button>
              <input value={inputPhone} onChange={e => setInputPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchOrder(inputPhone)}
                placeholder="ادخل رقم هاتفك" dir="rtl"
                className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2"
                style={{ '--tw-ring-color': brandColor } as any}
              />
            </div>
          </div>
        ) : order && (
          <div className="space-y-4 max-w-lg mx-auto">
            {/* Timeline */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-6">حالة الطلب</h3>
              <div className="flex items-start">
                {STEPS.map((step, idx) => (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all duration-500 ${
                        idx <= current
                          ? 'bg-gray-900 dark:bg-white'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-300 dark:text-slate-600'
                      }`}>
                        {step.icon}
                      </div>
                      <span className={`text-xs mt-1.5 font-medium text-center leading-tight max-w-[52px] ${
                        idx <= current ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'
                      }`}>{step.label}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`flex-1 h-1 rounded mx-1 mb-5 transition-all duration-700 ${
                        idx < current ? 'bg-gray-900 dark:bg-white' : 'bg-gray-100 dark:bg-slate-700'
                      }`}/>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Live Driver Map */}
            {order.status === 'ready' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${order.driver_lat ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-slate-500'}`} />
                    <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                      {order.driver_lat ? 'مباشر' : 'في انتظار السائق'}
                    </span>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">تتبع السائق 🏍️</p>
                </div>
                <div style={{ position: 'relative', height: 280 }}>
                  <div ref={trackMapRef} style={{ height: 280 }} />
                  {!order.driver_lat && !order.client_lat && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-slate-700">
                      <div className="text-4xl">🏍️</div>
                      <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">جاري تحديد موقع السائق...</p>
                    </div>
                  )}
                  {order.client_lat && !order.driver_lat && (
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                      <div className="bg-white/90 dark:bg-slate-800/90 text-xs text-gray-500 dark:text-slate-400 px-3 py-1.5 rounded-full shadow flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
                        في انتظار موقع السائق...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Driver Arrived Banner */}
            {order.driver_arrived && order.status === 'ready' && (
              <div className="rounded-2xl p-5 text-center border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700"
                   style={{ animation: 'status-enter 0.5s ease-out' }}>
                <div className="text-4xl mb-2">🏍️</div>
                <p className="font-black text-orange-800 dark:text-orange-300 text-lg mb-1">السائق وصل!</p>
                <p className="text-orange-600 dark:text-orange-400 text-sm">الرجاء الاستعداد لاستلام طلبك</p>
              </div>
            )}

            {/* Animated Status Card */}
            <div key={order.status}
                 className="border-2 rounded-2xl p-5 text-center border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                 style={{ animation: 'status-enter 0.5s ease-out' }}>
              <div className="mb-3">
                {STATUS_ANIMATION[order.status] ?? <div className="text-5xl">{STEPS[current]?.icon}</div>}
              </div>
              <p className="font-bold text-lg mb-1 text-gray-900 dark:text-white">{STEPS[current]?.label}</p>
              <p className="text-gray-500 dark:text-slate-400 text-sm">{STEPS[current]?.desc}</p>
              {order.status === 'ready' && order.driver_name && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">السائق</p>
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-base">{order.driver_name}</p>
                  <div className="flex items-center justify-center gap-2 mt-0.5" dir="ltr">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">{order.driver_phone}</span>
                    {order.driver_phone && (
                      <a
                        href={`https://wa.me/${order.driver_phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: '#25D366' }}
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Order Details */}
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
          </div>
        )}
      </div>

      <ClientBottomNav />
    </div>
  );
}
