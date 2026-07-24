'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { BRAND } from '../home/brand';
import {
  FONT_OPTIONS,
  DEFAULT_BRAND_FONT_KEY,
  DEFAULT_LOGIN_FONT_KEY,
  type LoginFontKey,
} from './login-fonts';
import LoginIdentityModal from './LoginIdentityModal';

// كل الخطوط الثمانية المدعومة تُستورد استيراداً ثابتاً وقت البناء عبر
// login-fonts.ts (next/font/google يتطلب ذلك) — نجمع كل CSS variables
// الخاصة بها هنا مرة واحدة كي تكون متاحة دائماً بغض النظر عن الخط المختار
// حالياً، فتبديل الاختيار لا يحتاج إعادة تحميل الصفحة.
const ALL_FONT_VARIABLE_CLASSES = Object.values(FONT_OPTIONS)
  .map(f => f.variableClass)
  .join(' ');

const DEFAULT_BRAND_COLOR = BRAND.green;
const DEFAULT_LOGIN_COLOR = '#1d1d1f';

export type LoginIdentity = {
  brandFontKey: LoginFontKey;
  brandColor: string;
  loginFontKey: LoginFontKey;
  loginColor: string;
};

type Props = {
  initialIdentity: LoginIdentity | null;
};

export default function LoginPageClient({ initialIdentity }: Props) {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [identity, setIdentity] = useState<LoginIdentity>(
    initialIdentity ?? {
      brandFontKey: DEFAULT_BRAND_FONT_KEY,
      brandColor: DEFAULT_BRAND_COLOR,
      loginFontKey: DEFAULT_LOGIN_FONT_KEY,
      loginColor: DEFAULT_LOGIN_COLOR,
    }
  );
  const [modalOpen, setModalOpen] = useState(false);

  const signIn = async () => {
    if (!identifier.trim() || !password.trim()) return;
    setLoading(true);
    setError('');

    const local = identifier.trim().split('@')[0].trim().toLowerCase();

    const res = await fetch('/api/auth/resolve-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: local }),
    });
    const resolved = await res.json().catch(() => ({}));

    if (!res.ok || !resolved.email) {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: resolved.email,
      password: password.trim(),
    });
    if (signInError) {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      setLoading(false);
      return;
    }
    router.replace('/admin/dashboard');
  };

  const brandFont = FONT_OPTIONS[identity.brandFontKey];
  const loginFont = FONT_OPTIONS[identity.loginFontKey];

  return (
    <div className={`min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4 ${ALL_FONT_VARIABLE_CLASSES}`}>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        aria-label="إعدادات هوية الصفحة"
        className="fixed top-4 left-4 z-40 w-10 h-10 rounded-full bg-white/80 backdrop-blur border border-gray-300 shadow-sm flex items-center justify-center text-[#1d1d1f]/60 hover:text-[#1d1d1f] hover:bg-white transition-all"
      >
        <Settings size={18} />
      </button>

      <div className="w-full max-w-sm card-float-in">
        <h1
          className="text-6xl font-extrabold text-center mb-1"
          style={{
            fontFamily: brandFont.fontFamily,
            color: identity.brandColor,
            WebkitTextStroke: `0.3px ${BRAND.dark}`,
            textShadow: [
              `0.3px 0 0 ${BRAND.dark}`,
              `-0.3px 0 0 ${BRAND.dark}`,
              `0 0.3px 0 ${BRAND.dark}`,
              `0 -0.3px 0 ${BRAND.dark}`,
              `0.3px 0.3px 0 ${BRAND.dark}`,
              `-0.3px 0.3px 0 ${BRAND.dark}`,
              `0.3px -0.3px 0 ${BRAND.dark}`,
              `-0.3px -0.3px 0 ${BRAND.dark}`,
            ].join(', '),
          }}
        >
          ماشي
        </h1>
        <p className="text-[#1d1d1f]/70 text-center mb-6 text-sm">
          <span style={{ fontFamily: loginFont.fontFamily, color: identity.loginColor }}>تسجيل الدخول</span>
          {' '}لإدارة مطعمك
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-[#1d1d1f] font-semibold mb-2 text-sm">البريد الإلكتروني أو اسم المستخدم</label>
          <input
            type="text"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            dir="ltr"
            className="w-full bg-gray-300 border border-gray-400 rounded-xl px-4 py-3 text-left text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:ring-2 focus:ring-[#D96846]/50 focus:border-[#D96846]/40 transition-all font-mono"
          />
        </div>
        <div className="mb-6">
          <label className="block text-[#1d1d1f] font-semibold mb-2 text-sm">كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && signIn()}
            placeholder="••••••••"
            className="w-full bg-gray-300 border border-gray-400 rounded-xl px-4 py-3 text-right text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:ring-2 focus:ring-[#D96846]/50 focus:border-[#D96846]/40 transition-all"
          />
        </div>
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full bg-[#D96846] hover:bg-[#D96846] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-[0_10px_25px_-5px_rgba(217,104,70,0.5)] transition-all active:scale-95"
        >
          {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>
      </div>

      {modalOpen && (
        <LoginIdentityModal
          identity={identity}
          onClose={() => setModalOpen(false)}
          onSaved={updated => {
            setIdentity(updated);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
