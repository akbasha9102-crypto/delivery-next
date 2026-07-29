'use client';
import { createContext, useContext, useState, useCallback } from 'react';

export type SubscriptionTier = 'standard' | 'professional';

type SetRestaurantOpts = {
  subscriptionTier?: SubscriptionTier | null;
  isSuperAdminPreview?: boolean;
};

type RestaurantCtxValue = {
  restaurantId: string | null;
  restaurantName: string | null;
  subscriptionTier: SubscriptionTier | null;
  isSuperAdminPreview: boolean;
  setRestaurant: (id: string | null, name?: string | null, opts?: SetRestaurantOpts) => void;
};

const RestaurantCtx = createContext<RestaurantCtxValue>({
  restaurantId: null,
  restaurantName: null,
  subscriptionTier: null,
  isSuperAdminPreview: false,
  setRestaurant: () => {},
});

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [restaurantId,   setRestaurantId]   = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [subscriptionTier,     setSubscriptionTier]     = useState<SubscriptionTier | null>(null);
  const [isSuperAdminPreview,  setIsSuperAdminPreview]  = useState(false);

  const setRestaurant = useCallback((id: string | null, name?: string | null, opts?: SetRestaurantOpts) => {
    setRestaurantId(id);
    setRestaurantName(name ?? null);
    setSubscriptionTier(opts?.subscriptionTier ?? null);
    setIsSuperAdminPreview(opts?.isSuperAdminPreview ?? false);
  }, []);

  return (
    <RestaurantCtx.Provider value={{ restaurantId, restaurantName, subscriptionTier, isSuperAdminPreview, setRestaurant }}>
      {children}
    </RestaurantCtx.Provider>
  );
}

export const useRestaurant = () => useContext(RestaurantCtx);
