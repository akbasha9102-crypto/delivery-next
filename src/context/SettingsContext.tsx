'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type Settings = {
  id: string;
  restaurant_name: string;
  primary_color: string;
  logo_url: string | null;
};

const DEFAULTS: Settings = {
  id: '',
  restaurant_name: 'CulinaShare',
  primary_color: '#e67e22',
  logo_url: null,
};

const Ctx = createContext<Settings>(DEFAULTS);

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

  useEffect(() => {
    supabase.from('restaurant_settings').select('*').maybeSingle().then(({ data }) => {
      if (data) setSettings(data);
    });

    const channel = supabase
      .channel('settings-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurant_settings' }, ({ new: row }) => {
        setSettings(row as Settings);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary',       settings.primary_color);
    root.style.setProperty('--primary-dark',  hexDarken(settings.primary_color));
    root.style.setProperty('--primary-text',  hexDarken(settings.primary_color, 0.4));
    root.style.setProperty('--primary-light', hexLighten(settings.primary_color));
  }, [settings.primary_color]);

  return <Ctx.Provider value={settings}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
