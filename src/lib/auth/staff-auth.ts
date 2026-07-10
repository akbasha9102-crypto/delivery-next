// طبقة مساعدة لنظام RBAC (owner/manager/cashier/driver).
//
// كل جلسة (مالك أو موظف) هي حساب Supabase Auth حقيقي ومستقل، والدور
// (role/restaurant_id) موجود داخل الـ JWT نفسه عبر custom_access_token_hook
// (راجع supabase/migrations/20260710120000_rbac_custom_claims.sql). كل
// route حساس يتحقق من توقيع الجلسة عبر verifyRequestClaims ثم يجيب
// الحدود المالية (max_discount_pct/max_void_amount) حيّة من القاعدة —
// لا يوجد أي توكن موقَّع يدوياً بعد الآن، ولا أي دور يُرسَل/يُوثَق به من جسم الطلب.
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyRequestClaims } from './verify-session';

export type StaffRole = 'owner' | 'manager' | 'cashier' | 'driver';

export type StaffContext = {
  id: string;
  restaurant_id: string;
  display_name: string;
  role: StaffRole;
  is_active: boolean;
  max_discount_pct: number;
  max_void_amount: number;
};

/** الإيميل الداخلي الصناعي لحساب الكاشير/السائق — نفس نمط slug@dasha.app لحساب المطعم. */
export function staffCodeToEmail(code: string): string {
  return `${code.trim().toLowerCase()}@cashier.dasha.app`;
}

/** يولّد كوداً رقمياً من 6 أرقام لتسجيل دخول الكاشير (يُعرض للمالك، لا يحتاج تذكّر كلمات). */
export function generateStaffCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * يجيب دور وحدود موظف (manager/cashier/driver) من user_roles مباشرة —
 * مصدر الحقيقة الوحيد للحدود المالية، حيّ دائماً من القاعدة.
 * يرجع null إذا لم يوجد الصف أو كان معطّلاً (is_active = false).
 */
export async function getStaffContext(userId: string, restaurantId: string): Promise<StaffContext | null> {
  if (!userId || !restaurantId) return null;
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('id, restaurant_id, display_name, role, is_active, max_discount_pct, max_void_amount')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
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

export type ResolvedIdentity = {
  restaurant_id: string;
  user_id: string;             // auth.uid() لهذه الجلسة — المعرّف الموثوق الوحيد
  staff_id: string | null;     // user_roles.id إن وُجد (owner: null دائماً)
  role: StaffRole;
  display_name: string;
  is_privileged: boolean;
  max_discount_pct: number;
  max_void_amount: number;
};

/**
 * نقطة الدخول الموحّدة لكل route حساس: تتحقق من توقيع جلسة Supabase
 * الحقيقية (Authorization: Bearer) وتقرأ role/restaurant_id من claims
 * الـ JWT نفسه — لا يوجد أي توكن موقَّع يدوياً أو دور مُرسَل من العميل بعد
 * الآن. restaurantId المتوقَّع يُمرَّر من الـ route (مثلاً من الطلب نفسه
 * الذي يُنفَّذ عليه الإجراء) لأن claim المالك لا يحمل restaurant_id (تفادياً
 * لإشكال المالك متعدد الفروع) — التحقق الفعلي لملكية المالك لهذا المطعم
 * بالذات يمر عبر restaurants.owner_id هنا.
 */
export async function resolveStaffIdentity(req: NextRequest, expectedRestaurantId: string): Promise<
  { ok: true; identity: ResolvedIdentity } | { ok: false; status: number; error: string }
> {
  if (!expectedRestaurantId) return { ok: false, status: 400, error: 'restaurant_id مطلوب' };

  const claims = verifyRequestClaims(req);
  if (!claims) return { ok: false, status: 401, error: 'جلسة غير صالحة أو منتهية — الرجاء تسجيل الدخول من جديد' };

  if (claims.role === 'owner') {
    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('id', expectedRestaurantId)
      .eq('owner_id', claims.userId)
      .maybeSingle();
    if (!restaurant) return { ok: false, status: 403, error: 'ليست لديك صلاحية على هذا المطعم' };
    return {
      ok: true,
      identity: {
        restaurant_id: expectedRestaurantId,
        user_id: claims.userId,
        staff_id: null,
        role: 'owner',
        display_name: 'المالك',
        is_privileged: true,
        max_discount_pct: 100,
        max_void_amount: Number.MAX_SAFE_INTEGER,
      },
    };
  }

  if (!claims.role || claims.restaurantId !== expectedRestaurantId) {
    return { ok: false, status: 403, error: 'لا تملك صلاحية على هذا المطعم' };
  }

  const staff = await getStaffContext(claims.userId, expectedRestaurantId);
  if (!staff) return { ok: false, status: 403, error: 'حساب غير صالح أو معطّل' };

  return {
    ok: true,
    identity: {
      restaurant_id: staff.restaurant_id,
      user_id: claims.userId,
      staff_id: staff.id,
      role: staff.role,
      display_name: staff.display_name,
      is_privileged: isPrivilegedRole(staff.role),
      max_discount_pct: Number(staff.max_discount_pct),
      max_void_amount: Number(staff.max_void_amount),
    },
  };
}
