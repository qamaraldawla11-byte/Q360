export interface Product {
    id: string;
    name: string;
    price: number;
    barcode: string;
}

export const MOCK_PRODUCTS: Product[] = [
    { id: '1', barcode: '123456', name: 'Fresh Milk (1L)', price: 2.50 },
    { id: '2', barcode: '234567', name: 'Bread - Whole Wheat', price: 1.80 },
    { id: '3', barcode: '345678', name: 'Eggs (Dozen)', price: 4.20 },
    { id: '4', barcode: '456789', name: 'Tomatoes (1kg)', price: 3.50 },
    { id: '5', barcode: '567890', name: 'Chicken Breast (1kg)', price: 8.90 },
    // Generic fallback for testing
    { id: '999', barcode: '999999', name: 'Generic Item', price: 10.00 }
];
