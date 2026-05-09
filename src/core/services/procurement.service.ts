import { http } from '@/api/http';
import { inventoryService } from './inventory.service';
import type { Supplier } from '@/types/supplier';

interface PurchaseOrderResponse {
    orderId: string;
    itemId: string;
    itemName: string;
    quantity: number;
    status: string;
    newStock: number;
}

class ProcurementService {
    async getSuppliers(): Promise<Supplier[]> {
        try {
            const suppliers = await http.get<Supplier[]>('/suppliers');
            return suppliers;
        } catch (error) {
            console.error('Failed to fetch suppliers:', error);
            throw error;
        }
    }

    async createPurchaseOrder(itemId: string, quantity: number): Promise<PurchaseOrderResponse> {
        try {
            const response = await http.post<PurchaseOrderResponse>('/suppliers/procurement/orders', {
                itemId,
                quantity
            });

            // Refresh inventory to reflect new stock
            await inventoryService.getInventory();

            return response;
        } catch (error) {
            console.error('Failed to create purchase order:', error);
            throw error;
        }
    }
}

export const procurementService = new ProcurementService();
