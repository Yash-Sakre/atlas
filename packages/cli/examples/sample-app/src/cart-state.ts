import { create } from 'zustand';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface CartState {
  items: CartItem[];
  total: number;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}

/**
 * useCartStore — Zustand store holding the shopping cart.
 */
export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  total: 0,
  addItem: (item) =>
    set((state) => {
      const items = [...state.items, item];
      return { items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
    }),
  removeItem: (id) =>
    set((state) => {
      const items = state.items.filter((i) => i.id !== id);
      return { items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
    }),
  clear: () => set({ items: [], total: 0 }),
}));
