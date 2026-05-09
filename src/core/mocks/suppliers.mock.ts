import type { Supplier } from '../../types/supplier';

export const MOCK_SUPPLIERS: Supplier[] = [
    {
        id: '1',
        name: 'Dairy Fresh Ltd',
        contact: 'John Smith',
        email: 'orders@dairyfresh.com',
        phone: '+1 234 567 8900',
        address: '123 Farm Road, Countryside',
        products: ['Milk', 'Cheese', 'Yogurt', 'Butter'],
        rating: 4.8,
        status: 'active'
    },
    {
        id: '2',
        name: 'Green Valley Farms',
        contact: 'Sarah Johnson',
        email: 'contact@greenvalley.com',
        phone: '+1 234 567 8901',
        address: '456 Valley Ave, Green Hills',
        products: ['Vegetables', 'Fruits', 'Herbs'],
        rating: 4.6,
        status: 'active'
    },
    {
        id: '3',
        name: 'Poultry Pro',
        contact: 'Mike Chen',
        email: 'sales@poultrypro.com',
        phone: '+1 234 567 8902',
        address: '789 Chicken Lane, Farmville',
        products: ['Chicken', 'Eggs', 'Turkey'],
        rating: 4.9,
        status: 'active'
    },
];
