'use client';
import { useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { X } from 'lucide-react';
import { BRAND } from '../home/brand';
import { FONT_OPTIONS, FONT_KEYS, type LoginFontKey } from './login-fonts';
import type { LoginIdentity } from './LoginPageClient';

type Props = {
  identity: LoginIdentity;
  onClose: () => void;
  onSaved: (identity: LoginIdentity) => void;
};

// مودال بمرحلتين: (1) تسجيل دخول سوبر أدمن/مالك عبر نفس
// POST /api/super-admin/auth الموجود فعلاً — لا آلية حماية جديدة، لا PIN
// جديد. (2) بعد النجاح فقط: اختيار خط ولون لعنوان "ماشي" ولعبارة
// "تسجيل الدخول"، مع معاينة حية، وحفظ عبر POST /api/login-settings
// (محمي بنفس كوكي sa_session من طرف السيرفر أيضاً).
export default function LoginIdentityModal({ identity, onClose, onSaved }: Props) {
  const [stage, setStage] = useState<'auth' | 'settings'>('auth');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [brandFontKey, setBrandFontKey] = useState<LoginFontKey>(identity.brandFontKey);
  const [brandColor, setBrandColor] = useState(identity.brandColor);
  const [loginFontKey, setLoginFontKey] = useState<LoginFontKey>(identity.loginFontKey);
  const [loginColor, setLoginColor] = useState(identity.loginColor);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  const submitAuth = async () => {
    if (!username.trim() || !password.trim()) return;
    setAuthLoading(true);
    setAuthError('');

    const res = await fetch('/api/super-admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      setAuthError('بيانات الدخول غير صحيحة');
      setAuthLoading(false);
      return;
    }

    setAuthLoading(false);
    setStage('settings');
  };

  const submitSave = async () => {
    setSaveLoading(true);
    setSaveError('');

    const res = await fetch('/api/login-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandFontKey, brandColor, loginFontKey, loginColor }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSaveError(data?.error || 'تعذّر حفظ الإعدادات');
      setSaveLoading(false);
      return;
    }

    setSaveLoading(false);
    onSaved({ brandFontKey, brandColor, loginFontKey, loginColor });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute top-4 left-4 text-[#86868b] hover:text-[#1d1d1f] transition-colors"
        >
          <X size={20} />
        </button>

        {stage === 'auth' && (
          <>
            <h2 className="text-lg font-bold text-[#1d1d1f] text-center mb-1">تسجيل دخول مطلوب</h2>
            <p className="text-sm text-[#6e6e73] text-center mb-6">
              للوصول إلى إعدادات هوية صفحة الدخول، سجّل دخولك كمشرف عام
            </p>

            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm text-center">
                {authError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-[#1d1d1f] font-semibold mb-2 text-sm">اسم المستخدم</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                dir="ltr"
                className="w-full bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-left text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#D96846]/50 focus:border-[#D96846]/40 transition-all font-mono"
              />
            </div>
            <div className="mb-6">
              <label className="block text-[#1d1d1f] font-semibold mb-2 text-sm">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitAuth()}
                placeholder="••••••••"
                className="w-full bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-right text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#D96846]/50 focus:border-[#D96846]/40 transition-all"
              />
            </div>
            <button
              onClick={submitAuth}
              disabled={authLoading}
              className="w-full bg-[#D96846] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
            >
              {authLoading ? 'جاري التحقق...' : 'دخول'}
            </button>
          </>
        )}

        {stage === 'settings' && (
          <>
            <h2 className="text-lg font-bold text-[#1d1d1f] text-center mb-6">هوية صفحة تسجيل الدخول</h2>

            {/* معاينة حية */}
            <div className="bg-[#f5f5f7] rounded-xl py-6 mb-6 text-center">
              <div
                className="text-4xl font-extrabold mb-1"
                style={{
                  fontFamily: FONT_OPTIONS[brandFontKey].fontFamily,
                  color: brandColor,
                  WebkitTextStroke: `0.3px ${BRAND.dark}`,
                  textShadow: [
                    `0.3px 0 0 ${BRAND.dark}`,
                    `-0.3px 0 0 ${BRAND.dark}`,
                    `0 0.3px 0 ${BRAND.dark}`,
                    `0 -0.3px 0 ${BRAND.dark}`,
                  ].join(', '),
                }}
              >
                ماشي
              </div>
              <p className="text-[#1d1d1f]/70 text-sm">
                <span style={{ fontFamily: FONT_OPTIONS[loginFontKey].fontFamily, color: loginColor }}>
                  تسجيل الدخول
                </span>{' '}
                لإدارة مطعمك
              </p>
            </div>

            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm text-center">
                {saveError}
              </div>
            )}

            {/* خط ولون "ماشي" */}
            <div className="mb-5">
              <label className="block text-[#1d1d1f] font-semibold mb-2 text-sm">خط كلمة &quot;ماشي&quot;</label>
              <select
                value={brandFontKey}
                onChange={e => setBrandFontKey(e.target.value as LoginFontKey)}
                className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#D96846]/50 mb-3"
              >
                {FONT_KEYS.map(key => (
                  <option key={key} value={key}>{FONT_OPTIONS[key].label}</option>
                ))}
              </select>
              <HexColorPicker color={brandColor} onChange={setBrandColor} style={{ width: '100%', height: 140 }} />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-[#6e6e73]">#</span>
                <HexColorInput
                  color={brandColor}
                  onChange={setBrandColor}
                  prefixed={false}
                  className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#D96846]/50 font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            {/* خط ولون "تسجيل الدخول" */}
            <div className="mb-6">
              <label className="block text-[#1d1d1f] font-semibold mb-2 text-sm">خط عبارة &quot;تسجيل الدخول&quot;</label>
              <select
                value={loginFontKey}
                onChange={e => setLoginFontKey(e.target.value as LoginFontKey)}
                className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#D96846]/50 mb-3"
              >
                {FONT_KEYS.map(key => (
                  <option key={key} value={key}>{FONT_OPTIONS[key].label}</option>
                ))}
              </select>
              <HexColorPicker color={loginColor} onChange={setLoginColor} style={{ width: '100%', height: 140 }} />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-[#6e6e73]">#</span>
                <HexColorInput
                  color={loginColor}
                  onChange={setLoginColor}
                  prefixed={false}
                  className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#D96846]/50 font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              onClick={submitSave}
              disabled={saveLoading}
              className="w-full bg-[#D96846] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
            >
              {saveLoading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
