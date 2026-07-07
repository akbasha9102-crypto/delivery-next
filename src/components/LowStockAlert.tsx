'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRestaurant } from '@/context/RestaurantContext';
import { AlertTriangle, X } from 'lucide-react';

type LowStockItem = { id: string; name: string; unit: string; current_stock: number; min_alert_stock: number };

export function LowStockAlert() {
  const { restaurantId } = useRestaurant();
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const fetchLowStock = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, unit, current_stock, min_alert_stock')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true);
    setItems((data || []).filter(i => i.current_stock <= i.min_alert_stock));
  }, [restaurantId]);

  useEffect(() => { fetchLowStock(); }, [fetchLowStock]);

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`low-stock-alert-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items', filter: `restaurant_id=eq.${restaurantId}` }, () => fetchLowStock())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, fetchLowStock]);

  if (dismissed || items.length === 0) return null;

  const names = items.slice(0, 3).map(i => i.name).join('، ');
  const extra = items.length > 3 ? ` و${items.length - 3} غيرها` : '';

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-4 py-3 flex items-center gap-3" dir="rtl">
      <button onClick={() => setDismissed(true)} aria-label="إخفاء التنبيه"
        className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-all bg-red-100 dark:bg-red-900/40">
        <X size={14} className="text-red-500" />
      </button>
      <div className="flex-1 text-right min-w-0">
        <p className="font-bold text-sm text-red-600 dark:text-red-400">مخزون قارب على النفاد</p>
        <p className="text-xs text-red-500/80 dark:text-red-400/70 mt-0.5 truncate">{names}{extra}</p>
      </div>
      <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
    </div>
  );
}
