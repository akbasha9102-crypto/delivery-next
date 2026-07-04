'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRestaurant } from '@/context/RestaurantContext';

const STORAGE_KEY = 'admin_orders_seen_at';

type Ctx = { newCount: number; markSeen: () => void };
const NewOrdersContext = createContext<Ctx>({ newCount: 0, markSeen: () => {} });

export function NewOrdersProvider({ children }: { children: React.ReactNode }) {
  const { restaurantId } = useRestaurant();
  const [newCount, setNewCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!restaurantId) { setNewCount(0); return; }
    let seenAt = localStorage.getItem(STORAGE_KEY);
    if (!seenAt) {
      seenAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, seenAt);
    }
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .gt('created_at', seenAt);
    setNewCount(count || 0);
  }, [restaurantId]);

  const markSeen = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setNewCount(0);
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    fetchCount();
    const ch = supabase.channel('new-orders-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: 'restaurant_id=eq.' + restaurantId }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchCount, restaurantId]);

  return (
    <NewOrdersContext.Provider value={{ newCount, markSeen }}>
      {children}
    </NewOrdersContext.Provider>
  );
}

export const useNewOrders = () => useContext(NewOrdersContext);
