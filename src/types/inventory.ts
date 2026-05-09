export interface InventoryItem {
    id: string;
    name: string;
    current: number;
    min: number;
    max?: number;
    unit: string;
    barcode?: string;
    category?: string;
    status: 'ok' | 'low' | 'critical';
    supplier?: string;
    price: number;
}
