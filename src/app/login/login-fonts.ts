import {
  Lateef,
  Baloo_Bhaijaan_2,
  Rakkas,
  Aref_Ruqaa,
  El_Messiri,
  Reem_Kufi,
  Cairo,
  Tajawal,
} from 'next/font/google';

// 8 خطوط مدعومة بلوحة إعدادات هوية صفحة /login. next/font/google يتطلب
// استيراداً ثابتاً وقت البناء لكل خط — لهذا القائمة مغلقة هنا، وقاعدة
// البيانات تخزّن "مفتاح" الاختيار فقط (login_page_identity.brand_font_key /
// login_font_key)، لا اسم خط حر. كل الخطوط الثمانية تدعم subsets
// ['arabic', 'latin'] فعلياً (تحقّقنا من google-fonts-metadata).

const lateef = Lateef({
  subsets: ['arabic', 'latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-lpi-lateef',
});

const balooBhaijaan2 = Baloo_Bhaijaan_2({
  subsets: ['arabic', 'latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-lpi-baloo',
});

const rakkas = Rakkas({
  subsets: ['arabic', 'latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-lpi-rakkas',
});

const arefRuqaa = Aref_Ruqaa({
  subsets: ['arabic', 'latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-lpi-aref-ruqaa',
});

const elMessiri = El_Messiri({
  subsets: ['arabic', 'latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-lpi-el-messiri',
});

const reemKufi = Reem_Kufi({
  subsets: ['arabic', 'latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-lpi-reem-kufi',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-lpi-cairo',
});

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-lpi-tajawal',
});

export type LoginFontKey =
  | 'lateef'
  | 'baloo_bhaijaan_2'
  | 'rakkas'
  | 'aref_ruqaa'
  | 'el_messiri'
  | 'reem_kufi'
  | 'cairo'
  | 'tajawal';

export const FONT_OPTIONS: Record<
  LoginFontKey,
  { label: string; fontFamily: string; variableClass: string }
> = {
  lateef: {
    label: 'Lateef',
    fontFamily: `var(--font-lpi-lateef), "Lateef", serif`,
    variableClass: lateef.variable,
  },
  baloo_bhaijaan_2: {
    label: 'Baloo Bhaijaan 2',
    fontFamily: `var(--font-lpi-baloo), "Baloo Bhaijaan 2", sans-serif`,
    variableClass: balooBhaijaan2.variable,
  },
  rakkas: {
    label: 'Rakkas',
    fontFamily: `var(--font-lpi-rakkas), "Rakkas", serif`,
    variableClass: rakkas.variable,
  },
  aref_ruqaa: {
    label: 'Aref Ruqaa',
    fontFamily: `var(--font-lpi-aref-ruqaa), "Aref Ruqaa", serif`,
    variableClass: arefRuqaa.variable,
  },
  el_messiri: {
    label: 'El Messiri',
    fontFamily: `var(--font-lpi-el-messiri), "El Messiri", sans-serif`,
    variableClass: elMessiri.variable,
  },
  reem_kufi: {
    label: 'Reem Kufi',
    fontFamily: `var(--font-lpi-reem-kufi), "Reem Kufi", sans-serif`,
    variableClass: reemKufi.variable,
  },
  cairo: {
    label: 'Cairo',
    fontFamily: `var(--font-lpi-cairo), "Cairo", sans-serif`,
    variableClass: cairo.variable,
  },
  tajawal: {
    label: 'Tajawal',
    fontFamily: `var(--font-lpi-tajawal), "Tajawal", sans-serif`,
    variableClass: tajawal.variable,
  },
};

export const FONT_KEYS = Object.keys(FONT_OPTIONS) as LoginFontKey[];

export const DEFAULT_BRAND_FONT_KEY: LoginFontKey = 'lateef';
export const DEFAULT_LOGIN_FONT_KEY: LoginFontKey = 'tajawal';

export function isValidFontKey(key: unknown): key is LoginFontKey {
  return typeof key === 'string' && FONT_KEYS.includes(key as LoginFontKey);
}
