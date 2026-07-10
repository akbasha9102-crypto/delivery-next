import { createHmac, timingSafeEqual } from 'crypto';
import { decodeSessionClaims, type SessionClaims } from './session-claims';

/**
 * تحقق سيرفر-سايد كامل (توقيع + انتهاء صلاحية) من Supabase access token،
 * ويرجع userId/exp الموثَّقين فقط (لا دور/مطعم — هذي تُستعلَم مباشرة من
 * user_roles/restaurants في staff-auth.ts، راجع تعليق session-claims.ts).
 * يحل محل نظام توكن x-staff-token الموقَّع يدوياً (staff-auth.ts القديم) —
 * كل نقاط الـ API الحساسة تتحقق الآن من جلسة Supabase الحقيقية مباشرة.
 *
 * يتطلب SUPABASE_JWT_SECRET بمتغيرات البيئة (Supabase Dashboard → Settings
 * → API → JWT Settings → JWT Secret). لو المشروع يستخدم مفاتيح توقيع
 * غير متماثلة (asymmetric JWT signing keys، ميزة أحدث)، هذا التحقق HS256
 * لازم يُستبدل بتحقق RS256/ES256 عبر JWKS.
 */
export function verifySessionClaims(accessToken: string): SessionClaims | null {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('SUPABASE_JWT_SECRET غير مضبوط بمتغيرات البيئة');

  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  const expectedSig = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
  const actualSig = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) return null;

  const claims = decodeSessionClaims(accessToken);
  if (!claims) return null;

  // فشل مغلق: توكن بلا exp (غير طبيعي لتوكن Supabase حقيقي) يُرفض، لا يُعامَل كأنه لا ينتهي أبداً.
  if (claims.exp === null || claims.exp * 1000 < Date.now()) return null;

  return claims;
}

/** يستخرج ويتحقق من Authorization: Bearer <token> برأس الطلب، أو null إن غاب/فسد. */
export function verifyRequestClaims(req: Request): SessionClaims | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    return verifySessionClaims(token);
  } catch {
    return null;
  }
}
