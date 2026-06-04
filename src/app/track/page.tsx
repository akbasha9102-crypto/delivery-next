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
  @keyframes road-z   { 0%{opacity:0;transform:translateY(0) scale(0.3)} 20%{opacity:1} 100%{opacity:0;transform:translateY(96px) scale(2.7)} }
  @keyframes wind-l   { 0%{opacity:0;transform:translate(0,0) scaleX(0.5)} 25%{opacity:0.7} 100%{opacity:0;transform:translate(-78px,22px) scaleX(1.8)} }
  @keyframes wind-r   { 0%{opacity:0;transform:translate(0,0) scaleX(0.5)} 25%{opacity:0.7} 100%{opacity:0;transform:translate(78px,22px) scaleX(1.8)} }
  @keyframes rider-b  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2.5px)} }
  @keyframes glow-p   { 0%,100%{opacity:0.5} 50%{opacity:0.95} }
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
  // Front view — the rider is driving straight toward the camera.
  const dashes = ['0s', '0.18s', '0.36s', '0.54s', '0.72s'];
  const windL  = [{ top: 66, delay: '0s' }, { top: 80, delay: '0.25s' }, { top: 94, delay: '0.5s' }];
  const windR  = [{ top: 66, delay: '0.12s' }, { top: 80, delay: '0.37s' }, { top: 94, delay: '0.6s' }];

  return (
    <div className="relative w-64 h-44 mx-auto rounded-2xl overflow-hidden">
      <style>{CSS}</style>

      {/* Sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 to-sky-100 dark:from-slate-700 dark:to-slate-900"/>

      {/* Road (perspective, narrow at the back → wide toward the camera) */}
      <svg viewBox="0 0 200 176" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <polygon points="94,58 106,58 240,176 -40,176" fill="#6b7280"/>
        <polygon points="94,58 106,58 240,176 -40,176" fill="#000" opacity="0.08"/>
        <line x1="97" y1="58" x2="-30" y2="176" stroke="#e5e7eb" strokeWidth="2" opacity="0.5"/>
        <line x1="103" y1="58" x2="230" y2="176" stroke="#e5e7eb" strokeWidth="2" opacity="0.5"/>
      </svg>

      {/* Center-line dashes rushing toward the camera */}
      {dashes.map((delay, i) => (
        <div key={i} className="absolute left-1/2 bg-yellow-300 rounded-sm"
             style={{ top: 62, width: 9, height: 6, marginLeft: -4.5,
                      animation: `road-z 0.9s linear infinite ${delay}` }}/>
      ))}

      {/* Headlight glow flooding toward the viewer */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-yellow-200/60 blur-md"
           style={{ bottom: 18, width: 120, height: 70, animation: 'glow-p 0.9s ease-in-out infinite' }}/>

      {/* Rider — front view, helmet front and center */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 6 }}>
        <svg viewBox="0 0 160 150" className="w-40" fill="none"
             style={{ animation: 'rider-b 0.5s ease-in-out infinite' }}>

          {/* Front wheel (head-on → tall thin ellipse) with motion blur */}
          <line x1="64" y1="120" x2="64" y2="146" stroke="#9ca3af" strokeWidth="2" opacity="0.4"/>
          <line x1="96" y1="120" x2="96" y2="146" stroke="#9ca3af" strokeWidth="2" opacity="0.4"/>
          <ellipse cx="80" cy="133" rx="15" ry="22" fill="#111"/>
          <ellipse cx="80" cy="133" rx="8"  ry="16" fill="#374151"/>
          <ellipse cx="80" cy="133" rx="3"  ry="6"  fill="#9ca3af"/>
          {/* Front fender */}
          <path d="M64 116 Q80 104 96 116 L92 122 Q80 113 68 122Z" fill="#e67e22"/>

          {/* Handlebar + grips + mirrors */}
          <line x1="40" y1="96" x2="120" y2="96" stroke="#4b5563" strokeWidth="5" strokeLinecap="round"/>
          <circle cx="40" cy="96" r="5" fill="#1f2937"/>
          <circle cx="120" cy="96" r="5" fill="#1f2937"/>
          <line x1="46" y1="92" x2="40" y2="80" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="114" y1="92" x2="120" y2="80" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="39" cy="78" r="4" fill="#cbd5e1"/>
          <circle cx="121" cy="78" r="4" fill="#cbd5e1"/>

          {/* Headlight */}
          <ellipse cx="80" cy="104" rx="11" ry="13" fill="#fffde7"/>
          <ellipse cx="80" cy="104" rx="6"  ry="8"  fill="#fff176"/>

          {/* Jacket / torso (shoulders widening toward camera) */}
          <path d="M58 100 Q56 78 70 70 L90 70 Q104 78 102 100 Z" fill="#1a237e"/>
          <path d="M75 72 L85 72 L84 100 L76 100 Z" fill="#283593"/>
          {/* Reflective chest stripe */}
          <path d="M64 86 L96 86" stroke="#ffd54f" strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
          {/* Arms reaching to the grips */}
          <path d="M62 78 Q48 84 42 94" stroke="#1a237e" strokeWidth="9" strokeLinecap="round"/>
          <path d="M98 78 Q112 84 118 94" stroke="#1a237e" strokeWidth="9" strokeLinecap="round"/>
          <circle cx="41" cy="95" r="5.5" fill="#111"/>
          <circle cx="119" cy="95" r="5.5" fill="#111"/>

          {/* ===== HELMET (the focal point — large & clear) ===== */}
          <ellipse cx="80" cy="74" rx="20" ry="6" fill="#000" opacity="0.12"/>
          {/* Shell */}
          <path d="M56 44 Q56 18 80 18 Q104 18 104 44 L104 56 Q104 70 80 70 Q56 70 56 56 Z" fill="#e67e22"/>
          {/* Top accent band */}
          <path d="M58 38 Q80 22 102 38 Q92 30 80 30 Q68 30 58 38 Z" fill="#c0392b"/>
          {/* Chin bar */}
          <path d="M58 56 Q80 74 102 56 L100 62 Q80 76 60 62 Z" fill="#d35400"/>
          {/* Visor (tinted face shield) */}
          <path d="M60 42 Q80 34 100 42 L98 56 Q80 64 62 56 Z" fill="#16202e"/>
          {/* Visor reflection */}
          <path d="M66 44 L82 40" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.3"/>
          {/* Shell highlight + outline */}
          <ellipse cx="68" cy="34" rx="6" ry="4" fill="#fff" opacity="0.4"/>
          <path d="M56 44 Q56 18 80 18 Q104 18 104 44 L104 56 Q104 70 80 70 Q56 70 56 56 Z"
                stroke="#b35e12" strokeWidth="1.5"/>
        </svg>
      </div>

      {/* Wind rushing back past the rider's left & right */}
      {windL.map((w, i) => (
        <div key={`l${i}`} className="absolute h-[3px] bg-white/70 rounded-full"
             style={{ top: w.top, left: '42%', width: 26,
                      animation: `wind-l 0.6s ease-in infinite ${w.delay}` }}/>
      ))}
      {windR.map((w, i) => (
        <div key={`r${i}`} className="absolute h-[3px] bg-white/70 rounded-full"
             style={{ top: w.top, left: '58%', width: 26,
                      animation: `wind-r 0.6s ease-in infinite ${w.delay}` }}/>
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
