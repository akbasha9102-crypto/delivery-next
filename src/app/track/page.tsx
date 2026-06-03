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
  return (
    <div className="relative w-64 h-40 mx-auto rounded-2xl overflow-hidden">
      <style>{CSS}</style>

      {/* Sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200 to-sky-100 dark:from-slate-700 dark:to-slate-800"/>

      {/* Speed lines */}
      {[
        { top: '28%', w: 28, delay: '0s'   },
        { top: '38%', w: 18, delay: '0.15s' },
        { top: '48%', w: 36, delay: '0.3s'  },
      ].map((l, i) => (
        <div key={i} className="absolute left-4 h-0.5 bg-white/55 rounded-full"
             style={{ top: l.top, width: l.w, animation: `speed-l 0.7s ease-in-out infinite ${l.delay}` }}/>
      ))}

      {/* Road */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gray-500 dark:bg-gray-600 overflow-hidden">
        <div className="absolute top-1/2 -translate-y-1/2 flex"
             style={{ animation: 'road-m 0.35s linear infinite', width: '200%' }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="w-9 h-1.5 bg-yellow-300 rounded-full mx-4 flex-shrink-0"/>
          ))}
        </div>
      </div>

      {/* Exhaust puffs */}
      <div className="absolute bottom-12 left-8">
        <div className="w-3 h-3 rounded-full bg-gray-300/70"
             style={{ animation: 'exhaust 0.7s ease-out infinite' }}/>
        <div className="w-2 h-2 rounded-full bg-gray-200/60 mt-1"
             style={{ animation: 'exhaust 0.7s ease-out infinite 0.22s' }}/>
      </div>

      {/* Motorcycle */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2"
           style={{ animation: 'moto-b 0.38s ease-in-out infinite' }}>
        <svg viewBox="0 0 210 82" fill="none" className="w-52">

          {/* Rear wheel */}
          <g style={{ transformOrigin:'38px 66px', animation:'spin-w 0.26s linear infinite' }}>
            <circle cx="38" cy="66" r="19" stroke="#111" strokeWidth="6"/>
            <circle cx="38" cy="66" r="7" fill="#2a2a2a"/>
            <line x1="38" y1="47" x2="38" y2="85" stroke="#444" strokeWidth="1.5"/>
            <line x1="19" y1="66" x2="57" y2="66" stroke="#444" strokeWidth="1.5"/>
            <line x1="25" y1="53" x2="51" y2="79" stroke="#444" strokeWidth="1.5"/>
            <line x1="51" y1="53" x2="25" y2="79" stroke="#444" strokeWidth="1.5"/>
          </g>

          {/* Front wheel */}
          <g style={{ transformOrigin:'172px 66px', animation:'spin-w 0.26s linear infinite' }}>
            <circle cx="172" cy="66" r="19" stroke="#111" strokeWidth="6"/>
            <circle cx="172" cy="66" r="7" fill="#2a2a2a"/>
            <line x1="172" y1="47" x2="172" y2="85" stroke="#444" strokeWidth="1.5"/>
            <line x1="153" y1="66" x2="191" y2="66" stroke="#444" strokeWidth="1.5"/>
            <line x1="159" y1="53" x2="185" y2="79" stroke="#444" strokeWidth="1.5"/>
            <line x1="185" y1="53" x2="159" y2="79" stroke="#444" strokeWidth="1.5"/>
          </g>

          {/* Frame lines */}
          <line x1="38" y1="66" x2="74" y2="50" stroke="#888" strokeWidth="4.5" strokeLinecap="round"/>
          <line x1="74" y1="50" x2="158" y2="44" stroke="#888" strokeWidth="3.5" strokeLinecap="round"/>
          <line x1="161" y1="44" x2="172" y2="50" stroke="#999" strokeWidth="4.5" strokeLinecap="round"/>
          <line x1="157" y1="45" x2="167" y2="52" stroke="#777" strokeWidth="3" strokeLinecap="round"/>

          {/* Engine block */}
          <path d="M80 50 L87 45 L148 45 L156 54 L148 64 L83 64Z" fill="#3d3d3d"/>

          {/* Tank */}
          <path d="M74 50 C80 33 122 27 152 40 L158 48 L148 51 C118 38 87 42 77 52Z" fill="#e67e22"/>

          {/* Seat */}
          <path d="M68 47 L77 43 L82 50 L74 54Z" fill="#1a1a1a"/>

          {/* Exhaust pipe */}
          <path d="M80 62 Q60 67 38 66" stroke="#aaa" strokeWidth="3.5" strokeLinecap="round"/>

          {/* Handlebar */}
          <path d="M153 42 L159 33 L166 36" stroke="#666" strokeWidth="3" strokeLinecap="round"/>

          {/* Headlight */}
          <ellipse cx="166" cy="38" rx="5" ry="7" fill="#fffde7" opacity="0.95"/>
          <ellipse cx="166" cy="38" rx="3" ry="4.5" fill="#fff9c4"/>

          {/* Rider body */}
          <path d="M80 48 Q76 32 84 18 Q96 10 110 19 C126 28 143 38 153 43 L147 49 C133 41 118 32 103 26 Q89 22 86 46Z" fill="#1a237e"/>
          {/* Jacket stripe */}
          <path d="M96 26 C120 36 140 43 146 46" stroke="#3949ab" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>

          {/* Helmet */}
          <circle cx="86" cy="15" r="11" fill="#e67e22"/>
          <path d="M76 12 Q86 3 96 12 Q97 23 86 23 Q75 23 76 12Z" fill="#c0392b"/>
          {/* Visor */}
          <path d="M77 17 Q86 13 95 17" stroke="#ffd54f" strokeWidth="2.5" strokeLinecap="round"/>
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
