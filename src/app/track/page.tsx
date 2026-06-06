'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { Search } from 'lucide-react';

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
  const skyline = (
    <svg viewBox="0 0 240 64" preserveAspectRatio="none" className="h-16" style={{ width: '50%' }}>
      <rect x="6"   y="26" width="30" height="38" fill="#9aa6b8" opacity="0.5"/>
      <rect x="44"  y="14" width="26" height="50" fill="#8b97a9" opacity="0.5"/>
      <rect x="80"  y="32" width="34" height="32" fill="#9aa6b8" opacity="0.5"/>
      <rect x="124" y="20" width="24" height="44" fill="#8b97a9" opacity="0.5"/>
      <rect x="158" y="34" width="30" height="30" fill="#9aa6b8" opacity="0.5"/>
      <rect x="196" y="18" width="28" height="46" fill="#8b97a9" opacity="0.5"/>
      {[[12,32],[24,32],[12,48],[50,22],[60,22],[50,38],[60,38],[88,40],[100,40],
        [130,28],[130,44],[164,42],[174,42],[202,26],[214,26],[202,42]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="5" height="6" fill="#fde68a" opacity="0.7"/>
      ))}
    </svg>
  );

  return (
    <div className="relative w-64 h-44 mx-auto rounded-2xl overflow-hidden">
      <style>{CSS}</style>

      {/* Sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-orange-50 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900"/>
      <div className="absolute top-3 left-6 w-9 h-9 rounded-full bg-yellow-200/80 blur-[1px] dark:bg-yellow-300/20"/>

      {/* Clouds */}
      <div className="absolute top-0 left-0 flex" style={{ width: '200%', animation: 'pan-x 11s linear infinite' }}>
        {[0, 1].map(k => (
          <div key={k} className="relative h-44" style={{ width: '50%' }}>
            <div className="absolute top-5 left-[12%] w-12 h-4 bg-white/70 rounded-full"/>
            <div className="absolute top-9 left-[48%] w-16 h-5 bg-white/60 rounded-full"/>
            <div className="absolute top-4 left-[78%] w-10 h-3.5 bg-white/70 rounded-full"/>
          </div>
        ))}
      </div>

      {/* Buildings */}
      <div className="absolute bottom-9 left-0 flex" style={{ width: '200%', animation: 'pan-x 3.4s linear infinite' }}>
        {skyline}{skyline}
      </div>

      {/* Road */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-slate-600 dark:bg-slate-700 overflow-hidden">
        <div className="absolute top-1/2 -translate-y-1/2 flex" style={{ animation: 'road-m 0.3s linear infinite', width: '200%' }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="w-9 h-1.5 bg-yellow-300/90 rounded-full mx-2 flex-shrink-0"/>
          ))}
        </div>
      </div>

      {/* Speed lines */}
      {[{ top: 70, w: 30, d: '0s' }, { top: 84, w: 20, d: '0.15s' }, { top: 98, w: 34, d: '0.3s' }].map((l, i) => (
        <div key={i} className="absolute h-0.5 bg-white/60 rounded-full"
             style={{ top: l.top, left: '6%', width: l.w, animation: `speed-l 0.55s ease-in-out infinite ${l.d}` }}/>
      ))}

      {/* Scooter + Rider */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 2, animation: 'moto-b 0.5s ease-in-out infinite' }}>
        <svg viewBox="0 0 240 160" className="w-60" fill="none">

          {/* Shadow */}
          <ellipse cx="127" cy="153" rx="88" ry="6" fill="#000" opacity="0.13"/>

          {/* ── DELIVERY BOX ── */}
          <line x1="56" y1="96" x2="66" y2="108" stroke="#4b5563" strokeWidth="2.5" strokeLinecap="round"/>
          <rect x="22" y="55" width="46" height="40" rx="5" fill="#ef4444"/>
          <rect x="20" y="52" width="50" height="9" rx="4" fill="#dc2626"/>
          <rect x="36" y="71" width="19" height="16" rx="2.5" fill="white" opacity="0.9"/>
          <path d="M40 79 L43 82.5 L51 74" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

          {/* ── REAR WHEEL ── */}
          <g style={{ transformOrigin: '70px 132px', animation: 'spin-w 0.4s linear infinite' }}>
            <circle cx="70" cy="132" r="20" fill="#1f2937"/>
            <circle cx="70" cy="132" r="12" fill="#374151"/>
            <circle cx="70" cy="132" r="4.5" fill="#d1d5db"/>
            <line x1="70" y1="120" x2="70" y2="144" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="58" y1="132" x2="82" y2="132" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="61.5" y1="123.5" x2="78.5" y2="140.5" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="78.5" y1="123.5" x2="61.5" y2="140.5" stroke="#9ca3af" strokeWidth="1.5"/>
          </g>

          {/* ── FRONT WHEEL ── */}
          <g style={{ transformOrigin: '191px 132px', animation: 'spin-w 0.4s linear infinite' }}>
            <circle cx="191" cy="132" r="20" fill="#1f2937"/>
            <circle cx="191" cy="132" r="12" fill="#374151"/>
            <circle cx="191" cy="132" r="4.5" fill="#d1d5db"/>
            <line x1="191" y1="120" x2="191" y2="144" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="179" y1="132" x2="203" y2="132" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="182.5" y1="123.5" x2="199.5" y2="140.5" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="199.5" y1="123.5" x2="182.5" y2="140.5" stroke="#9ca3af" strokeWidth="1.5"/>
          </g>

          {/* ── FAR LEG (behind scooter body) ── */}
          <path d="M112 91 L103 115 L89 129" stroke="#334155" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M81 126 L97 125 Q104 125 104 129 L81 130 Z" fill="#1e293b"/>

          {/* ── SCOOTER BODY ── */}
          <path d="M47 110 Q45 93 70 90" stroke="#b91c1c" strokeWidth="3" strokeLinecap="round" fill="none"/>
          <path d="M50 122 Q48 96 70 92 L110 88 Q125 87 128 97 L128 122 Z" fill="#dc2626"/>
          <path d="M62 97 Q62 89 74 86 L108 84" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" fill="none"/>
          <rect x="128" y="110" width="40" height="12" rx="1" fill="#b91c1c"/>
          <path d="M168 122 L168 80 Q168 63 184 60 Q197 57 208 65 L210 122 Z" fill="#dc2626"/>
          <path d="M175 80 Q176 66 191 62" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" fill="none"/>
          <path d="M191 113 L196 68" stroke="#4b5563" strokeWidth="3.5" strokeLinecap="round"/>
          <ellipse cx="208" cy="79" rx="5" ry="7.5" fill="#fde68a"/>
          <ellipse cx="208" cy="79" rx="2.5" ry="4" fill="#fffbeb"/>
          <path d="M96 89 Q96 81 112 80 L158 78 Q167 78 167 87 L167 91 L96 91 Z" fill="#111827"/>
          <path d="M105 83 Q116 80 154 79" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
          <path d="M196 68 L210 54" stroke="#374151" strokeWidth="3.5" strokeLinecap="round"/>
          <line x1="205" y1="51" x2="220" y2="56" stroke="#1f2937" strokeWidth="5" strokeLinecap="round"/>
          <path d="M76 122 Q66 127 51 125" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          <circle cx="47" cy="125" r="4" fill="#9ca3af" opacity="0.2" style={{ animation: 'exhaust 0.9s ease-out infinite' }}/>
          <circle cx="42" cy="124" r="3" fill="#9ca3af" opacity="0.15" style={{ animation: 'exhaust 0.9s ease-out infinite 0.45s' }}/>

          {/* ── TORSO (yellow jacket — proper proportions) ── */}
          <path d="M108 93 C106 76 116 61 134 57 L152 55 C162 53 163 63 154 67 L128 79 C119 83 113 89 112 94 Z" fill="#facc15"/>
          <path d="M113 89 C116 77 123 68 137 63" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" fill="none"/>

          {/* ── FAR ARM ── */}
          <line x1="134" y1="63" x2="155" y2="69" stroke="#facc15" strokeWidth="11" strokeLinecap="round"/>
          <line x1="155" y1="69" x2="198" y2="60" stroke="#f1c27d" strokeWidth="7" strokeLinecap="round"/>
          <circle cx="198" cy="60" r="5" fill="#e0a96d"/>

          {/* ── NEAR LEG ── */}
          <path d="M120 91 L112 115" stroke="#475569" strokeWidth="11" strokeLinecap="round"/>
          <path d="M112 115 L100 129" stroke="#475569" strokeWidth="9" strokeLinecap="round"/>
          <path d="M92 126 L108 125 Q116 125 116 129 L92 130 Z" fill="#1e293b"/>
          <path d="M94 126 L107 125" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>

          {/* ── NEAR ARM ── */}
          <line x1="142" y1="61" x2="163" y2="67" stroke="#facc15" strokeWidth="11" strokeLinecap="round"/>
          <line x1="163" y1="67" x2="212" y2="56" stroke="#f1c27d" strokeWidth="7" strokeLinecap="round"/>
          <circle cx="212" cy="56" r="5.5" fill="#e0a96d"/>

          {/* ── NECK + HEAD + HELMET ── */}
          <line x1="140" y1="58" x2="144" y2="50" stroke="#f1c27d" strokeWidth="7.5" strokeLinecap="round"/>
          <circle cx="148" cy="46" r="12" fill="#f1c27d"/>
          <ellipse cx="137" cy="47" rx="3" ry="3.5" fill="#e0a96d"/>
          {/* full helmet dome */}
          <path d="M136 47 C134 37 138 29 148 28 C158 27 163 34 161 45 L161 48" fill="#dc2626"/>
          <path d="M136 47 Q135 52 139 54 L158 52 Q161 50 161 47" fill="#b91c1c"/>
          {/* tinted visor */}
          <path d="M137 47 Q148 43 160 46 L160 50 Q148 47 137 51 Z" fill="#1e3a5f" opacity="0.45"/>
          <path d="M160 46 L170 50 L160 52 Z" fill="#b91c1c"/>
          <ellipse cx="145" cy="35" rx="5.5" ry="3" fill="#f87171" opacity="0.5"/>
          <path d="M138 54 Q148 61 157 56" stroke="#991b1b" strokeWidth="1.5" strokeLinecap="round" fill="none"/>

        </svg>
      </div>
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
};

export default function TrackPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [inputPhone, setInputPhone] = useState('');
  const [loading, setLoading] = useState(true);

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

  const stepIndex = (s: string) => STEPS.findIndex(x => x.key === s);
  const current = order ? stepIndex(order.status) : -1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-[#944a00] text-center">تتبع طلبك</h1>
      </header>

      <div className="px-4 pt-5">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-10 h-10 border-4 border-[#e67e22] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : notFound ? (
          <div className="text-center mt-16">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">لا يوجد طلب حالي</h2>
            <p className="text-gray-500 dark:text-slate-400 mb-6 text-sm">ابحث عن طلبك برقم هاتفك</p>
            <div className="flex gap-2 max-w-sm mx-auto">
              <button onClick={() => fetchOrder(inputPhone)}
                className="bg-[#e67e22] text-white px-4 py-3 rounded-xl font-bold active:scale-95 transition-all">
                <Search size={18}/>
              </button>
              <input value={inputPhone} onChange={e => setInputPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchOrder(inputPhone)}
                placeholder="ادخل رقم هاتفك" dir="rtl"
                className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#e67e22]"
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
                          ? 'bg-[#e67e22] shadow-lg shadow-orange-200 dark:shadow-orange-900/50'
                          : 'bg-gray-100 dark:bg-slate-700'
                      } ${idx === current ? 'ring-2 ring-[#944a00] ring-offset-2 dark:ring-offset-slate-800' : ''}`}>
                        {step.icon}
                      </div>
                      <span className={`text-xs mt-1.5 font-medium text-center leading-tight max-w-[52px] ${
                        idx <= current ? 'text-[#e67e22]' : 'text-gray-400 dark:text-slate-500'
                      }`}>{step.label}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`flex-1 h-1 rounded mx-1 mb-5 transition-all duration-700 ${
                        idx < current ? 'bg-[#e67e22]' : 'bg-gray-100 dark:bg-slate-700'
                      }`}/>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Animated Status Card — key triggers re-mount + entrance animation on status change */}
            <div key={order.status}
                 className="bg-orange-50 dark:bg-orange-900/10 border-2 border-[#e67e22] rounded-2xl p-5 text-center"
                 style={{ animation: 'status-enter 0.5s ease-out' }}>
              <div className="mb-3">
                {STATUS_ANIMATION[order.status] ?? <div className="text-5xl">{STEPS[current]?.icon}</div>}
              </div>
              <p className="text-[#e67e22] font-bold text-lg mb-1">{STEPS[current]?.label}</p>
              <p className="text-gray-500 dark:text-slate-400 text-sm">{STEPS[current]?.desc}</p>
              {order.status === 'ready' && order.driver_name && (
                <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">السائق</p>
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-base">{order.driver_name}</p>
                  <p className="text-[#e67e22] font-bold text-sm mt-0.5" dir="ltr">{order.driver_phone}</p>
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
                  <span className="text-[#e67e22] font-semibold">{row.value}</span>
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
