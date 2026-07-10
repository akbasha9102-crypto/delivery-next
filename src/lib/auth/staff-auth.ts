// طبقة مساعدة لنظام RBAC (owner/manager/cashier/driver).
//
// كل جلسة (مالك أو موظف) هي حساب Supabase Auth حقيقي ومستقل. الدور
// (owner/manager/cashier/driver) والحدود المالية لا تُقرأ من الـ JWT —
// Custom Access Token Hooks (التي كانت ستحقن role/restaurant_id داخل
// الـ claims، راجع supabase/migrations/20260710120000_rbac_custom_claims.sql)
// مقفلة على خطة Supabase المجانية، فالدالة لا تُستدعى أبداً عملياً. كل
// route حساس يتحقق من توقيع الجلسة عبر verifyRequestClaims (لاستخراج
// userId موثَّق فقط) ثم يستعلم الدور/الحدود مباشرة (Direct Query) من
// restaurants.owner_id / user_roles حيّة من القاعدة في كل طلب — لا يوجد
// أي توكن موقَّع يدوياً، ولا أي دور يُرسَل/يُوثَق به من جسم الطلب أو من الـ JWT.
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

/**
 * نفس getStaffContext لكن بدون معرفة restaurant_id مسبقاً — تُستخدم فقط
 * لاكتشاف دور الجلسة الحالية (مثل /api/staff/my-context) حين لا يكون
 * المطعم معروفاً بعد. تفترض عضوية واحدة نشطة لكل مستخدم (نفس افتراض
 * custom_access_token_hook الأصلي بـ LIMIT 1) — أي route يعرف
 * restaurant_id مسبقاً يجب أن يستخدم getStaffContext مباشرة بدل هذي.
 */
export async function findStaffContextByUserId(userId: string): Promise<StaffContext | null> {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('id, restaurant_id, display_name, role, is_active, max_discount_pct, max_void_amount')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as StaffContext;
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
 * الحقيقية (Authorization: Bearer) لاستخراج userId موثَّق، ثم تستعلم
 * الدور مباشرة (Direct Query) من القاعدة — لا من claims الـ JWT (مقفلة
 * عملياً، راجع تعليق أعلى الملف). restaurantId المتوقَّع يُمرَّر من الـ
 * route (مثلاً من الطلب نفسه الذي يُنفَّذ عليه الإجراء)؛ أولوية الفحص:
 * owner عبر restaurants.owner_id، وإلا staff نشط عبر user_roles — كلا
 * الاستعلامين مُقيَّدان بـ expectedRestaurantId بالذات، فلا يقدر مستخدم له
 * دور بمطعم آخر (أو دور أُلغي للتو) يمرّ هنا حتى لو كان الـ access_token
 * الحالي لسا صالحاً (تحقّق حيّ من القاعدة في كل طلب، لا يعتمد على تجديد الـ JWT).
 */
export async function resolveStaffIdentity(req: NextRequest, expectedRestaurantId: string): Promise<
  { ok: true; identity: ResolvedIdentity } | { ok: false; status: number; error: string }
> {
  if (!expectedRestaurantId) return { ok: false, status: 400, error: 'restaurant_id مطلوب' };

  const claims = verifyRequestClaims(req);
  if (!claims) return { ok: false, status: 401, error: 'جلسة غير صالحة أو منتهية — الرجاء تسجيل الدخول من جديد' };

  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('id', expectedRestaurantId)
    .eq('owner_id', claims.userId)
    .maybeSingle();

  if (restaurant) {
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

  const staff = await getStaffContext(claims.userId, expectedRestaurantId);
  if (!staff) return { ok: false, status: 403, error: 'لا تملك صلاحية على هذا المطعم' };

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
