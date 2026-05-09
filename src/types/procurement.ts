export type POStatus = 'draft' | 'submitted' | 'accepted' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled';

export interface PurchaseOrderItem {
    id: string;
    productId: string;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
    // For pharmacy
    batchId?: string;
    expiryDate?: string;
}

export interface PurchaseOrder {
    id: string;
    buyerId: string;
    buyerName: string;
    supplierId: string;
    supplierName: string;
    status: POStatus;
    items: PurchaseOrderItem[];
    subtotal: number;
    tax: number;
    total: number;
    createdAt: string;
    updatedAt: string;
    expectedDelivery?: string;
    notes?: string;
}

export interface SupplierProduct {
    id: string;
    supplierId: string;
    name: string;
    description?: string;
    category: string;
    price: number;
    unit: string;
    minOrderQuantity: number;
    availableStock: number;
    // For pharmacy
    isControlled?: boolean;
}
