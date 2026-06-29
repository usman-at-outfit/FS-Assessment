'use client';

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode,
} from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api, CartResponse } from '@/lib/api-client';

interface CartContextValue {
  cart:       CartResponse | null;
  itemCount:  number;
  loading:    boolean;
  addItem:    (productId: number, quantity: number) => Promise<void>;
  removeItem: (productId: number) => Promise<void>;
  refresh:    () => Promise<void>;
  clear:      () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [cart,    setCart]    = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) { setCart(null); return; }
    try {
      setLoading(true);
      const c = await api.withToken(token).get<CartResponse>('/cart');
      setCart(c);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Reload cart whenever auth changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(async (productId: number, quantity: number) => {
    if (!token) return;
    const updated = await api.withToken(token).post<CartResponse>('/cart/items', { productId, quantity });
    setCart(updated);
  }, [token]);

  const removeItem = useCallback(async (productId: number) => {
    if (!token) return;
    await api.withToken(token).delete(`/cart/items/${productId}`);
    setCart(prev => {
      if (!prev) return null;
      return { ...prev, items: prev.items.filter(i => i.productId !== productId) };
    });
  }, [token]);

  const clear = useCallback(() => setCart(null), []);

  const itemCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  return (
    <CartContext.Provider value={{ cart, itemCount, loading, addItem, removeItem, refresh, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
