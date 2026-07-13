import type { VerticalManifest } from '@/types/vertical';
import {
    LayoutDashboard,
    UtensilsCrossed,
    ShoppingCart,
    ChefHat,
    LayoutGrid,
    Receipt,
    Users,
    BarChart3,
    Settings,
    Package,
    Blocks,
} from 'lucide-react';

export const restaurantManifest: VerticalManifest = {
    id: 'restaurant',
    name: 'Restaurant OS',
    shortName: 'Restaurant',
    icon: UtensilsCrossed,
    color: '#f97316',
    basePath: '/app/restaurant',
    description: 'Table management, kitchen display, menus, and orders.',

    modules: [
        { id: 'dashboard', label: 'Dashboard', path: '', icon: LayoutDashboard },
        { id: 'pos', label: 'POS / Cashier', path: '/pos', icon: ShoppingCart },
        { id: 'kitchen', label: 'Kitchen', path: '/kitchen', icon: ChefHat },
        { id: 'menu', label: 'Menu', path: '/menu', icon: UtensilsCrossed },
        { id: 'floor', label: 'Floor / Tables', path: '/floor', icon: LayoutGrid },
        { id: 'inventory', label: 'Inventory preview', path: '/inventory', icon: Package },
        { id: 'billing', label: 'Order History', path: '/billing', icon: Receipt },
        { id: 'staff', label: 'Staff preview', path: '/staff', icon: Users },
        { id: 'reports', label: 'Reports', path: '/reports', icon: BarChart3 },
        { id: 'modules', label: 'Modules', path: '/modules', icon: Blocks },
        { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
    ],

    defaultModule: 'dashboard'
};
