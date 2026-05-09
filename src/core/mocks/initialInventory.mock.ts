import type { InventoryItem } from '@/types/inventory';

export const INITIAL_INVENTORY: InventoryItem[] = [
    { id: '1', name: 'Fresh Milk', current: 0, min: 20, max: 100, price: 2.99, supplier: 'Dairy Co', status: 'critical', unit: 'Cartons', barcode: '123456', category: 'Dairy' },
    { id: '2', name: 'Eggs (Dozen)', current: 50, min: 10, max: 80, price: 4.50, supplier: 'Farm Fresh', status: 'ok', unit: 'Cartons', barcode: '234567', category: 'Dairy' },
    { id: '3', name: 'Sourdough Bread', current: 5, min: 15, max: 40, price: 6.00, supplier: 'Bakery Inc', status: 'low', unit: 'Loaves', barcode: '345678', category: 'Bakery' },
    { id: '4', name: 'Tomatoes', current: 15, min: 25, unit: 'kg', status: 'low', supplier: 'Green Valley Farms', price: 3.50, barcode: '456789', category: 'Produce' },
    { id: '5', name: 'Chicken Breast', current: 45, min: 40, unit: 'kg', status: 'ok', supplier: 'Poultry Pro', price: 8.90, barcode: '567890', category: 'Meat' },
];
