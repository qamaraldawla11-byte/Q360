import { create } from 'zustand';
import type { RestaurantState, MenuItem, Table } from './restaurant.types';

// Mock Initial Data
const INITIAL_CATEGORIES = ['Starters', 'Mains', 'Drinks', 'Desserts'];

const INITIAL_MENU: MenuItem[] = [
    { id: 'm1', name: 'Truffle Fries', price: 12, category: 'Starters', available: true, image: 'fries', station: 'kitchen' },
    { id: 'm2', name: 'Wagyu Burger', price: 24, category: 'Mains', available: true, image: 'burger', station: 'kitchen' },
    { id: 'm3', name: 'Caesar Salad', price: 16, category: 'Starters', available: true, station: 'kitchen' },
    { id: 'm4', name: 'Craft Cola', price: 6, category: 'Drinks', available: true, station: 'bar' },
];

const INITIAL_TABLES: Table[] = Array.from({ length: 12 }, (_, i) => ({
    id: `t-${i + 1}`,
    number: `${i + 1}`,
    capacity: i % 4 === 0 ? 6 : 4, // Mixed capacity
    status: 'free'
}));

export const useRestaurantStore = create<RestaurantState>((set) => ({
    menu: INITIAL_MENU,
    categories: INITIAL_CATEGORIES,
    orders: [],
    tables: INITIAL_TABLES,
    kitchenLoad: 'low',

    addMenuItem: (item) => set((state) => ({
        menu: [...state.menu, item]
    })),

    updateMenuItem: (id, updates) => set((state) => ({
        menu: state.menu.map(m => m.id === id ? { ...m, ...updates } : m)
    })),

    reorderCategories: (categories) => set(() => ({
        categories
    })),

    createOrder: (orderData) => set((state) => {
        const newOrder = {
            ...orderData,
            id: `ord-${Date.now()}`,
            createdAt: new Date(),
            status: 'new' as const
        };

        // If assigned to table, update table status
        let updatedTables = state.tables;
        if (orderData.tableId) {
            updatedTables = state.tables.map(t =>
                t.id === orderData.tableId
                    ? { ...t, status: 'occupied', currentOrderId: newOrder.id }
                    : t
            );
        }

        return {
            orders: [newOrder, ...state.orders],
            tables: updatedTables,
            kitchenLoad: state.orders.length > 5 ? 'high' : state.orders.length > 2 ? 'medium' : 'low'
        };
    }),

    updateOrderStatus: (orderId, status) => set((state) => {
        const updatedOrders = state.orders.map(o => o.id === orderId ? { ...o, status } : o);

        // Check if order is 'paid' or 'cancelled' to free up table
        let updatedTables = state.tables;
        if (status === 'paid' || status === 'cancelled') {
            const order = state.orders.find(o => o.id === orderId);
            if (order?.tableId) {
                updatedTables = state.tables.map(t =>
                    t.id === order.tableId ? { ...t, status: 'free', currentOrderId: undefined } : t
                );
            }
        }

        return { orders: updatedOrders, tables: updatedTables };
    }),

    updateTableStatus: (tableId, status) => set((state) => ({
        tables: state.tables.map(t => t.id === tableId ? { ...t, status } : t)
    }))
}));
