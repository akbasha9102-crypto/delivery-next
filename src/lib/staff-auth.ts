// طبقة مساعدة لنظام RBAC (المالك/المدير مقابل الكاشير) — راجع
// خطة_نظام_الصلاحيات_RBAC.md القسم 3 و 6.
//
// نقطة أمان جوهرية: الكاشير والمالك يشاركان نفس Supabase JWT (نفس الجلسة)،
// لذلك RLS لا يميّز بينهما. الإنفاذ الحقيقي هنا: كل route حساس يستقبل
// staff_id من العميل، لكنه **لا يثق بأي دور/حد مُرسل بالـ body** — يجيب
// الدور والحدود دائماً من قاعدة البيانات عبر getStaffContext() أدناه.
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabase-admin';

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
