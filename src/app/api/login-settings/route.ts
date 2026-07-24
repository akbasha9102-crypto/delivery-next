import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isValidFontKey } from '@/app/login/login-fonts';

const SETTINGS_ROW_ID = '00000000-0000-0000-0000-000000000001';
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

// GET — عام بلا حماية: تُقرأ من كل زوار صفحة /login
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('login_page_identity')
    .select('brand_font_key, brand_color, login_font_key, login_color')
    .eq('id', SETTINGS_ROW_ID)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ identity: data ?? null });
}

// POST — تحديث الهوية البصرية، محمي بنفس كوكي جلسة سوبر أدمن
export async function POST(req: NextRequest) {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { brandFontKey, brandColor, loginFontKey, loginColor } = body ?? {};

  if (!isValidFontKey(brandFontKey)) {
    return NextResponse.json({ error: 'brandFontKey غير صالح' }, { status: 400 });
  }
  if (!isValidFontKey(loginFontKey)) {
    return NextResponse.json({ error: 'loginFontKey غير صالح' }, { status: 400 });
  }
  if (typeof brandColor !== 'string' || !HEX_COLOR_RE.test(brandColor)) {
    return NextResponse.json({ error: 'brandColor غير صالح' }, { status: 400 });
  }
  if (typeof loginColor !== 'string' || !HEX_COLOR_RE.test(loginColor)) {
    return NextResponse.json({ error: 'loginColor غير صالح' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('login_page_identity')
    .update({
      brand_font_key: brandFontKey,
      brand_color: brandColor,
      login_font_key: loginFontKey,
      login_color: loginColor,
      updated_at: new Date().toISOString(),
    })
    .eq('id', SETTINGS_ROW_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
