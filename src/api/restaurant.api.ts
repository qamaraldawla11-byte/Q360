import { http } from './http';

export type RestaurantTableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
export type RestaurantOrderStatus = 'pending' | 'in_kitchen' | 'ready' | 'served' | 'paid' | 'cancelled';
export type KdsStatus = 'new' | 'cooking' | 'done';
export type RestaurantPaymentMethod = 'cash' | 'card' | 'mobile';

export interface RestaurantMenuItem {
    id: string;
    businessId: string;
    categoryId: string;
    name: string;
    description: string | null;
    price: number;
    isAvailable: boolean;
    prepTimeMinutes: number;
}

export interface RestaurantMenuCategory {
    id: string;
    name: string;
    items: RestaurantMenuItem[];
}

export interface RestaurantTable {
    id: string;
    businessId: string;
    label: string;
    capacity: number;
    status: RestaurantTableStatus;
}

export interface RestaurantOrderItem {
    id: string;
    orderId: string;
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    notes: string | null;
    status: 'pending' | 'cooking' | 'done';
}

export interface RestaurantPayment {
    id: string;
    businessId: string;
    orderId: string;
    method: RestaurantPaymentMethod;
    amount: number;
    status: 'completed' | 'refunded';
    paidAt: string | null;
}

export interface RestaurantOrder {
    id: string;
    businessId: string;
    tableId: string | null;
    status: RestaurantOrderStatus;
    createdBy: string;
    total: number;
    createdAt: string;
    updatedAt: string;
    items: RestaurantOrderItem[];
    payments?: RestaurantPayment[];
}

export interface KdsTicket {
    id: string;
    orderId: string;
    businessId: string;
    status: KdsStatus;
    createdAt: string;
    completedAt: string | null;
    tableLabel: string | null;
    order: RestaurantOrder | null;
}

export interface RestaurantDashboard {
    total_revenue_today: number;
    active_orders_count: number;
    avg_prep_time_minutes: number;
    live_diners_count: number;
}

export const restaurantApi = {
    getDashboard: () => http.get<RestaurantDashboard>('/restaurant/dashboard'),

    getMenu: () => http.get<{ categories: RestaurantMenuCategory[] }>('/restaurant/menu'),

    createMenuItem: (payload: {
        name: string;
        category_id: string;
        price: number;
        description?: string;
        prep_time_minutes?: number;
    }) => http.post<RestaurantMenuItem>('/restaurant/menu/items', payload),

    getTables: () => http.get<RestaurantTable[]>('/restaurant/tables'),

    updateTableStatus: (id: string, status: RestaurantTableStatus) =>
        http.patch<RestaurantTable>(`/restaurant/tables/${id}/status`, { status }),

    createOrder: (payload: {
        table_id?: string;
        items: { menu_item_id: string; quantity: number; notes?: string }[];
    }) => http.post<RestaurantOrder>('/restaurant/orders', payload),

    getOrders: (active = false) =>
        http.get<RestaurantOrder[]>(`/restaurant/orders${active ? '?status=active' : ''}`),

    updateOrderStatus: (id: string, status: RestaurantOrderStatus) =>
        http.patch<RestaurantOrder>(`/restaurant/orders/${id}/status`, { status }),

    completePayment: (id: string, payload: { method: RestaurantPaymentMethod; amount: number }) =>
        http.post<RestaurantOrder>(`/restaurant/orders/${id}/payments`, payload),

    getKds: () => http.get<KdsTicket[]>('/restaurant/kds'),

    updateKdsStatus: (id: string, status: KdsStatus) =>
        http.patch<KdsTicket>(`/restaurant/kds/${id}/status`, { status }),
};
