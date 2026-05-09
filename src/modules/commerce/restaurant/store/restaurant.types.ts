export type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';
export type TableStatus = 'free' | 'occupied' | 'reserved' | 'cleaning';

export interface ModifierOption {
    id: string;
    name: string;
    priceDelta: number;
}

export interface ModifierGroup {
    id: string;
    name: string; // e.g., "Size", "Add-ons"
    required: boolean;
    options: ModifierOption[];
}

export interface MenuItem {
    id: string;
    name: string;
    price: number;
    category: string;
    image?: string;
    available: boolean;
    station?: 'kitchen' | 'bar' | 'coffee' | 'finish';
    modifiers?: ModifierGroup[];
    description?: string;
}

export interface OrderItem extends MenuItem {
    quantity: number;
    notes?: string;
    selectedModifiers?: { groupId: string; optionId: string }[];
}

export interface Order {
    id: string;
    tableId?: string;
    items: OrderItem[];
    status: OrderStatus;
    total: number;
    createdAt: Date;
    type: 'dine-in' | 'takeaway';
}

export interface Table {
    id: string;
    number: string;
    capacity: number;
    status: TableStatus;
    currentOrderId?: string;
}

export interface RestaurantState {
    // Data
    menu: MenuItem[];
    categories: string[];
    orders: Order[];
    tables: Table[];

    // Kitchen Metrics (Derived/Mocked for MVP)
    kitchenLoad: 'low' | 'medium' | 'high';

    // Actions
    addMenuItem: (item: MenuItem) => void;
    updateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
    reorderCategories: (categories: string[]) => void;

    createOrder: (order: Omit<Order, 'id' | 'createdAt' | 'status'>) => void;
    updateOrderStatus: (orderId: string, status: OrderStatus) => void;

    updateTableStatus: (tableId: string, status: TableStatus) => void;
}
