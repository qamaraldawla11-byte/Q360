import { http } from './http';

export type RestaurantTableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
export type RestaurantOrderStatus = 'pending' | 'in_kitchen' | 'ready' | 'delivered' | 'served' | 'collected' | 'closed' | 'paid' | 'cancelled';
export type RestaurantOrderType = 'dine_in' | 'takeaway';
export type RestaurantServiceStatus = 'pending' | 'in_kitchen' | 'ready' | 'delivered' | 'collected' | 'closed' | 'cancelled';
export type RestaurantPaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type RestaurantPaymentTiming = 'pay_before_service' | 'pay_after_service';
export type KdsStatus = 'new' | 'cooking' | 'done' | 'cancelled';
export type RestaurantPaymentMethod = 'cash' | 'card' | 'manual' | 'mobile';

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
    displayOrderNumber: string;
    visibleOrderNumber: number | null;
    orderNumberDate: string | null;
    tableId: string | null;
    status: RestaurantOrderStatus;
    orderType: RestaurantOrderType;
    serviceStatus: RestaurantServiceStatus;
    paymentStatus: RestaurantPaymentStatus;
    paymentTiming: RestaurantPaymentTiming;
    idempotencyKey: string | null;
    cancellationReason: string | null;
    cancelledBy: string | null;
    cancelledAt: string | null;
    createdBy: string;
    total: number;
    createdAt: string;
    updatedAt: string;
    items: RestaurantOrderItem[];
    payments?: RestaurantPayment[];
}

export interface KdsOrder {
    id: string;
    businessId: string;
    displayOrderNumber: string;
    tableId: string | null;
    orderType: RestaurantOrderType;
    serviceStatus: RestaurantServiceStatus;
    createdAt: string;
    updatedAt: string;
    items: RestaurantOrderItem[];
}

export interface KdsTicket {
    id: string;
    orderId: string;
    businessId: string;
    status: KdsStatus;
    createdAt: string;
    completedAt: string | null;
    tableLabel: string | null;
    order: KdsOrder | null;
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

    createMenuCategory: (payload: { name: string }) =>
        http.post<RestaurantMenuCategory>('/restaurant/menu/categories', payload),

    createMenuItem: (payload: {
        name: string;
        category_id: string;
        price: number;
        description?: string;
        prep_time_minutes?: number;
    }) => http.post<RestaurantMenuItem>('/restaurant/menu/items', payload),

    getTables: () => http.get<RestaurantTable[]>('/restaurant/tables'),

    createTable: (payload: { label: string; capacity: number }) =>
        http.post<RestaurantTable>('/restaurant/tables', payload),

    updateTableStatus: (id: string, status: RestaurantTableStatus) =>
        http.patch<RestaurantTable>(`/restaurant/tables/${id}/status`, { status }),

    createOrder: (payload: {
        table_id?: string;
        order_type?: RestaurantOrderType;
        payment_timing?: RestaurantPaymentTiming;
        idempotency_key?: string;
        items: { menu_item_id: string; quantity: number; notes?: string }[];
    }) => http.post<RestaurantOrder>('/restaurant/orders', payload),

    getOrders: (active = false) =>
        http.get<RestaurantOrder[]>(`/restaurant/orders${active ? '?status=active' : ''}`),

    updateOrderStatus: (id: string, status: RestaurantOrderStatus) =>
        http.patch<RestaurantOrder>(`/restaurant/orders/${id}/status`, { status }),

    markDelivered: (id: string) =>
        http.post<RestaurantOrder>(`/restaurant/orders/${id}/deliver`, {}),

    completePayment: (id: string, payload: { method: RestaurantPaymentMethod; amount: number }) =>
        http.post<RestaurantOrder>(`/restaurant/orders/${id}/payments`, payload),

    cancelOrder: (id: string, payload: { reason: string }) =>
        http.post<RestaurantOrder>(`/restaurant/orders/${id}/cancel`, payload),

    getKds: () => http.get<KdsTicket[]>('/restaurant/kds'),

    updateKdsStatus: (id: string, status: KdsStatus) =>
        http.patch<KdsTicket>(`/restaurant/kds/${id}/status`, { status }),
};
