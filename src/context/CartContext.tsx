'use client';
import { createContext, useContext, useState, useEffect } from 'react';

// ── نوع العناصر ─────────────────────────────────────────────────────────────
// عند تغيير هذا النوع يجب رفع رقم CART_VERSION بمقدار 1
// حتى تُهمَل البيانات القديمة بدلاً من قراءة بيانات بشكل غلط.
const CART_VERSION = 2;
const CART_KEY = `cart_v${CART_VERSION}`;
const CART_RESTAURANT_KEY = `cart_restaurant_v${CART_VERSION}`;
const ORDER_TYPE_KEY = 'order_type_v1';

export type OrderType = 'delivery' | 'pickup';

type CartItem = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
  extras_json?: string;
  selected_extras_names?: string[];
};

type Ctx = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  decrementItem: (id: string) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  restoreCart: (items: CartItem[]) => void;
  total: number;
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  ensureRestaurant: (restaurantId: string) => boolean;
};

// ── حارس نوع: يتحقق من صحة كل عنصر مقروء من localStorage ─────────────────
function isValidCartItem(v: unknown): v is CartItem {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.price === 'number' &&
    typeof obj.quantity === 'number' &&
    obj.quantity > 0 &&
    (obj.image_url === null || typeof obj.image_url === 'string') &&
    (obj.extras_json === undefined || typeof obj.extras_json === 'string')
  );
}

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // نُبقي فقط العناصر الصالحة — الحماية من تغييرات مستقبلية في CartItem
    return parsed.filter(isValidCartItem);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    // QuotaExceededError — نتجاهله بصمت
  }
}

function readOrderType(): OrderType {
  if (typeof window === 'undefined') return 'delivery';
  const v = localStorage.getItem(ORDER_TYPE_KEY);
  return v === 'pickup' || v === 'delivery' ? v : 'delivery';
}

function readCartRestaurant(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CART_RESTAURANT_KEY);
}

function writeCartRestaurant(restaurantId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_RESTAURANT_KEY, restaurantId);
  } catch {
    // تجاهل بصمت
  }
}

// ── Provider ────────────────────────────────────────────────────────────────
const CartContext = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  // نُهيّئ الحالة من localStorage مباشرة (تجنّب flash of empty cart)
  const [items, setItems] = useState<CartItem[]>(() => readCart());
  const [orderType, setOrderTypeState] = useState<OrderType>(() => readOrderType());

  // كلما تغيّرت items نكتب في localStorage
  useEffect(() => {
    writeCart(items);
  }, [items]);

  const setOrderType = (type: OrderType) => {
    setOrderTypeState(type);
    if (typeof window !== 'undefined') localStorage.setItem(ORDER_TYPE_KEY, type);
  };

  const addItem = (item: Omit<CartItem, 'quantity'>) =>
    setItems(prev => {
      const ex = prev.find(i => i.id === item.id);
      // عند إضافة نفس الصنف مرة أخرى، نحدّث السعر/الإضافات لآخر اختيار بدل تجاهله
      // بصمت — كان هذا يُفقد أي إضافة جديدة يختارها الزبون (خطأ #1 بتقرير الفحص).
      if (ex) return prev.map(i => i.id === item.id
        ? { ...i, quantity: i.quantity + 1, price: item.price, extras_json: item.extras_json, selected_extras_names: item.selected_extras_names }
        : i);
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
  const clearCart  = () => setItems([]);
  const restoreCart = (newItems: CartItem[]) => setItems(newItems);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  // يتحقق من أن السلة الحالية تخص نفس المطعم — إن اختلف المطعم وفيه عناصر بالسلة
  // يفرّغها تلقائياً ويرجع true (تم التفريغ)، وإلا يحدّث المطعم المخزَّن ويرجع false.
  const ensureRestaurant = (restaurantId: string): boolean => {
    const stored = readCartRestaurant();
    if (stored && stored !== restaurantId) {
      writeCartRestaurant(restaurantId);
      if (items.length > 0) {
        setItems([]);
        return true;
      }
      return false;
    }
    writeCartRestaurant(restaurantId);
    return false;
  };

  return (
    <CartContext.Provider value={{ items, addItem, decrementItem, removeItem, clearCart, restoreCart, total, orderType, setOrderType, ensureRestaurant }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
