/**
 * قراءة الدور/المطعم من الـ JWT نفسه (app_metadata.role / app_metadata.restaurant_id)
 * — الـ claims يحقنها custom_access_token_hook (راجع supabase/migrations/20260710120000_rbac_custom_claims.sql)
 * عند كل إصدار/تجديد جلسة. supabase.auth.getUser() لا يرجعها (يقرأ صف auth.users
 * الخام، ليس claims الـ hook الديناميكية) — لذلك لازم فكّ الـ JWT مباشرة.
 */

export type SessionClaims = {
  userId: string;
  role: 'owner' | 'manager' | 'cashier' | 'driver' | null;
  restaurantId: string | null;
  exp: number | null;
};

type JwtPayload = {
  sub: string;
  app_metadata?: { role?: string; restaurant_id?: string };
  exp?: number;
};

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(input.length + ((4 - (input.length % 4)) % 4), '=');
  return typeof Buffer !== 'undefined'
    ? Buffer.from(padded, 'base64').toString('utf8')
    : atob(padded);
}

function decodePayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
  } catch {
    return null;
  }
}

function toClaims(payload: JwtPayload | null): SessionClaims | null {
  if (!payload?.sub) return null;
  const role = payload.app_metadata?.role;
  return {
    userId: payload.sub,
    role: role === 'owner' || role === 'manager' || role === 'cashier' || role === 'driver' ? role : null,
    restaurantId: payload.app_metadata?.restaurant_id ?? null,
    exp: typeof payload.exp === 'number' ? payload.exp : null,
  };
}

/**
 * قراءة بدون تحقق من التوقيع — تُستخدم فقط بالعميل (المتصفح) على توكن
 * ناتج من supabase.auth.getSession() الخاصة بنا (حدود ثقة الجلسة نفسها،
 * مو توكن وارد من طرف خارجي)، وليس لاتخاذ قرار أمني سيرفر-سايد.
 */
export function decodeSessionClaims(accessToken: string): SessionClaims | null {
  return toClaims(decodePayload(accessToken));
}
