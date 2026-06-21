'use client';
import { useState, useEffect, useRef } from 'react';
import { ClientBottomNav } from '@/components/BottomNav';
import { User, Pencil, Check, Phone, LogOut } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { CustomerGuard } from '@/components/CustomerGuard';
import { useDarkMode } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
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
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  type?: string;
  color: string;
  pencilColor: string;
  onSave: (v: string) => void;
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

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.09-6.09C34.46 3.04 29.5 1 24 1 14.82 1 7.03 6.48 3.44 14.28l7.08 5.5C12.29 13.72 17.7 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.7c-.55 2.96-2.21 5.47-4.7 7.16l7.22 5.6C43.43 37.17 46.5 31.29 46.5 24.5z"/>
      <path fill="#FBBC05" d="M10.52 28.22A14.6 14.6 0 0 1 9.5 24c0-1.47.2-2.9.52-4.22l-7.08-5.5A23.94 23.94 0 0 0 0 24c0 3.88.93 7.55 2.56 10.79l7.96-6.57z"/>
      <path fill="#34A853" d="M24 47c5.5 0 10.12-1.82 13.49-4.95l-7.22-5.6c-1.88 1.26-4.29 2.01-6.27 2.01-6.3 0-11.71-4.22-13.48-9.78l-7.96 6.57C7.03 41.52 14.82 47 24 47z"/>
    </svg>
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
  const [session,     setSession]     = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/profile' },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const saveName  = (v: string) => { setName(v);  localStorage.setItem(KEYS.name,  v); flash(); };
  const savePhone = (v: string) => { setPhone(v); localStorage.setItem(KEYS.phone, v); flash(); };
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  if (!mounted) return null;

  const googleAvatar = session?.user?.user_metadata?.avatar_url as string | undefined;
  const googleEmail  = session?.user?.email;

  return (
    <CustomerGuard>
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-center text-gray-900 dark:text-white">معلوماتي</h1>
      </header>

      <div className="px-4 pt-5 max-w-lg mx-auto space-y-4">

        {/* Avatar */}
        <div className="flex justify-center pt-2 pb-1">
          {googleAvatar ? (
            <div className="relative w-20 h-20 rounded-full overflow-hidden shadow-lg ring-2 ring-white dark:ring-slate-700">
              <Image src={googleAvatar} alt="صورة الحساب" fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-blue-600 shadow-lg shadow-blue-500/40">
              {name ? (
                <span className="text-white font-bold text-base text-center leading-tight px-2 break-words max-w-full">
                  {name}
                </span>
              ) : (
                <User size={36} className="text-white" />
              )}
            </div>
          )}
        </div>

        {/* Personal info */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-2 border-b border-gray-50 dark:border-slate-700 text-right">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 py-2">معلوماتك الشخصية</h3>
          </div>
          <div className="px-5 pb-2">
            <EditableRow label="الاسم"   value={name}  icon={<User  size={14}/>} color={brandColor} pencilColor={pencilColor} onSave={saveName}  />
            <EditableRow label="الهاتف"  value={phone} icon={<Phone size={14}/>} color={brandColor} pencilColor={pencilColor} onSave={savePhone} type="tel" />
            {googleEmail && (
              <div className="flex justify-between items-center py-3.5">
                <span className="text-gray-500 dark:text-slate-400 text-sm font-medium">{googleEmail}</span>
                <span className="text-gray-400 dark:text-slate-500 text-sm">البريد</span>
              </div>
            )}
          </div>
        </div>

        {saved && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-center">
            <p className="text-green-700 dark:text-green-400 font-semibold text-sm">✓ تم الحفظ</p>
          </div>
        )}

        {/* Google auth section */}
        {!authLoading && (
          session ? (
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold text-sm active:scale-95 transition-all"
            >
              <LogOut size={18} />
              تسجيل الخروج من جوجل
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 font-bold text-sm shadow-sm active:scale-95 transition-all disabled:opacity-60"
            >
              <GoogleIcon />
              {googleLoading ? 'جارٍ التحويل...' : 'تسجيل الدخول بجوجل'}
            </button>
          )
        )}

        <p className="text-center text-xs text-gray-400 dark:text-slate-600 pb-2">
          {session ? 'تم تسجيل دخولك عبر حسابك في جوجل' : 'معلوماتك محفوظة على جهازك فقط'}
        </p>
      </div>

      <ClientBottomNav />
    </div>
    </CustomerGuard>
  );
}
