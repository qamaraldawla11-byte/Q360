import { http } from '@/api/http';
import { useSupermarketStore } from '@/modules/commerce/supermarket/store/supermarket.store';
import { inventoryService } from './inventory.service';

export interface Product {
    id: string;
    name: string;
    barcode: string;
    price: number;
    category?: string;
}

interface OrderResponse {
    orderId: string;
    subtotal: number;
    tax: number;
    total: number;
}

class OrdersService {
    async findProduct(barcode: string): Promise<Product | null> {
        try {
            const product = await http.get<Product | null>(`/products/search?barcode=${barcode}`);
            return product;
        } catch (error) {
            console.error('Failed to find product:', error);
            return null;
        }
    }

    async processSale(cart: { id: string; name: string; price: number; quantity: number }[]): Promise<OrderResponse> {
        try {
            const response = await http.post<OrderResponse>('/orders', { items: cart });

            // Clear cart after successful sale
            useSupermarketStore.getState().clearCart();

            // Refresh inventory to reflect deducted stock
            await inventoryService.getInventory();

            return response;
        } catch (error) {
            console.error('Failed to process sale:', error);
            throw error;
        }
    }
}

export const ordersService = new OrdersService();
