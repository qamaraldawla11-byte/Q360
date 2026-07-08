import { http } from './http';

export interface Customer {
    id: string;
    businessId: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    companyName?: string | null;
    address?: string | null;
    notes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface CreateCustomerInput {
    name: string;
    phone?: string;
    email?: string;
    companyName?: string;
    address?: string;
    notes?: string;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export const customersApi = {
    list: () => http.get<Customer[]>('/customers'),
    create: (input: CreateCustomerInput) => http.post<Customer>('/customers', input),
    get: (id: string) => http.get<Customer>(`/customers/${id}`),
    update: (id: string, input: UpdateCustomerInput) => http.patch<Customer>(`/customers/${id}`, input),
};
