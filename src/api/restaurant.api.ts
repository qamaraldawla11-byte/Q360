import { http } from './http';

export type RestaurantTableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
export type RestaurantOrderStatus = 'pending' | 'in_kitchen' | 'ready' | 'delivered' | 'served' | 'collected' | 'closed' | 'paid' | 'cancelled';
export type RestaurantOrderType = 'dine_in' | 'takeaway' | 'delivery';
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
    imageUrl: string | null;
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

export interface RestaurantIntegratedPaymentSummary {
    id: string;
    method: RestaurantPaymentMethod;
    amount: number;
    status: 'completed' | 'refunded';
    paidAt: string | null;
    cashReceived?: number;
    changeDue?: number;
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
    customerId: string | null;
    customerName: string | null;
    customerPhone: string | null;
    deliveryAddress: string | null;
    deliveryNotes: string | null;
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
    customerName: string | null;
    customerPhone: string | null;
    deliveryAddress: string | null;
    deliveryNotes: string | null;
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

export interface RestaurantPayNowOrderResult {
    order: RestaurantOrder;
    payment: RestaurantIntegratedPaymentSummary;
    kitchen: {
        ticket: KdsTicket | null;
    };
    visibleOrderNumber: number | null;
    displayOrderNumber: string;
    nextAction: 'sent_to_kitchen';
}

export interface RestaurantDashboard {
    total_revenue_today: number;
    active_orders_count: number;
    avg_prep_time_minutes: number;
    live_diners_count: number;
}

export interface RestaurantRangeReport { from:string;to:string;summary:{totalOrders:number;paidOrders:number;openOrders:number;cancelledOrders:number;paidRevenueCents:number;averagePaidOrderCents:number};serviceBreakdown:{dineIn:number;takeaway:number;delivery:number};statusBreakdown:Record<string,number>;paymentBreakdown:{method:string;count:number;amountCents:number}[];topItems:{name:string;quantity:number;revenueCents:number}[];dailySales:{date:string;orders:number;revenueCents:number}[];recentOrders:{id:string;displayOrderNumber:string;orderType:RestaurantOrderType;status:RestaurantOrderStatus;paymentStatus:RestaurantPaymentStatus;total:number;createdAt:string}[] }

export interface RestaurantQEvidenceCard {
    id: string;
    type: 'kds_ticket' | 'order' | 'table' | 'payment' | 'menu_item' | 'daily_summary';
    label: string;
    facts: string[];
    sourceIds: string[];
    freshness: { generatedAt: string; dataWindowStart: string | null; dataWindowEnd: string | null };
}

export type RestaurantBookingStatus = 'pending' | 'confirmed' | 'arrived' | 'seated' | 'completed' | 'cancelled' | 'no_show';
export interface RestaurantBooking {
    id: string;
    businessId: string;
    customerId: string | null;
    customerName: string;
    customerPhone: string | null;
    partySize: number;
    startsAt: string;
    endsAt: string;
    tableIds: string[];
    status: RestaurantBookingStatus;
    occasion: string | null;
    notes: string | null;
    depositAmount: number;
    createdAt: string;
    updatedAt: string;
}

export interface RestaurantQUsage {
    periodStart: string;
    requests: number;
    completed: number;
    failed: number;
    estimatedCostUsd: number;
    tokens: number;
    modelRequests: number;
    fallbacks: number;
    monthlyBudgetUsd: number;
    budgetRemainingUsd: number;
    model: string;
    modelEnabled: boolean;
    byFeature: Record<string, number>;
}

export interface RestaurantQBusinessBriefing {
    businessName: string;
    country: string | null;
    city: string | null;
    currency: string;
    timezone: string;
    restaurantService: 'dine_in' | 'takeaway' | 'both';
    tableCount: number;
    seatCount: number;
    activeMenuItemCount: number;
    lowStockCount: number;
    upcomingBookingCount: number;
    ownerSummary: string | null;
    businessGoals: string | null;
    operatingPriorities: RestaurantQOperatingPriority[];
    memoryUpdatedAt: string | null;
    generatedAt: string;
}

export type RestaurantQOperatingPriority = 'service_speed' | 'guest_experience' | 'cost_control' | 'sales_growth' | 'waste_reduction' | 'team_development';

export interface RestaurantQBusinessMemory {
    ownerSummary: string | null;
    businessGoals: string | null;
    operatingPriorities: RestaurantQOperatingPriority[];
    updatedAt: string | null;
}

export interface RestaurantQProviderStatus {
    mode: 'rules_only' | 'model_active' | 'budget_reached';
    provider: 'openai' | 'kimi' | 'q360-rules-v1';
    model: string;
    configured: boolean;
    externalModelEnabled: boolean;
    externalModelRequested: boolean;
    monthlyBudgetUsd: number;
    estimatedSpendUsd: number;
    budgetRemainingUsd: number;
    message: string;
}

export interface RestaurantQPulse {
    requestId: string;
    summary: string;
    insights: Array<{
        id: string;
        severity: 'info' | 'attention' | 'urgent';
        title: string;
        recommendation: string;
        evidenceIds: string[];
        allowedActions: Array<'prepare_draft'>;
    }>;
    evidenceCards: RestaurantQEvidenceCard[];
    drafts: [];
    generatedAt: string;
}

export interface RestaurantQDraft {
    id: string;
    type: 'daily_report' | 'manager_task' | 'booking_brief' | 'purchase_review';
    title: string;
    body: string;
    evidenceIds: string[];
    status: 'pending' | 'approved' | 'rejected';
    ownerEditedBody?: string | null;
    approvalNote?: string | null;
    createdAt?: string;
    reviewedAt?: string | null;
    requiresApproval?: boolean;
}

export interface RestaurantQConversation {
    id: string;
    title: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface RestaurantQChatMessage {
    id: string;
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    evidenceCards: Array<Pick<RestaurantQEvidenceCard, 'id' | 'label' | 'facts'>>;
    feedback: 'helpful' | 'not_helpful' | null;
    createdAt: string;
}

export interface RestaurantDailyReportOrder {
    id: string;
    displayOrderNumber: string;
    orderType: RestaurantOrderType;
    serviceStatus: RestaurantServiceStatus;
    paymentStatus: RestaurantPaymentStatus;
    paymentTiming: RestaurantPaymentTiming;
    status: RestaurantOrderStatus;
    total: number;
    createdAt: string;
    payments: RestaurantPayment[];
    items: RestaurantOrderItem[];
}

export interface RestaurantDailyReport {
    date: string;
    summary: {
        totalOrders: number;
        paidOrders: number;
        unpaidOpenOrders: number;
        paidRevenueCents: number;
        dineInOrders: number;
        takeawayOrders: number;
    };
    statusBreakdown: Record<string, number>;
    recentOrders: RestaurantDailyReportOrder[];
}

export const restaurantApi = {
    getDashboard: () => http.get<RestaurantDashboard>('/restaurant/dashboard'),

    getBusinessPulse: () => http.get<RestaurantQPulse>('/restaurant/business-pulse'),
    // Q AI calls can wait up to ~30s server-side for the model before falling
    // back to rules; allow that window plus overhead (client default is 10s).
    askBusinessPulse: (prompt: string) => http.post<RestaurantQPulse>('/restaurant/business-pulse/ask', { prompt }, { timeout: 45_000 }),
    getQBusinessBriefing: () => http.get<{ briefing: RestaurantQBusinessBriefing }>('/restaurant/q/briefing'),
    getQBusinessMemory: () => http.get<{ memory: RestaurantQBusinessMemory }>('/restaurant/q/memory'),
    updateQBusinessMemory: (payload: Omit<RestaurantQBusinessMemory, 'updatedAt'>) => http.put<{ memory: RestaurantQBusinessMemory; message: string }>('/restaurant/q/memory', payload),
    getQProviderStatus: () => http.get<{ periodStart: string; provider: RestaurantQProviderStatus }>('/restaurant/q/provider-status'),
    getQConversations: () => http.get<{ conversations: RestaurantQConversation[] }>('/restaurant/q/conversations'),
    getQConversation: (id: string) => http.get<{ conversation: RestaurantQConversation; messages: RestaurantQChatMessage[] }>(`/restaurant/q/conversations/${id}`),
    createQConversation: (prompt: string) => http.post<{ conversation: RestaurantQConversation; messages: RestaurantQChatMessage[] }>('/restaurant/q/conversations', { prompt }, { timeout: 45_000 }),
    sendQMessage: (id: string, prompt: string) => http.post<{ messages: RestaurantQChatMessage[] }>(`/restaurant/q/conversations/${id}/messages`, { prompt }, { timeout: 45_000 }),
    giveQMessageFeedback: (id: string, feedback: 'helpful' | 'not_helpful') => http.patch<{ message: RestaurantQChatMessage }>(`/restaurant/q/messages/${id}/feedback`, { feedback }),
    getQDrafts: () => http.get<{ drafts: RestaurantQDraft[] }>('/restaurant/business-pulse/drafts'),
    getQUsage: () => http.get<RestaurantQUsage>('/restaurant/business-pulse/usage'),
    createQDraft: (type: RestaurantQDraft['type']) =>
        http.post<{ draft: RestaurantQDraft }>('/restaurant/business-pulse/drafts', { type }),
    decideQDraft: (id: string, payload: { decision: 'approve' | 'reject'; ownerEditedBody?: string; approvalNote?: string }) =>
        http.post<{ draft: RestaurantQDraft; dispatched: false; message: string }>(`/restaurant/business-pulse/drafts/${id}/decision`, payload),

    getDailyReport: (date: string) =>
        http.get<RestaurantDailyReport>(`/restaurant/reports/daily?date=${encodeURIComponent(date)}`),
    getRangeReport: (from:string,to:string) => http.get<RestaurantRangeReport>(`/restaurant/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

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

    updateMenuCategory: (id: string, payload: { name: string }) =>
        http.patch<RestaurantMenuCategory>(`/restaurant/menu/categories/${id}`, payload),

    deleteMenuCategory: (id: string) =>
        http.delete<{ deleted: true }>(`/restaurant/menu/categories/${id}`),

    updateMenuItem: (id: string, payload: {
        name?: string; description?: string; price?: number; categoryId?: string;
        isAvailable?: boolean; prepTimeMinutes?: number; imageUrl?: string;
    }) => http.patch<RestaurantMenuItem>(`/restaurant/menu/items/${id}`, payload),

    uploadMenuItemImage: (id: string, image: File) => {
        const form = new FormData();
        form.append('image', image);
        return http.post<RestaurantMenuItem>(`/restaurant/menu/items/${id}/image`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    getTables: () => http.get<RestaurantTable[]>('/restaurant/tables'),

    getBookings: (from?: string, to?: string) => {
        const query = new URLSearchParams();
        if (from) query.set('from', from);
        if (to) query.set('to', to);
        const suffix = query.size ? `?${query.toString()}` : '';
        return http.get<RestaurantBooking[]>(`/restaurant/bookings${suffix}`);
    },

    createBooking: (payload: {
        customerName: string; customerPhone?: string; customerId?: string; partySize: number;
        startsAt: string; endsAt: string; tableIds: string[]; occasion?: string; notes?: string; depositAmount?: number;
    }) => http.post<RestaurantBooking>('/restaurant/bookings', payload),

    updateBooking: (id: string, payload: { status?: RestaurantBookingStatus; notes?: string; occasion?: string; depositAmount?: number }) =>
        http.patch<RestaurantBooking>(`/restaurant/bookings/${id}`, payload),

    createTable: (payload: { label: string; capacity: number }) =>
        http.post<RestaurantTable>('/restaurant/tables', payload),

    updateTableStatus: (id: string, status: RestaurantTableStatus) =>
        http.patch<RestaurantTable>(`/restaurant/tables/${id}/status`, { status }),

    createOrder: (payload: {
        table_id?: string;
        order_type?: RestaurantOrderType;
        payment_timing?: RestaurantPaymentTiming;
        customer_id?: string;
        customer_name?: string;
        customer_phone?: string;
        delivery_address?: string;
        delivery_notes?: string;
        idempotency_key?: string;
        items: { menu_item_id: string; quantity: number; notes?: string }[];
    }, options?: { correlationId?: string }) => http.post<RestaurantOrder>('/restaurant/orders', payload, {
        headers: options?.correlationId ? { 'X-Q360-Correlation-Id': options.correlationId } : undefined,
    }),

    createPayNowOrder: (payload: {
        order_type?: 'takeaway' | 'delivery';
        payment_method: Exclude<RestaurantPaymentMethod, 'mobile'>;
        cash_received?: number;
        customer_id?: string;
        customer_name?: string;
        customer_phone?: string;
        delivery_address?: string;
        delivery_notes?: string;
        idempotency_key?: string;
        items: { menu_item_id: string; quantity: number; notes?: string }[];
    }, options?: { correlationId?: string }) => http.post<RestaurantPayNowOrderResult>('/restaurant/orders/pay-now', payload, {
        headers: options?.correlationId ? { 'X-Q360-Correlation-Id': options.correlationId } : undefined,
    }),

    createPayNowTakeawayOrder: (payload: {
        payment_method: Exclude<RestaurantPaymentMethod, 'mobile'>; cash_received?: number; idempotency_key?: string;
        items: { menu_item_id: string; quantity: number; notes?: string }[];
    }, options?: { correlationId?: string }) => restaurantApi.createPayNowOrder({ ...payload, order_type: 'takeaway' }, options),

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

    getKds: (options?: { correlationId?: string }) => http.get<KdsTicket[]>('/restaurant/kds', {
        headers: options?.correlationId ? { 'X-Q360-Correlation-Id': options.correlationId } : undefined,
    }),

    updateKdsStatus: (id: string, status: KdsStatus) =>
        http.patch<KdsTicket>(`/restaurant/kds/${id}/status`, { status }),
};
