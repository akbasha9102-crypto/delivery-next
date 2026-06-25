'use client';
import { useState, useEffect, useRef } from 'react';
import { ClientBottomNav } from '@/components/BottomNav';
import { User, Pencil, Check, Phone, LogOut } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { CustomerGuard } from '@/components/CustomerGuard';
import { useDarkMode } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

const KEYS = {
  name:  'deliveryName',
  phone: 'deliveryPhone',
};

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

  useEffect(() => {
    setName(localStorage.getItem(KEYS.name)  || '');
    setPhone(localStorage.getItem(KEYS.phone) || '');
    setMounted(true);
  }, []);

  useEffect(() => {
    const applySession = (s: typeof session) => {
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
        // الرقم مضمون من الإيميل نفسه → حفظه دائماً بعد الدخول
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
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
    </CustomerGuard>
  );
}
