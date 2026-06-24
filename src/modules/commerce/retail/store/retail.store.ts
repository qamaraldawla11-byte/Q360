import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RetailCartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

export interface RetailCustomer {
    id: string;
    name: string;
    email: string;
    phone: string;
    visits: number;
    totalSpent: number;
    createdAt: string;
}

export interface RetailSale {
    id: string;
    orderId: string;
    customerId?: string;
    itemCount: number;
    subtotal: number;
    tax: number;
    total: number;
    createdAt: string;
}

export interface RetailSettings {
    storeName: string;
    taxRate: number;
    currency: string;
    receiptFooter: string;
}

interface RetailState {
    cart: RetailCartItem[];
    customers: RetailCustomer[];
    sales: RetailSale[];
    settings: RetailSettings;
    addToCart: (product: Omit<RetailCartItem, 'quantity'>) => void;
    updateQuantity: (id: string, delta: number) => void;
    clearCart: () => void;
    addCustomer: (customer: Omit<RetailCustomer, 'id' | 'visits' | 'totalSpent' | 'createdAt'>) => void;
    recordSale: (sale: Omit<RetailSale, 'id' | 'createdAt'>) => void;
    updateSettings: (settings: Partial<RetailSettings>) => void;
}

const defaultCustomers: RetailCustomer[] = [
    {
        id: 'customer_walkin',
        name: 'Walk-in Customer',
        email: '',
        phone: '',
        visits: 0,
        totalSpent: 0,
        createdAt: new Date(0).toISOString(),
    },
];

export const useRetailStore = create<RetailState>()(
    persist(
        (set, get) => ({
            cart: [],
            customers: defaultCustomers,
            sales: [],
            settings: {
                storeName: 'Retail Store',
                taxRate: 10,
                currency: 'USD',
                receiptFooter: 'Thank you for shopping with us.',
            },
            addToCart: (product) => {
                const existing = get().cart.find(item => item.id === product.id);
                set({
                    cart: existing
                        ? get().cart.map(item => item.id === product.id
                            ? { ...item, quantity: item.quantity + 1 }
                            : item)
                        : [...get().cart, { ...product, quantity: 1 }],
                });
            },
            updateQuantity: (id, delta) => set({
                cart: get().cart
                    .map(item => item.id === id
                        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
                        : item)
                    .filter(item => item.quantity > 0),
            }),
            clearCart: () => set({ cart: [] }),
            addCustomer: (customer) => set({
                customers: [
                    ...get().customers,
                    {
                        ...customer,
                        id: `customer_${Date.now()}`,
                        visits: 0,
                        totalSpent: 0,
                        createdAt: new Date().toISOString(),
                    },
                ],
            }),
            recordSale: (sale) => {
                const recordedSale: RetailSale = {
                    ...sale,
                    id: `sale_${Date.now()}`,
                    createdAt: new Date().toISOString(),
                };
                set({
                    sales: [recordedSale, ...get().sales].slice(0, 250),
                    customers: get().customers.map(customer => customer.id === sale.customerId
                        ? {
                            ...customer,
                            visits: customer.visits + 1,
                            totalSpent: customer.totalSpent + sale.total,
                        }
                        : customer),
                });
            },
            updateSettings: (updates) => set({ settings: { ...get().settings, ...updates } }),
        }),
        {
            name: 'one-os-retail',
            partialize: state => ({
                customers: state.customers,
                sales: state.sales,
                settings: state.settings,
            }),
        },
    ),
);
