'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/context/RestaurantContext';
import { useStaff } from '@/context/StaffContext';

export type SANotification = { id: string; restaurant_id: string | null; title: string; body: string; created_at: string; read: boolean };

type Ctx = {
  notifications: SANotification[];
  notifLoading: boolean;
  unreadCount: number;
  toastQueue: SANotification[];
  markAllRead: () => Promise<void>;
  dismissToast: () => void;
};

const EMPTY_CTX: Ctx = {
  notifications: [],
  notifLoading: false,
  unreadCount: 0,
  toastQueue: [],
  markAllRead: async () => {},
  dismissToast: () => {},
};

const SuperAdminNotificationsContext = createContext<Ctx>(EMPTY_CTX);

export function SuperAdminNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { restaurantId } = useRestaurant();
  const { isCashier, ready } = useStaff();
  const [notifications, setNotifications] = useState<SANotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [toastQueue, setToastQueue] = useState<SANotification[]>([]);

  // بوابة الكاشير مركزية هنا فقط — الكاشير لا يجلب/يشترك بأي شيء إطلاقاً
  const gated = ready && isCashier;

  const load = useCallback(async () => {
    if (!restaurantId || gated) return;
    setNotifLoading(true);
    const [{ data: msgs }, { data: reads }] = await Promise.all([
      supabase.from('super_admin_notifications')
        .select('id, restaurant_id, title, body, created_at')
        .or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('super_admin_notification_reads')
        .select('notification_id')
        .eq('restaurant_id', restaurantId),
    ]);
    const readSet = new Set((reads ?? []).map(r => r.notification_id));
    setNotifications((msgs ?? []).map(m => ({ ...m, read: readSet.has(m.id) })));
    setNotifLoading(false);
  }, [restaurantId, gated]);

  useEffect(() => {
    if (!restaurantId || !ready || gated) return;
    load();
    const ch = supabase.channel('super-admin-notifications-' + restaurantId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'super_admin_notifications' }, ({ new: row }: { new: Record<string, unknown> }) => {
        const notif: SANotification = {
          id: row.id as string,
          restaurant_id: (row.restaurant_id as string | null) ?? null,
          title: row.title as string,
          body: row.body as string,
          created_at: row.created_at as string,
          read: false,
        };
        setToastQueue(prev => [...prev, notif]);
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, ready, gated, load]);

  const markAllRead = useCallback(async () => {
    if (gated) return;
    const unread = notifications.filter(n => !n.read);
    if (!unread.length || !restaurantId) return;
    await supabase.from('super_admin_notification_reads')
      .upsert(unread.map(n => ({ notification_id: n.id, restaurant_id: restaurantId })), { onConflict: 'notification_id,restaurant_id', ignoreDuplicates: true });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [notifications, restaurantId, gated]);

  const dismissToast = useCallback(() => {
    setToastQueue(prev => prev.slice(1));
  }, []);

  if (gated) {
    return (
      <SuperAdminNotificationsContext.Provider value={EMPTY_CTX}>
        {children}
      </SuperAdminNotificationsContext.Provider>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SuperAdminNotificationsContext.Provider value={{ notifications, notifLoading, unreadCount, toastQueue, markAllRead, dismissToast }}>
      {children}
    </SuperAdminNotificationsContext.Provider>
  );
}

export const useSuperAdminNotifications = () => useContext(SuperAdminNotificationsContext);
