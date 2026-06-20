'use client';
import { createContext, useContext, useState, useCallback } from 'react';

type RestaurantCtxValue = {
  restaurantId: string | null;
  restaurantName: string | null;
  setRestaurant: (id: string | null, name?: string | null) => void;
};

const RestaurantCtx = createContext<RestaurantCtxValue>({
  restaurantId: null,
  restaurantName: null,
  setRestaurant: () => {},
});

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [restaurantId,   setRestaurantId]   = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);

  const setRestaurant = useCallback((id: string | null, name?: string | null) => {
    setRestaurantId(id);
    setRestaurantName(name ?? null);
  }, []);

  return (
    <RestaurantCtx.Provider value={{ restaurantId, restaurantName, setRestaurant }}>
      {children}
    </RestaurantCtx.Provider>
  );
}

export const useRestaurant = () => useContext(RestaurantCtx);
