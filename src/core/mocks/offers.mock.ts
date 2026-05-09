export interface Offer {
    id: string;
    name: string;
    type: 'percentage' | 'fixed' | 'bogo';
    value: number;
    products: string[];
    startDate: string;
    endDate: string;
    status: 'active' | 'scheduled' | 'expired';
}

export const MOCK_OFFERS: Offer[] = [
    {
        id: '1',
        name: 'Weekend Fresh Produce Sale',
        type: 'percentage',
        value: 20,
        products: ['Tomatoes', 'Lettuce', 'Carrots'],
        startDate: '2026-01-10',
        endDate: '2026-01-12',
        status: 'active'
    },
    {
        id: '2',
        name: 'Buy 1 Get 1 Dairy Special',
        type: 'bogo',
        value: 1,
        products: ['Milk (1L)', 'Yogurt'],
        startDate: '2026-01-08',
        endDate: '2026-01-15',
        status: 'active'
    },
    {
        id: '3',
        name: 'New Year Clearance',
        type: 'fixed',
        value: 5,
        products: ['Seasonal Items'],
        startDate: '2026-01-15',
        endDate: '2026-01-20',
        status: 'scheduled'
    },
    {
        id: '4',
        name: 'Christmas Holiday Special',
        type: 'percentage',
        value: 30,
        products: ['Holiday Items'],
        startDate: '2025-12-20',
        endDate: '2025-12-26',
        status: 'expired'
    },
];
