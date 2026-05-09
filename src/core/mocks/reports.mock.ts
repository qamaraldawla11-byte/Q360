export interface ReportStat {
    label: string;
    value: string;
}

export interface Report {
    title: string;
    description: string;
    iconName: 'DollarSign' | 'TrendingUp' | 'ShoppingCart' | 'BarChart3';
    color: string;
    stats: ReportStat[];
}

export const MOCK_REPORTS: Report[] = [
    {
        title: 'Sales Report',
        description: 'Daily, weekly, and monthly revenue breakdown',
        iconName: 'DollarSign',
        color: '#10b981',
        stats: [
            { label: 'Today', value: '$18,420' },
            { label: 'This Week', value: '$94,230' },
            { label: 'This Month', value: '$342,100' },
        ]
    },
    {
        title: 'Product Performance',
        description: 'Best sellers and slow movers analysis',
        iconName: 'TrendingUp',
        color: '#3b82f6',
        stats: [
            { label: 'Top Product', value: 'Fresh Milk' },
            { label: 'Units Sold', value: '1,247' },
            { label: 'Revenue', value: '$3,117' },
        ]
    },
    {
        title: 'Customer Analytics',
        description: 'Shopping patterns and basket analysis',
        iconName: 'ShoppingCart',
        color: '#f59e0b',
        stats: [
            { label: 'Avg. Basket', value: '$24.80' },
            { label: 'Transactions', value: '742' },
            { label: 'Repeat Rate', value: '68%' },
        ]
    },
    {
        title: 'Inventory Report',
        description: 'Stock levels, turnover, and expiry tracking',
        iconName: 'BarChart3',
        color: '#8b5cf6',
        stats: [
            { label: 'Total Items', value: '2,847' },
            { label: 'Low Stock', value: '23' },
            { label: 'Expiring Soon', value: '12' },
        ]
    },
];
