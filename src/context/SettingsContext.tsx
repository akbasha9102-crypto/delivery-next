'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/context/RestaurantContext';

export type DaySchedule  = { enabled: boolean; open: string; close: string };
export type WeekSchedule = { auto: boolean; days: Record<string, DaySchedule> };

export type Settings = {
  id: string;
  restaurant_name: string;
  primary_color: string;
  logo_url: string | null;
  is_closed: boolean;
  opens_at: string | null;
  schedule: WeekSchedule | null;
  whatsapp_number: string | null;
  location_url: string | null;
  is_suspended?: boolean | null;
  subscription_tier?: 'standard' | 'professional' | null;
  delivery_fee: number;
  min_order_amount: number;
  coupon_code: string | null;
  coupon_discount_pct: number;
  coupon_enabled: boolean;
  coupon_allow_retroactive: boolean;
  show_best_sellers: boolean;
};

const DEFAULTS: Settings = {
  id: '',
  restaurant_name: '',
  primary_color: '#000000',
  logo_url: null,
  is_closed: false,
  opens_at: null,
  schedule: null,
  whatsapp_number: null,
  location_url: null,
  is_suspended: false,
  subscription_tier: 'professional',
  delivery_fee: 0,
  min_order_amount: 0,
  coupon_code: null,
  coupon_discount_pct: 0,
  coupon_enabled: false,
  coupon_allow_retroactive: false,
  show_best_sellers: true,
};

// مفتاح cache مرتبط بـ restaurant_id لعزل كل مطعم
function cacheKey(id: string | null) {
  return id ? `rs_settings_v2_${id}` : 'rs_settings_v2_default';
}

function readCache(id: string | null): Settings | null {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    return raw ? (JSON.parse(raw) as Settings) : null;
  } catch { return null; }
}

function writeCache(id: string | null, s: Settings) {
  try { localStorage.setItem(cacheKey(id), JSON.stringify(s)); } catch {}
}

type Ctx = Settings & { loaded: boolean; refreshSettings: () => Promise<void> };
const SettingsCtx = createContext<Ctx>({ ...DEFAULTS, loaded: false, refreshSettings: async () => {} });

function hexDarken(hex: string, amount = 0.18): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (c: number) => Math.max(0, Math.floor(c * (1 - amount))).toString(16).padStart(2, '0');
  return `#${d(r)}${d(g)}${d(b)}`;
}

function hexLighten(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const l = (c: number) => Math.min(255, Math.floor(c + (255 - c) * 0.85)).toString(16).padStart(2, '0');
  return `#${l(r)}${l(g)}${l(b)}`;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded,   setLoaded]   = useState(false);
  const { restaurantId } = useRestaurant();

  // للاستخدام اليدوي عبر refreshSettings فقط
  const fetchSettings = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('restaurant_settings')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .limit(1)
      .maybeSingle();
    if (data) {
      setSettings(data as Settings);
      writeCache(restaurantId, data as Settings);
    }
    setLoaded(true);
  }, [restaurantId]);

  useEffect(() => {
    let cancelled = false;

    // فقط نقرأ الـ cache إذا عندنا restaurantId محدد — نتجنب تحميل بيانات مطعم آخر
    if (restaurantId) {
      const cached = readCache(restaurantId);
      if (cached) { setSettings(cached); setLoaded(true); }
    }

    const run = async () => {
      if (!restaurantId) {
        // بدون restaurantId لا نجلب شيء — ننتظر حتى يُعيَّن
        setLoaded(true);
        return;
      }
      let q = supabase.from('restaurant_settings').select('*');
      q = q.eq('restaurant_id', restaurantId).limit(1) as typeof q;
      const { data } = await q.maybeSingle();
      if (cancelled) return;
      if (data) {
        setSettings(data as Settings);
        writeCache(restaurantId, data as Settings);
      }
      setLoaded(true);
    };

    run();

    if (!restaurantId) return;

    const channel = supabase
      .channel(`settings-live-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'restaurant_settings', filter: `restaurant_id=eq.${restaurantId}` },
        ({ new: row }) => {
          if (restaurantId && (row as { restaurant_id?: string }).restaurant_id !== restaurantId) return;
          setSettings(row as Settings);
          writeCache(restaurantId, row as Settings);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'restaurant_settings', filter: `restaurant_id=eq.${restaurantId}` },
        ({ new: row }) => {
          if (restaurantId && (row as { restaurant_id?: string }).restaurant_id !== restaurantId) return;
          setSettings(row as Settings);
          writeCache(restaurantId, row as Settings);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary',       settings.primary_color);
    root.style.setProperty('--primary-dark',  hexDarken(settings.primary_color));
    root.style.setProperty('--primary-text',  hexDarken(settings.primary_color, 0.4));
    root.style.setProperty('--primary-light', hexLighten(settings.primary_color));
  }, [settings.primary_color]);

  return (
    <SettingsCtx.Provider value={{ ...settings, loaded, refreshSettings: fetchSettings }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export const useSettings = () => useContext(SettingsCtx);
