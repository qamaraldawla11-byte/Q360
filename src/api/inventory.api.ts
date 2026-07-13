import { http } from './http';

export interface InventoryItem { id:string; name:string; current:number; min:number; max:number|null; unit:string; category:string|null; status:'ok'|'low'|'critical'; supplier:string|null; price:number; businessId:string }
export interface Supplier { id:string; name:string; contact:string|null; phone:string|null; email:string|null; address:string|null; status:string|null }
export interface PurchaseOrder { id:string; supplierId:string|null; inventoryItemId:string; quantity:number; unitCost:number; status:'ordered'|'received'|'cancelled'; orderedAt:string; receivedAt:string|null }

export const inventoryApi = {
    items: () => http.get<InventoryItem[]>('/inventory'),
    createItem: (data:{name:string;current:number;min:number;max?:number;unit:string;category?:string;supplier?:string;price:number}) => http.post<InventoryItem>('/inventory',data),
    adjust: (id:string,delta:number,reason:string) => http.patch<InventoryItem>(`/inventory/${id}/stock`,{delta,reason}),
    suppliers: () => http.get<Supplier[]>('/suppliers'),
    createSupplier: (data:{name:string;contact?:string;phone?:string;email?:string;address?:string}) => http.post<Supplier>('/suppliers',data),
    updateSupplier: (id:string,data:{name?:string;contact?:string;phone?:string;email?:string;address?:string;status?:'active'|'inactive'}) => http.patch<Supplier>(`/suppliers/${id}`,data),
    purchaseOrders: () => http.get<PurchaseOrder[]>('/suppliers/procurement/orders'),
    createPurchaseOrder: (data:{itemId:string;supplierId?:string;quantity:number;unitCost:number}) => http.post<PurchaseOrder>('/suppliers/procurement/orders',data),
    receivePurchaseOrder: (id:string) => http.patch<PurchaseOrder & {newStock:number}>(`/suppliers/procurement/orders/${id}/receive`,{}),
};
