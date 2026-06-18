'use client';
import { createContext, useContext, useState } from 'react';

type CartItem = { id: string; name: string; price: number; image_url: string | null; quantity: number; extras_json?: string };
type Ctx = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  decrementItem: (id: string) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  restoreCart: (items: CartItem[]) => void;
  total: number;
};

const CartContext = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: Omit<CartItem, 'quantity'>) =>
    setItems(prev => {
      const ex = prev.find(i => i.id === item.id);
      if (ex) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });

  const decrementItem = (id: string) =>
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      if (item.quantity <= 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
    });

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const clearCart = () => setItems([]);
  const restoreCart = (newItems: CartItem[]) => setItems(newItems);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return <CartContext.Provider value={{ items, addItem, decrementItem, removeItem, clearCart, restoreCart, total }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart outside provider');
  return ctx;
}
