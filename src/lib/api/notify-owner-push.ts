// إشعار Push فوري للمالك/المدير — يكرر نفس نمط
// src/app/api/push/broadcast/route.ts و src/app/api/push/notify/route.ts
// بالضبط، لكن يستهدف restaurant_staff (role owner/manager) بدل drivers.
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/admin';

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (VAPID_SUBJECT && NEXT_PUBLIC_VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
  }
}

export type NotifyOwnerPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * يرسل push لكل owner/manager نشط عنده push_subscription مسجّل لهذا
 * المطعم — من user_roles (النموذج الجديد) ومن restaurant_staff (موظفون
 * مسجَّلون بالنظام القديم، مؤقتاً حتى حذف الجدول). لا يرمي استثناءً عند
 * الفشل (best effort) — الإشعار تحسين تجربة، وليس جزءاً من صحة العملية المالية نفسها.
 */
export async function notifyOwnerPush(restaurantId: string, payload: NotifyOwnerPayload): Promise<{ sent: number }> {
  try {
    ensureVapidConfigured();
    if (!vapidConfigured) {
      console.warn('[notifyOwnerPush] VAPID env vars missing — skipping push');
      return { sent: 0 };
    }

    const [{ data: newRecipients }, { data: legacyRecipients }] = await Promise.all([
      supabaseAdmin
        .from('user_roles')
        .select('id, push_subscription')
        .eq('restaurant_id', restaurantId)
        .eq('role', 'manager')
        .eq('is_active', true)
        .not('push_subscription', 'is', null),
      supabaseAdmin
        .from('restaurant_staff')
        .select('id, push_subscription')
        .eq('restaurant_id', restaurantId)
        .in('role', ['owner', 'manager'])
        .eq('is_active', true)
        .not('push_subscription', 'is', null),
    ]);

    const recipients = [
      ...(newRecipients ?? []).map((r) => ({ table: 'user_roles' as const, id: r.id, push_subscription: r.push_subscription })),
      ...(legacyRecipients ?? []).map((r) => ({ table: 'restaurant_staff' as const, id: r.id, push_subscription: r.push_subscription })),
    ];

    if (!recipients.length) return { sent: 0 };

    await Promise.allSettled(
      recipients.map(async (r) => {
        if (!r.push_subscription) return;
        try {
          await webpush.sendNotification(
            r.push_subscription,
            JSON.stringify({
              title: payload.title,
              body: payload.body,
              url: payload.url || '/admin/dashboard',
              tag: payload.tag || 'staff-alert',
            })
          );
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 410) {
            await supabaseAdmin.from(r.table).update({ push_subscription: null }).eq('id', r.id);
          }
        }
      })
    );

    return { sent: recipients.length };
  } catch (err) {
    console.error('[notifyOwnerPush] unexpected error:', err);
    return { sent: 0 };
  }
}
