// طبقة مساعدة لنظام RBAC (المالك/المدير مقابل الكاشير) — راجع
// خطة_نظام_الصلاحيات_RBAC.md القسم 3 و 6.
//
// نقطة أمان جوهرية: الكاشير والمالك يشاركان نفس Supabase JWT (نفس الجلسة)،
// لذلك RLS لا يميّز بينهما. الإنفاذ الحقيقي هنا: كل route حساس يستقبل
// staff_id من العميل، لكنه **لا يثق بأي دور/حد مُرسل بالـ body** — يجيب
// الدور والحدود دائماً من قاعدة البيانات عبر getStaffContext() أدناه.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type StaffRole = 'owner' | 'manager' | 'cashier';

export type StaffContext = {
  id: string;
  restaurant_id: string;
  display_name: string;
  role: StaffRole;
  is_active: boolean;
  max_discount_pct: number;
  max_void_amount: number;
  locked_until: string | null;
};

const SCRYPT_KEYLEN = 64;

/** الإيميل الداخلي الصناعي لحساب الكاشير — نفس نمط slug@dasha.app لحساب المطعم. */
export function staffCodeToEmail(code: string): string {
  return `${code.trim().toLowerCase()}@cashier.dasha.app`;
}

/** يولّد كوداً رقمياً من 6 أرقام لتسجيل دخول الكاشير (يُعرض للمالك، لا يحتاج تذكّر كلمات). */
export function generateStaffCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** يحسب hash لـ PIN موظف بصيغة "salt:hash" (hex). لا يُخزَّن PIN كنص صريح أبداً. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

/** يقارن PIN مُدخَل مع الـ hash المخزَّن، بمقارنة زمن ثابت (timing-safe). */
export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  try {
    const storedBuf = Buffer.from(hash, 'hex');
    const suppliedBuf = scryptSync(pin, salt, SCRYPT_KEYLEN);
    if (storedBuf.length !== suppliedBuf.length) return false;
    return timingSafeEqual(storedBuf, suppliedBuf);
  } catch {
    return false;
  }
}

/** PIN من 4 إلى 6 أرقام فقط. */
export function isValidPinFormat(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin);
}

/**
 * يجيب دور وحدود staff_id مباشرة من القاعدة (supabaseAdmin/service role).
 * هذا هو مصدر الحقيقة الوحيد للدور — لا تستخدم أبداً دوراً مُرسلاً من العميل.
 * يرجع null إذا لم يوجد الموظف أو كان معطّلاً (is_active = false).
 */
export async function getStaffContext(staffId: string): Promise<StaffContext | null> {
  if (!staffId) return null;
  const { data, error } = await supabaseAdmin
    .from('restaurant_staff')
    .select('id, restaurant_id, display_name, role, is_active, max_discount_pct, max_void_amount, locked_until')
    .eq('id', staffId)
    .maybeSingle();

  if (error || !data || !data.is_active) return null;
  return data as StaffContext;
}

/** المسؤول = owner أو manager (نفس عمود "المسؤول (Owner/Manager)" بمصفوفة الصلاحيات). */
export function isPrivilegedRole(role: StaffRole): boolean {
  return role === 'owner' || role === 'manager';
}

/**
 * تحقق جلسة Supabase الحقيقية لمالك المطعم (Authorization: Bearer <access_token>)
 * — نفس نمط src/app/api/admin/my-restaurant/route.ts الموجود فعلاً.
 * يُستخدم فقط للنقاط "مالك فقط" (إدارة الموظفين، الموافقات).
 */
export async function verifyOwnerRequest(
  req: NextRequest,
  restaurantId: string
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  if (!restaurantId) return { ok: false, status: 400, error: 'restaurant_id مطلوب' };

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: 'Unauthorized' };

  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', data.user.id)
    .maybeSingle();

  if (!restaurant) return { ok: false, status: 403, error: 'ليست لديك صلاحية على هذا المطعم' };

  return { ok: true, userId: data.user.id };
}

// ─────────────────────────────────────────────────────────────
// طبقة توقيع الهوية (Staff Session Token) — إصلاح ثغرة أمنية حرجة
// اكتشفتها مراجعة أمنية مستقلة: كانت كل route حساسة تستقبل staff_id من
// جسم الطلب مباشرة وتثق به لتحديد "من ينفّذ العملية". بما أن الكاشير
// والمالك يشتركان بنفس JWT، فإن أي طرف يملك الجلسة (كاشير) كان يقدر
// يرسل staff_id تبع المالك نفسه فينفّذ عمليات بصلاحيات غير صلاحياته
// الفعلية (خصم 100%، استرجاع مباشر، حذف سجل تدقيق... إلخ) — دون الحاجة
// لمعرفة أي PIN، فقط بمعرفة معرّف الموظف (المُسرَّب أصلاً عبر GET /api/staff).
//
// الحل: عند نجاح التحقق من PIN (أو تأكيد جلسة المالك)، الخادم يوقّع
// توكن HMAC قصير العمر يحمل الهوية + الدور، ويُرسَل بترويسة x-staff-token
// بكل طلب حساس لاحق. كل route يتحقق من التوقيع بنفسه (لا يثق بأي شيء
// غير موقَّع من العميل) ويستخرج staff_id/role من التوكن نفسه — ليس من
// أي حقل آخر بالطلب. الحدود المالية (max_discount_pct/max_void_amount)
// تبقى تُقرأ دائماً حيّة من القاعدة عبر getStaffContext (وليس من التوكن)
// حتى تنعكس أي تعديلات يجريها المالك على الفور.
const STAFF_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة (مدة وردية عمل نموذجية)

function staffTokenSecret(): string {
  const secret = process.env.STAFF_TOKEN_SECRET || process.env.API_SECRET;
  if (!secret) throw new Error('STAFF_TOKEN_SECRET أو API_SECRET غير مضبوط بالبيئة');
  return secret;
}

export type StaffTokenPayload = {
  sid: string | null;   // restaurant_staff.id، أو null إذا كانت الهوية "مالك" بلا صف موظف
  rid: string;           // restaurant_id
  role: StaffRole;
  exp: number;           // انتهاء الصلاحية (epoch ms)
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** يوقّع هوية موظف/مالك بتوكن HMAC قصير العمر — يُستخدم بترويسة x-staff-token. */
export function signStaffToken(payload: Omit<StaffTokenPayload, 'exp'>): string {
  const full: StaffTokenPayload = { ...payload, exp: Date.now() + STAFF_TOKEN_TTL_MS };
  const body = b64url(JSON.stringify(full));
  const sig = createHmac('sha256', staffTokenSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** يتحقق توقيع/صلاحية التوكن. يرجع null إن كان مزوَّراً أو منتهياً أو مشوَّهاً. */
export function verifyStaffToken(token: string | null | undefined): StaffTokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expectedSig = createHmac('sha256', staffTokenSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StaffTokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    if (typeof payload.rid !== 'string' || !payload.rid) return null;
    return payload;
  } catch {
    return null;
  }
}

export type ResolvedIdentity = {
  restaurant_id: string;
  staff_id: string | null;
  role: StaffRole;
  display_name: string;
  is_privileged: boolean;
  max_discount_pct: number;
  max_void_amount: number;
};

/**
 * نقطة الدخول الموحّدة لكل route حساس: تتحقق من x-staff-token، وتُرجع
 * هوية موثوقة (لا تثق بأي staff_id/role مُرسَل بالـ body بعد اليوم).
 * للمالك (sid=null): حدود غير مقيَّدة. للموظف: الحدود تُقرأ حيّة من
 * القاعدة عبر getStaffContext (وليس من التوكن) كي تبقى دقيقة لحظياً.
 */
export async function resolveStaffIdentity(req: NextRequest): Promise<
  { ok: true; identity: ResolvedIdentity } | { ok: false; status: number; error: string }
> {
  const token = req.headers.get('x-staff-token');
  const payload = verifyStaffToken(token);
  if (!payload) return { ok: false, status: 401, error: 'جلسة الموظف غير صالحة أو منتهية — الرجاء إعادة إدخال PIN' };

  if (payload.sid === null) {
    if (payload.role !== 'owner') return { ok: false, status: 403, error: 'توكن غير صالح' };
    return {
      ok: true,
      identity: {
        restaurant_id: payload.rid,
        staff_id: null,
        role: 'owner',
        display_name: 'المالك',
        is_privileged: true,
        max_discount_pct: 100,
        max_void_amount: Number.MAX_SAFE_INTEGER,
      },
    };
  }

  const staff = await getStaffContext(payload.sid);
  if (!staff || staff.restaurant_id !== payload.rid) {
    return { ok: false, status: 403, error: 'موظف غير صالح أو معطّل' };
  }

  return {
    ok: true,
    identity: {
      restaurant_id: staff.restaurant_id,
      staff_id: staff.id,
      role: staff.role,
      display_name: staff.display_name,
      is_privileged: isPrivilegedRole(staff.role),
      max_discount_pct: Number(staff.max_discount_pct),
      max_void_amount: Number(staff.max_void_amount),
    },
  };
}
