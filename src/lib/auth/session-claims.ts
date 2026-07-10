/**
 * قراءة sub/exp من الـ JWT نفسه — بدون توقيع/تحقق (ذلك بمسؤولية
 * verifySessionClaims). لا تحمل هذه الدالة أي دور/مطعم بعد اليوم: كانا
 * يُقرآن من app_metadata.role/app_metadata.restaurant_id التي يحقنها
 * custom_access_token_hook (راجع supabase/migrations/20260710120000_rbac_custom_claims.sql)
 * — لكن Custom Access Token Hooks مقفلة على خطة Supabase المجانية، فالدالة
 * لا تُستدعى أبداً والـ claims هذي تبقى فارغة دائماً. الدور/المطعم الآن
 * يُقرآن دائماً باستعلام مباشر من user_roles/restaurants (راجع staff-auth.ts)
 * باستخدام userId المستخرج هنا فقط.
 */

export type SessionClaims = {
  userId: string;
  exp: number | null;
};

type JwtPayload = {
  sub: string;
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
  return {
    userId: payload.sub,
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
