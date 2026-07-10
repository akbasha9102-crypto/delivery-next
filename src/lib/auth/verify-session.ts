import { createPublicKey, verify as cryptoVerify, type KeyObject } from 'crypto';
import { decodeSessionClaims, type SessionClaims } from './session-claims';

/**
 * تحقق سيرفر-سايد كامل (توقيع + انتهاء صلاحية) من Supabase access token.
 * يرجع userId/exp الموثَّقين فقط (لا دور/مطعم — هذي تُستعلَم مباشرة من
 * user_roles/restaurants في staff-auth.ts، راجع تعليق session-claims.ts).
 *
 * المشروع يستخدم JWT Signing Keys غير المتماثلة (ES256 — تأكّدنا عبر
 * /auth/v1/.well-known/jwks.json)، وليس Legacy JWT Secret (HS256). التحقق
 * هنا يجلب المفتاح العام المطابق لـ kid من JWKS (مع كاش بالذاكرة) ويتحقق
 * من توقيع ECDSA بترميز IEEE-P1363 (تنسيق JWT القياسي لـ ES256، يختلف عن
 * ترميز DER الافتراضي بـ crypto.verify لمفاتيح EC).
 */

type Jwk = { kid: string; kty: string; [k: string]: unknown };

let cachedKeys: Map<string, KeyObject> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchJwks(): Promise<Map<string, KeyObject>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL غير مضبوط بمتغيرات البيئة');

  const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  if (!res.ok) throw new Error('تعذّر جلب JWKS من Supabase');
  const body = (await res.json()) as { keys: Jwk[] };

  const map = new Map<string, KeyObject>();
  for (const jwk of body.keys) {
    map.set(jwk.kid, createPublicKey({ key: jwk as unknown as Record<string, string>, format: 'jwk' }));
  }
  return map;
}

async function getSigningKey(kid: string): Promise<KeyObject | null> {
  const now = Date.now();
  if (cachedKeys && now - cachedAt < CACHE_TTL_MS) {
    const hit = cachedKeys.get(kid);
    if (hit) return hit;
  }
  // كاش منتهي، أو kid جديد غير موجود بالكاش الحالي (مثلاً بعد تدوير مفاتيح) — أعد الجلب.
  cachedKeys = await fetchJwks();
  cachedAt = now;
  return cachedKeys.get(kid) ?? null;
}

function base64UrlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export async function verifySessionClaims(accessToken: string): Promise<SessionClaims | null> {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'ES256' || !header.kid) return null;

  const key = await getSigningKey(header.kid);
  if (!key) return null;

  const signedData = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToBuffer(signatureB64);

  const valid = cryptoVerify('sha256', signedData, { key, dsaEncoding: 'ieee-p1363' }, signature);
  if (!valid) return null;

  const claims = decodeSessionClaims(accessToken);
  if (!claims) return null;

  // فشل مغلق: توكن بلا exp (غير طبيعي لتوكن Supabase حقيقي) يُرفض، لا يُعامَل كأنه لا ينتهي أبداً.
  if (claims.exp === null || claims.exp * 1000 < Date.now()) return null;

  return claims;
}

/** يستخرج ويتحقق من Authorization: Bearer <token> برأس الطلب، أو null إن غاب/فسد. */
export async function verifyRequestClaims(req: Request): Promise<SessionClaims | null> {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    return await verifySessionClaims(token);
  } catch {
    return null;
  }
}
