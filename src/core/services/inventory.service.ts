import type { InventoryItem } from '@/types/inventory';
import { http } from '@/api/http';
import { useSupermarketStore } from '@/modules/commerce/supermarket/store/supermarket.store';

class InventoryService {
    async getInventory(): Promise<InventoryItem[]> {
        try {
            const items = await http.get<InventoryItem[]>('/inventory');
            useSupermarketStore.getState().setInventory(items);
            return items;
        } catch (error) {
            console.error('Failed to fetch inventory:', error);
            throw error;
        }
    }

    async updateStock(id: string, delta: number): Promise<InventoryItem> {
        try {
            const updatedItem = await http.patch<InventoryItem>(`/inventory/${id}/stock`, { delta });
            // Refresh the inventory in store
            await this.getInventory();
            return updatedItem;
        } catch (error) {
            console.error('Failed to update stock:', error);
            throw error;
        }
    }

    async createItem(input: Omit<InventoryItem, 'id' | 'status'>): Promise<InventoryItem> {
        const createdItem = await http.post<InventoryItem>('/inventory', input);
        await this.getInventory();
        return createdItem;
    }
}

export const inventoryService = new InventoryService();
