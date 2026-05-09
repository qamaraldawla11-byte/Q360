export interface Supplier {
    id: string;
    name: string;
    contact: string;
    email: string;
    phone: string;
    address: string;
    products: string[];
    rating: number;
    status: 'active' | 'inactive';
}
