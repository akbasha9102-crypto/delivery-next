'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'admin_orders_seen_at';

type Ctx = { newCount: number; markSeen: () => void };
const NewOrdersContext = createContext<Ctx>({ newCount: 0, markSeen: () => {} });

export function NewOrdersProvider({ children }: { children: React.ReactNode }) {
  const [newCount, setNewCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (typeof window === 'undefined') return;
    let seenAt = localStorage.getItem(STORAGE_KEY);
    if (!seenAt) {
      seenAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, seenAt);
    }
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', seenAt);
    setNewCount(count || 0);
  }, []);

  const markSeen = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setNewCount(0);
  }, []);

  useEffect(() => {
    fetchCount();
    const ch = supabase.channel('new-orders-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchCount]);

  return (
    <NewOrdersContext.Provider value={{ newCount, markSeen }}>
      {children}
    </NewOrdersContext.Provider>
  );
}

export const useNewOrders = () => useContext(NewOrdersContext);
