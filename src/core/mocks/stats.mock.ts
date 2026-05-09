export interface DashboardStats {
    revenue: number;
    itemsSold: number;
    avgBasket: number;
    revenueTrend: number;
    itemsSoldTrend: number;
    avgBasketTrend: number;
    topSelling: { name: string; sold: number }[];
    expiring: { name: string; days: number }[];
}

export const MOCK_DASHBOARD_STATS: DashboardStats = {
    revenue: 18420,
    itemsSold: 1247,
    avgBasket: 24.80,
    revenueTrend: 15,
    itemsSoldTrend: 10,
    avgBasketTrend: 3,
    topSelling: [
        { name: 'Fresh Milk (1L)', sold: 150 },
        { name: 'Bread - Whole Wheat', sold: 130 },
        { name: 'Eggs (Dozen)', sold: 110 }
    ],
    expiring: [
        { name: 'Yogurt - Strawberry', days: 3 },
        { name: 'Fresh Juice', days: 2 },
        { name: 'Meat - Ground Beef', days: 1 }
    ]
};
