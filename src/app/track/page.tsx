'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ClientBottomNav } from '@/components/BottomNav';
import { Search, MessageSquare, AlertCircle } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
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
  completed: <CompletedAnimation />,
  rejected:  null,
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
  const [tick, setTick] = useState(0);

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

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackStep, setFeedbackStep] = useState<'choose' | 'write'>('choose');
  const [feedbackType, setFeedbackType] = useState<'feedback' | 'complaint'>('feedback');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [alreadySentFeedback, setAlreadySentFeedback] = useState(false);

  const fetchOrder = useCallback(async (phone: string) => {
    if (!phone) { setLoading(false); setNotFound(true); return; }
    setLoading(true);
    const { data: active } = await supabase
      .from('orders').select('*')
      .eq('client_phone', phone)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (active) {
      setOrder(active); setNotFound(false);
      setAlreadySentFeedback(false);
    } else {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: completed } = await supabase
        .from('orders').select('*')
        .eq('client_phone', phone)
        .eq('status', 'completed')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();
      if (completed) {
        setOrder(completed); setNotFound(false);
        setAlreadySentFeedback(!!localStorage.getItem(`fb_sent_${completed.id}`));
      } else {
        setOrder(null); setNotFound(true);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('deliveryPhone') || '';
    setInputPhone(saved);
    fetchOrder(saved);
  }, [fetchOrder]);

  useEffect(() => {
    if (!order) return;
    const channel = supabase.channel(`track-order-${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        async () => {
          const { data } = await supabase.from('orders').select('*').eq('id', order.id).single();
          if (data) setOrder(data as Order);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [order?.id]);


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
        ) : order?.status === 'rejected' ? (
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

            {/* ══ عداد انتظار القبول ══ */}
            {order.status === 'pending' && pendingCountdown && (
              <div className={`rounded-3xl p-6 text-center border-2 transition-colors ${pendingCountdown.urgent ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'}`}
                style={{ animation: 'status-enter 0.5s ease-out' }}>

                {/* دائرة العداد SVG */}
                <div className="relative w-36 h-36 mx-auto mb-4">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    {/* الخلفية */}
                    <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8"
                      className="stroke-gray-200 dark:stroke-slate-700" />
                    {/* الشريط المتحرك */}
                    <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8"
                      strokeLinecap="round"
                      stroke={pendingCountdown.urgent ? '#ef4444' : '#f59e0b'}
                      strokeDasharray={`${2 * Math.PI * 52}`}
                      strokeDashoffset={`${2 * Math.PI * 52 * (1 - pendingCountdown.pct)}`}
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                    />
                  </svg>
                  {/* الرقم في المنتصف */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-black tabular-nums ${pendingCountdown.urgent ? 'text-red-500' : 'text-amber-500'}`}>
                      {pendingCountdown.label}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500 font-medium mt-0.5">دقيقة</span>
                  </div>
                </div>

                <p className={`font-black text-lg mb-1 ${pendingCountdown.urgent ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {pendingCountdown.urgent ? '⚠️ على وشك الإلغاء!' : '⏳ في انتظار قبول الطلب'}
                </p>
                <p className="text-sm text-gray-400 dark:text-slate-500">
                  {pendingCountdown.urgent
                    ? 'سيُلغى طلبك خلال ثوانٍ إذا لم يُقبل'
                    : 'سيُلغى الطلب تلقائياً إذا لم يُقبل خلال الوقت المحدد'}
                </p>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700">
              <style>{`@keyframes line-fill{0%{width:0%}100%{width:100%}}`}</style>
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
                      <div className="flex-1 h-1 rounded mx-1 mb-5 relative overflow-hidden bg-gray-100 dark:bg-slate-700">
                        <div
                          className="absolute inset-y-0 left-0 rounded bg-gray-900 dark:bg-white"
                          style={
                            idx < current
                              ? { width: '100%' }
                              : idx === current
                              ? { width: '0%', animation: 'line-fill 2s linear infinite' }
                              : { width: '0%' }
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Animated Status Card */}
            <div key={order.status}
                 className="border-2 rounded-2xl p-5 text-center border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                 style={{ animation: 'status-enter 0.5s ease-out' }}>
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
                  <MessageSquare size={16} />
                  <span>تقديم ملاحظة أو شكوى</span>
                </button>
              )}
              {order.status === 'completed' && alreadySentFeedback && (
                <p className="mt-4 text-xs text-gray-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  تم إرسال ملاحظتك، شكراً!
                </p>
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
  );
}
