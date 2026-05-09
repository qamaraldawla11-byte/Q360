import { create } from 'zustand';
import type { InventoryItem } from '@/types/inventory';

interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

interface SupermarketState {
    cart: CartItem[];
    inventory: InventoryItem[];
    addToCart: (product: Omit<CartItem, 'quantity'>) => void;
    removeFromCart: (id: string) => void;
    updateQuantity: (id: string, delta: number) => void;
    clearCart: () => void;
    setInventory: (items: InventoryItem[]) => void;
    updateStock: (id: string, delta: number) => void;
    total: number;
}

export const useSupermarketStore = create<SupermarketState>((set, get) => ({
    cart: [],
    inventory: [],
    addToCart: (product) => {
        const { cart } = get();
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            set({
                cart: cart.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            });
        } else {
            set({ cart: [...cart, { ...product, quantity: 1 }] });
        }
    },
    removeFromCart: (id) => {
        set({ cart: get().cart.filter(item => item.id !== id) });
    },
    updateQuantity: (id, delta) => {
        set({
            cart: get().cart
                .map(item =>
                    item.id === id
                        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
                        : item
                )
                .filter(item => item.quantity > 0)
        });
    },
    clearCart: () => set({ cart: [] }),
    setInventory: (items) => set({ inventory: items }),
    updateStock: (id, delta) => {
        set({
            inventory: get().inventory.map(item => {
                if (item.id === id) {
                    const newCurrent = Math.max(0, item.current + delta);
                    let status: InventoryItem['status'] = 'ok';
                    if (newCurrent <= item.min / 2) status = 'critical';
                    else if (newCurrent <= item.min) status = 'low';

                    return { ...item, current: newCurrent, status };
                }
                return item;
            })
        });
    },
    get total() {
        return get().cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }
}));
