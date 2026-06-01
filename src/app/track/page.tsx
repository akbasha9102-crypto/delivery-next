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

const ANIMATIONS_CSS = `
  @keyframes flame-l { 0%,100%{transform:scaleY(1) skewX(-5deg) translateX(0)} 50%{transform:scaleY(1.3) skewX(6deg) translateX(-3px)} }
  @keyframes flame-m { 0%,100%{transform:scaleY(1.15) skewX(0deg)} 50%{transform:scaleY(0.8) skewX(-4deg)} }
  @keyframes flame-r { 0%,100%{transform:scaleY(0.9) skewX(5deg) translateX(0)} 50%{transform:scaleY(1.25) skewX(-6deg) translateX(3px)} }
  @keyframes steam   { 0%{opacity:0;transform:translateY(0) scaleX(1)} 40%{opacity:0.55} 100%{opacity:0;transform:translateY(-28px) scaleX(1.6)} }
  @keyframes sizzle  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
  @keyframes spin-w  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes road-m  { from{transform:translateX(0)} to{transform:translateX(-52px)} }
  @keyframes moto-b  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
  @keyframes confetti-a { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(55px) rotate(380deg);opacity:0} }
  @keyframes confetti-b { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(45px) rotate(-260deg);opacity:0} }
  @keyframes pop-in  { 0%{transform:scale(0)} 65%{transform:scale(1.15)} 100%{transform:scale(1)} }
  @keyframes doc-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes checkmark { 0%{stroke-dashoffset:40} 100%{stroke-dashoffset:0} }
  @keyframes exhaust { 0%{opacity:0.8;transform:translateX(0) scale(1)} 100%{opacity:0;transform:translateX(-18px) scale(1.8)} }
`;

function PendingAnimation() {
  return (
    <div className="w-32 h-32 mx-auto flex items-center justify-center">
      <style>{ANIMATIONS_CSS}</style>
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full"
           style={{ animation: 'doc-bounce 1.2s ease-in-out infinite' }}>
        <rect x="18" y="8" width="64" height="78" rx="7" fill="#fff3e0" stroke="#e67e22" strokeWidth="3"/>
        <rect x="18" y="8" width="64" height="18" rx="7" fill="#e67e22"/>
        <rect x="18" y="18" width="64" height="8" fill="#e67e22"/>
        <line x1="30" y1="40" x2="70" y2="40" stroke="#e67e22" strokeWidth="3" strokeLinecap="round"/>
        <line x1="30" y1="53" x2="70" y2="53" stroke="#e67e22" strokeWidth="3" strokeLinecap="round"/>
        <line x1="30" y1="66" x2="52" y2="66" stroke="#e67e22" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="68" cy="74" r="14" fill="#e67e22"/>
        <path d="M61 74 L66 79 L76 67" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="40" strokeDashoffset="0" style={{ animation: 'checkmark 0.5s ease-out forwards' }}/>
      </svg>
    </div>
  );
}

function PreparingAnimation() {
  return (
    <div className="relative w-44 h-44 mx-auto flex items-end justify-center">
      <style>{ANIMATIONS_CSS}</style>
      <svg viewBox="0 0 140 130" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Steam */}
        <path d="M52 74 Q49 63 52 52 Q55 42 52 31" stroke="#b0bec5" strokeWidth="2.5" strokeLinecap="round" fill="none"
              style={{ animation: 'steam 1.6s ease-out infinite' }}/>
        <path d="M70 72 Q67 58 70 46 Q73 36 70 24" stroke="#b0bec5" strokeWidth="2.5" strokeLinecap="round" fill="none"
              style={{ animation: 'steam 1.6s ease-out infinite 0.55s' }}/>
        <path d="M88 74 Q85 63 88 53" stroke="#b0bec5" strokeWidth="2" strokeLinecap="round" fill="none"
              style={{ animation: 'steam 1.6s ease-out infinite 1.1s' }}/>

        {/* Left flame */}
        <path d="M42 98 C38 86 34 79 38 67 C41 75 46 72 44 83 C48 73 53 68 50 57 C56 66 57 78 52 98 Z"
              fill="#ff6b00" style={{ transformOrigin: '46px 98px', animation: 'flame-l 0.55s ease-in-out infinite' }}/>
        {/* Mid flame big */}
        <path d="M63 96 C59 81 53 72 59 57 C63 68 69 65 66 78 C71 66 77 60 73 46 C81 58 83 74 76 96 Z"
              fill="#ff4500" style={{ transformOrigin: '68px 96px', animation: 'flame-m 0.45s ease-in-out infinite' }}/>
        {/* Right flame */}
        <path d="M88 98 C84 86 81 79 85 67 C87 75 92 72 90 83 C94 73 97 68 95 57 C100 66 102 78 97 98 Z"
              fill="#ff6b00" style={{ transformOrigin: '91px 98px', animation: 'flame-r 0.65s ease-in-out infinite' }}/>
        {/* Inner glow flame */}
        <path d="M57 95 C56 82 62 75 67 68 C69 77 72 74 70 85 C74 76 78 70 75 59 C82 70 82 83 77 95 Z"
              fill="#ffb300" opacity="0.85" style={{ transformOrigin: '68px 95px', animation: 'flame-m 0.38s ease-in-out infinite reverse' }}/>

        {/* Pan shadow */}
        <ellipse cx="70" cy="107" rx="45" ry="6" fill="#00000015"/>
        {/* Pan rim */}
        <ellipse cx="70" cy="101" rx="44" ry="13" fill="#757575"/>
        {/* Pan body */}
        <ellipse cx="70" cy="97" rx="44" ry="13" fill="#9e9e9e"/>
        {/* Pan inner */}
        <ellipse cx="70" cy="95" rx="40" ry="10" fill="#bdbdbd"/>
        {/* Pan handle */}
        <path d="M112 90 Q130 88 133 94 Q130 100 112 100 Z" fill="#616161"/>
        <path d="M112 91 Q129 89 132 94 Q129 99 112 99 Z" fill="#757575"/>

        {/* Food — meat patty */}
        <ellipse cx="52" cy="91" rx="14" ry="7" fill="#ef9a9a"
                 style={{ transformOrigin: '52px 91px', animation: 'sizzle 0.7s ease-in-out infinite' }}/>
        {/* Food — egg */}
        <ellipse cx="83" cy="90" rx="11" ry="6" fill="#fff9c4"
                 style={{ transformOrigin: '83px 90px', animation: 'sizzle 0.85s ease-in-out infinite 0.2s' }}/>
        <circle cx="83" cy="90" r="4" fill="#ffcc02"/>
        {/* Food — veggies */}
        <ellipse cx="67" cy="87" rx="7" ry="4" fill="#a5d6a7" opacity="0.9"
                 style={{ transformOrigin: '67px 87px', animation: 'sizzle 0.6s ease-in-out infinite 0.1s' }}/>
      </svg>
    </div>
  );
}

function MotorcycleAnimation() {
  return (
    <div className="relative w-64 h-40 mx-auto overflow-hidden rounded-xl">
      <style>{ANIMATIONS_CSS}</style>

      {/* Sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200 to-sky-100 dark:from-slate-700 dark:to-slate-800"/>

      {/* Road */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gray-500 dark:bg-gray-600 overflow-hidden">
        {/* Dashed center line */}
        <div className="absolute top-1/2 -translate-y-1/2 flex"
             style={{ animation: 'road-m 0.35s linear infinite', width: '200%' }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="w-10 h-1.5 bg-yellow-300 rounded-full mx-3 flex-shrink-0"/>
          ))}
        </div>
      </div>

      {/* Motorcycle + rider */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2"
           style={{ animation: 'moto-b 0.35s ease-in-out infinite' }}>
        <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" className="w-52 h-28">

          {/* Exhaust smoke */}
          <circle cx="22" cy="62" r="5" fill="#b0bec5" opacity="0.7"
                  style={{ animation: 'exhaust 0.8s ease-out infinite' }}/>
          <circle cx="18" cy="60" r="3.5" fill="#cfd8dc" opacity="0.5"
                  style={{ animation: 'exhaust 0.8s ease-out infinite 0.25s' }}/>

          {/* Rear wheel */}
          <g style={{ transformOrigin: '35px 68px', animation: 'spin-w 0.28s linear infinite' }}>
            <circle cx="35" cy="68" r="20" fill="none" stroke="#212121" strokeWidth="6"/>
            <circle cx="35" cy="68" r="9" fill="#424242"/>
            <line x1="35" y1="48" x2="35" y2="88" stroke="#616161" strokeWidth="2.5"/>
            <line x1="15" y1="68" x2="55" y2="68" stroke="#616161" strokeWidth="2.5"/>
            <line x1="21" y1="54" x2="49" y2="82" stroke="#616161" strokeWidth="2"/>
            <line x1="49" y1="54" x2="21" y2="82" stroke="#616161" strokeWidth="2"/>
          </g>

          {/* Front wheel */}
          <g style={{ transformOrigin: '128px 68px', animation: 'spin-w 0.28s linear infinite' }}>
            <circle cx="128" cy="68" r="20" fill="none" stroke="#212121" strokeWidth="6"/>
            <circle cx="128" cy="68" r="9" fill="#424242"/>
            <line x1="128" y1="48" x2="128" y2="88" stroke="#616161" strokeWidth="2.5"/>
            <line x1="108" y1="68" x2="148" y2="68" stroke="#616161" strokeWidth="2.5"/>
            <line x1="114" y1="54" x2="142" y2="82" stroke="#616161" strokeWidth="2"/>
            <line x1="142" y1="54" x2="114" y2="82" stroke="#616161" strokeWidth="2"/>
          </g>

          {/* Swingarm */}
          <line x1="35" y1="68" x2="70" y2="54" stroke="#9e9e9e" strokeWidth="4" strokeLinecap="round"/>

          {/* Main body */}
          <path d="M42 66 L58 36 L105 30 L128 48 L122 66 Z" fill="#e67e22"/>
          {/* Fairing / nose */}
          <path d="M105 30 L128 45 L132 52 L125 54 L110 38 Z" fill="#bf360c"/>
          {/* Seat */}
          <path d="M58 36 L82 27 L103 30 L100 36 L58 36 Z" fill="#4e342e"/>
          {/* Tank */}
          <path d="M72 27 L100 24 L104 31 L72 32 Z" fill="#bf360c"/>
          {/* Headlight */}
          <ellipse cx="130" cy="44" rx="6" ry="5" fill="#fff9c4" opacity="0.9"/>
          <ellipse cx="130" cy="44" rx="4" ry="3.5" fill="#ffff8d"/>
          {/* Handlebar */}
          <path d="M118 32 L124 26 L130 28" stroke="#757575" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          {/* Exhaust pipe */}
          <path d="M44 62 Q30 66 24 65" stroke="#9e9e9e" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          {/* Front fork */}
          <line x1="118" y1="40" x2="128" y2="48" stroke="#bdbdbd" strokeWidth="4" strokeLinecap="round"/>
          <line x1="114" y1="38" x2="124" y2="48" stroke="#9e9e9e" strokeWidth="3" strokeLinecap="round"/>

          {/* Rider legs */}
          <path d="M72 44 L58 58 L66 62 L76 50 Z" fill="#1a237e"/>
          {/* Rider body */}
          <path d="M78 16 L95 18 L98 42 L72 44 L70 26 Z" fill="#1565c0"/>
          {/* Rider arm to handlebar */}
          <path d="M93 28 Q110 26 118 30" stroke="#1565c0" strokeWidth="5" strokeLinecap="round" fill="none"/>
          {/* Rider head */}
          <circle cx="84" cy="12" r="9" fill="#ffcc80"/>
          {/* Helmet */}
          <path d="M75 9 Q84 1 93 9 Q94 20 84 20 Q74 20 75 9 Z" fill="#e67e22"/>
          {/* Visor */}
          <path d="M76 13 Q84 10 92 13" stroke="#bf360c" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          {/* Jacket stripe */}
          <line x1="78" y1="28" x2="96" y2="30" stroke="#0d47a1" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}

function CompletedAnimation() {
  return (
    <div className="w-32 h-32 mx-auto relative">
      <style>{ANIMATIONS_CSS}</style>
      {/* Confetti pieces */}
      <div className="absolute top-1 left-3 w-3 h-3 bg-yellow-400 rounded-sm"  style={{ animation: 'confetti-a 1.4s ease-in infinite' }}/>
      <div className="absolute top-3 right-3 w-2 h-4 bg-pink-400 rounded-sm"   style={{ animation: 'confetti-b 1.4s ease-in infinite 0.3s' }}/>
      <div className="absolute top-1 right-9 w-3 h-2 bg-blue-400 rounded-sm"   style={{ animation: 'confetti-a 1.4s ease-in infinite 0.6s' }}/>
      <div className="absolute top-5 left-9 w-2 h-3 bg-green-400 rounded-sm"   style={{ animation: 'confetti-b 1.4s ease-in infinite 0.9s' }}/>
      <div className="absolute top-2 left-1/2 w-2 h-2 bg-purple-400 rounded-sm" style={{ animation: 'confetti-a 1.4s ease-in infinite 0.45s' }}/>
      <svg viewBox="0 0 100 100" className="w-full h-full relative z-10" style={{ animation: 'pop-in 0.5s ease-out' }}>
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

type Order = { id: string; client_name: string; client_phone: string; delivery_address: string | null; total_amount: number; status: string; created_at: string };

export default function TrackPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [inputPhone, setInputPhone] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async (phone: string) => {
    if (!phone) { setLoading(false); setNotFound(true); return; }
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('client_phone', phone)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) { setOrder(data); setNotFound(false); }
    else { setOrder(null); setNotFound(true); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('deliveryPhone') || localStorage.getItem('lastOrderPhone') || '';
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

  const stepIndex = (status: string) => STEPS.findIndex(s => s.key === status);
  const current = order ? stepIndex(order.status) : -1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4 stagger-0">
        <h1 className="text-xl font-bold text-[#944a00] text-center">تتبع طلبك</h1>
      </header>

      <div className="px-4 pt-5">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-10 h-10 border-4 border-[#e67e22] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : notFound ? (
          <div className="text-center mt-16 stagger-1">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">لا يوجد طلب حالي</h2>
            <p className="text-gray-500 dark:text-slate-400 mb-6 text-sm">ابحث عن طلبك برقم هاتفك</p>
            <div className="flex gap-2 max-w-sm mx-auto">
              <button onClick={() => fetchOrder(inputPhone)} className="bg-[#e67e22] text-white px-4 py-3 rounded-xl font-bold active:scale-95 transition-all">
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
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 stagger-1">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-6">حالة الطلب</h3>
              <div className="flex items-center mb-3">
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
                      <span className={`text-xs mt-1 font-medium text-center leading-tight ${idx <= current ? 'text-[#e67e22]' : 'text-gray-400 dark:text-slate-500'}`}>
                        {step.label}
                      </span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`flex-1 h-1 rounded mx-1 transition-all duration-700 ${idx < current ? 'bg-[#e67e22]' : 'bg-gray-100 dark:bg-slate-700'}`}/>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Animated Status Card */}
            <div className="bg-orange-50 dark:bg-orange-900/10 border-2 border-[#e67e22] rounded-2xl p-5 text-center stagger-2">
              <div className="mb-3">
                {STATUS_ANIMATION[order.status] ?? <div className="text-5xl">{STEPS[current]?.icon}</div>}
              </div>
              <p className="text-[#e67e22] font-bold text-lg mb-1">{STEPS[current]?.label}</p>
              <p className="text-gray-500 dark:text-slate-400 text-sm">{STEPS[current]?.desc}</p>
            </div>

            {/* Order Details */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 stagger-3">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-4">تفاصيل الطلب</h3>
              {[
                { label: 'الاسم',     value: order.client_name },
                { label: 'العنوان',   value: order.delivery_address || '—' },
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
