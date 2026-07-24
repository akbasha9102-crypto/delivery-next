import { supabaseAdmin } from '@/lib/supabase/admin';
import { isValidFontKey, DEFAULT_BRAND_FONT_KEY, DEFAULT_LOGIN_FONT_KEY } from './login-fonts';
import LoginPageClient, { type LoginIdentity } from './LoginPageClient';
import { BRAND } from '../home/brand';

// ISR برقم صريح — الهوية البصرية عامة لكل الزوار (لا localStorage)، مخزّنة
// بجدول login_page_identity (singleton). رقم صريح يعني أن أي تعديل يُحفظ
// عبر /api/login-settings ينعكس على كل الزوار خلال 30 ثانية كحد أقصى.
export const revalidate = 30;

export default async function LoginPage() {
  const { data } = await supabaseAdmin
    .from('login_page_identity')
    .select('brand_font_key, brand_color, login_font_key, login_color')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .maybeSingle();

  const initialIdentity: LoginIdentity | null = data
    ? {
        brandFontKey: isValidFontKey(data.brand_font_key) ? data.brand_font_key : DEFAULT_BRAND_FONT_KEY,
        brandColor: data.brand_color || BRAND.green,
        loginFontKey: isValidFontKey(data.login_font_key) ? data.login_font_key : DEFAULT_LOGIN_FONT_KEY,
        loginColor: data.login_color || '#1d1d1f',
      }
    : null;

  return <LoginPageClient initialIdentity={initialIdentity} />;
}
