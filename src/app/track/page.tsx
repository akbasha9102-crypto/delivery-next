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
        {/* Steam */}
        <path d="M52 74 Q49 62 52 50 Q55 40 52 28" stroke="#b0bec5" strokeWidth="2.5" strokeLinecap="round" fill="none"
              style={{ animation: 'steam 1.6s ease-out infinite' }}/>
        <path d="M70 71 Q67 57 70 44 Q73 34 70 21" stroke="#b0bec5" strokeWidth="2.5" strokeLinecap="round" fill="none"
              style={{ animation: 'steam 1.6s ease-out infinite 0.55s' }}/>
        <path d="M88 74 Q85 63 88 52" stroke="#b0bec5" strokeWidth="2" strokeLinecap="round" fill="none"
              style={{ animation: 'steam 1.6s ease-out infinite 1.1s' }}/>
        {/* Flames */}
        <path d="M42 98 C38 86 34 79 38 67 C41 75 46 72 44 83 C48 73 53 68 50 57 C56 66 57 78 52 98Z"
              fill="#ff6b00" style={{ transformOrigin:'46px 98px', animation:'flame-l 0.55s ease-in-out infinite' }}/>
        <path d="M63 96 C59 81 53 72 59 57 C63 68 69 65 66 78 C71 66 77 60 73 46 C81 58 83 74 76 96Z"
              fill="#ff4500" style={{ transformOrigin:'68px 96px', animation:'flame-m 0.45s ease-in-out infinite' }}/>
        <path d="M88 98 C84 86 81 79 85 67 C87 75 92 72 90 83 C94 73 97 68 95 57 C100 66 102 78 97 98Z"
              fill="#ff6b00" style={{ transformOrigin:'91px 98px', animation:'flame-r 0.65s ease-in-out infinite' }}/>
        <path d="M57 95 C56 82 62 75 67 68 C69 77 72 74 70 85 C74 76 78 70 75 59 C82 70 82 83 77 95Z"
              fill="#ffb300" opacity="0.85" style={{ transformOrigin:'68px 95px', animation:'flame-m 0.38s ease-in-out infinite reverse' }}/>
        {/* Pan */}
        <ellipse cx="70" cy="107" rx="45" ry="6" fill="#00000012"/>
        <ellipse cx="70" cy="101" rx="44" ry="13" fill="#757575"/>
        <ellipse cx="70" cy="97" rx="44" ry="13" fill="#9e9e9e"/>
        <ellipse cx="70" cy="95" rx="40" ry="10" fill="#bdbdbd"/>
        <path d="M112 90 Q130 88 133 94 Q130 100 112 100Z" fill="#616161"/>
        <path d="M112 91 Q129 89 132 94 Q129 99 112 99Z" fill="#757575"/>
        {/* Food */}
        <ellipse cx="52" cy="91" rx="14" ry="7" fill="#ef9a9a"
                 style={{ transformOrigin:'52px 91px', animation:'sizzle 0.7s ease-in-out infinite' }}/>
        <ellipse cx="83" cy="90" rx="11" ry="6" fill="#fff9c4"
                 style={{ transformOrigin:'83px 90px', animation:'sizzle 0.85s ease-in-out infinite 0.2s' }}/>
        <circle cx="83" cy="90" r="4" fill="#ffcc02"/>
        <ellipse cx="67" cy="87" rx="7" ry="4" fill="#a5d6a7" opacity="0.9"
                 style={{ transformOrigin:'67px 87px', animation:'sizzle 0.6s ease-in-out infinite 0.1s' }}/>
      </svg>
    </div>
  );
}

function MotorcycleAnimation() {
  // Side view — yellow-shirt courier on a red scooter, riding to the right.
  // Scooter stays centred while the world scrolls left (parallax = sense of speed).
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
      {/* Sun */}
      <div className="absolute top-3 left-6 w-9 h-9 rounded-full bg-yellow-200/80 blur-[1px] dark:bg-yellow-300/20"/>

      {/* Clouds (slow parallax) */}
      <div className="absolute top-0 left-0 flex" style={{ width: '200%', animation: 'pan-x 11s linear infinite' }}>
        {[0, 1].map(k => (
          <div key={k} className="relative h-44" style={{ width: '50%' }}>
            <div className="absolute top-5 left-[12%] w-12 h-4 bg-white/70 rounded-full"/>
            <div className="absolute top-9 left-[48%] w-16 h-5 bg-white/60 rounded-full"/>
            <div className="absolute top-4 left-[78%] w-10 h-3.5 bg-white/70 rounded-full"/>
          </div>
        ))}
      </div>

      {/* Buildings (mid parallax) */}
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

      {/* Speed lines streaming back behind the courier */}
      {[{ top: 70, w: 30, d: '0s' }, { top: 84, w: 20, d: '0.15s' }, { top: 98, w: 34, d: '0.3s' }].map((l, i) => (
        <div key={i} className="absolute h-0.5 bg-white/60 rounded-full"
             style={{ top: l.top, left: '6%', width: l.w, animation: `speed-l 0.55s ease-in-out infinite ${l.d}` }}/>
      ))}

      {/* Scooter + courier */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 2, animation: 'moto-b 0.5s ease-in-out infinite' }}>
        <svg viewBox="0 0 240 170" className="w-60" fill="none">
          {/* Ground shadow */}
          <ellipse cx="130" cy="153" rx="95" ry="7" fill="#000" opacity="0.12"/>

          {/* ===== RED DELIVERY BOX on the rear rack ===== */}
          <line x1="62" y1="96" x2="74" y2="108" stroke="#374151" strokeWidth="3"/>
          <rect x="36" y="56" width="42" height="38" rx="4" fill="#ef4444"/>
          <rect x="36" y="56" width="42" height="10" rx="4" fill="#dc2626"/>
          <rect x="49" y="71" width="16" height="14" rx="2" fill="#fff" opacity="0.92"/>
          <path d="M53 78 L56 81 L62 74" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

          {/* ===== WHEELS ===== */}
          <g style={{ transformOrigin: '74px 132px', animation: 'spin-w 0.4s linear infinite' }}>
            <circle cx="74" cy="132" r="19" fill="#1f2937"/>
            <circle cx="74" cy="132" r="10.5" fill="#e5e7eb"/>
            <circle cx="74" cy="132" r="3" fill="#9ca3af"/>
            <line x1="74" y1="121" x2="74" y2="143" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="63" y1="132" x2="85" y2="132" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="66" y1="124" x2="82" y2="140" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="82" y1="124" x2="66" y2="140" stroke="#9ca3af" strokeWidth="1.5"/>
          </g>
          <g style={{ transformOrigin: '190px 132px', animation: 'spin-w 0.4s linear infinite' }}>
            <circle cx="190" cy="132" r="19" fill="#1f2937"/>
            <circle cx="190" cy="132" r="10.5" fill="#e5e7eb"/>
            <circle cx="190" cy="132" r="3" fill="#9ca3af"/>
            <line x1="190" y1="121" x2="190" y2="143" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="179" y1="132" x2="201" y2="132" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="182" y1="124" x2="198" y2="140" stroke="#9ca3af" strokeWidth="1.5"/>
            <line x1="198" y1="124" x2="182" y2="140" stroke="#9ca3af" strokeWidth="1.5"/>
          </g>

          {/* ===== FAR LEG (behind body) ===== */}
          <path d="M106 100 L128 116 L130 128" stroke="#334155" strokeWidth="9" strokeLinecap="round"/>
          <path d="M122 128 L140 128 Q144 128 144 131 L122 133 Z" fill="#15803d"/>

          {/* ===== RED SCOOTER BODY ===== */}
          <path d="M54 116 Q52 98 74 98 L104 98 Q112 98 112 110 L112 122 Q112 128 104 128 L64 128 Q54 128 54 118 Z" fill="#dc2626"/>
          <path d="M104 120 L156 120 L156 130 L104 130 Z" fill="#b91c1c"/>
          <path d="M150 130 L150 120 Q150 96 166 82 Q177 72 190 72 L198 72 Q205 72 205 80 L205 122 Q205 130 196 130 Z" fill="#dc2626"/>
          <path d="M174 116 Q190 104 206 116 L202 122 Q190 113 178 122 Z" fill="#b91c1c"/>
          {/* Seat */}
          <path d="M56 100 Q56 91 68 91 L106 91 Q114 91 114 99 L114 102 L56 102 Z" fill="#111827"/>
          {/* Headlight */}
          <ellipse cx="202" cy="88" rx="5" ry="7" fill="#fde68a"/>
          <ellipse cx="202" cy="88" rx="2.5" ry="4" fill="#fffbeb"/>
          {/* Handlebar */}
          <path d="M196 74 L210 58" stroke="#374151" strokeWidth="4" strokeLinecap="round"/>
          <line x1="205" y1="56" x2="218" y2="60" stroke="#1f2937" strokeWidth="5" strokeLinecap="round"/>

          {/* ===== NEAR LEG (green shoe) ===== */}
          <path d="M100 98 L138 112" stroke="#475569" strokeWidth="11" strokeLinecap="round"/>
          <path d="M138 112 L144 126" stroke="#475569" strokeWidth="10" strokeLinecap="round"/>
          <path d="M130 126 L152 126 Q158 126 158 130 L130 132 Z" fill="#16a34a"/>
          <rect x="130" y="123" width="15" height="5" rx="2" fill="#22c55e"/>

          {/* ===== TORSO (yellow short-sleeve shirt) ===== */}
          <path d="M92 102 C88 80 100 66 122 62 L138 60 C146 62 146 73 137 77 L110 88 C102 92 98 96 100 104 Z" fill="#facc15"/>
          <path d="M100 100 C97 84 106 74 124 70" stroke="#eab308" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
          {/* Short sleeve (yellow) then bare forearm (skin) */}
          <path d="M132 66 L150 74" stroke="#facc15" strokeWidth="12" strokeLinecap="round"/>
          <path d="M150 74 L206 60" stroke="#f1c27d" strokeWidth="8" strokeLinecap="round"/>
          <circle cx="208" cy="59" r="5" fill="#e0a96d"/>

          {/* ===== HEAD + RED HELMET ===== */}
          <path d="M134 60 L140 50" stroke="#f1c27d" strokeWidth="8" strokeLinecap="round"/>
          <circle cx="148" cy="46" r="11" fill="#f1c27d"/>
          <circle cx="143" cy="48" r="2.5" fill="#e0a96d"/>
          {/* Helmet shell */}
          <path d="M136 47 A12.5 12.5 0 0 1 161 46 L161 47 Q149 41 137 48 Z" fill="#dc2626"/>
          {/* Visor peak */}
          <path d="M160 45 L171 49 L160 50 Z" fill="#b91c1c"/>
          {/* Highlight + chin strap */}
          <ellipse cx="145" cy="37" rx="6" ry="3" fill="#f87171" opacity="0.7"/>
          <path d="M141 54 Q148 60 156 55" stroke="#991b1b" strokeWidth="2" strokeLinecap="round"/>
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

            {/* Animated Status Card */}
            <div className="bg-orange-50 dark:bg-orange-900/10 border-2 border-[#e67e22] rounded-2xl p-5 text-center">
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
