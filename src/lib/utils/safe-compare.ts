import { createHash, timingSafeEqual } from 'crypto';

// مقارنة نصّين بأمان زمني — نحسب sha256 hash لكل منهما أولاً لضمان أن كلا
// المُدخلين لهما نفس الطول دائماً (timingSafeEqual يرمي خطأ إن اختلف الطول)،
// ما يمنع استنتاج المحتوى الصحيح تدريجياً عبر قياس زمن الاستجابة. مشتركة
// بين كل نقطة تقارن سراً (super-admin/auth، cron/expire-orders) بدل تكرارها.
export function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
