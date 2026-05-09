import type { VerticalManifest } from '@/types/vertical';
import {
    LayoutDashboard,
    ShoppingBag,
    Package,
    Users,
    BarChart3,
    Settings,
    Tag
} from 'lucide-react';

export const retailManifest: VerticalManifest = {
    id: 'retail',
    name: 'Retail OS',
    shortName: 'Retail',
    icon: ShoppingBag,
    color: '#ec4899',
    basePath: '/app/retail',
    description: 'Point of sale, inventory, and customer management for retail stores.',

    modules: [
        { id: 'dashboard', label: 'Dashboard', path: '', icon: LayoutDashboard },
        { id: 'pos', label: 'Point of Sale', path: '/pos', icon: ShoppingBag },
        { id: 'catalog', label: 'Product Catalog', path: '/catalog', icon: Package },
        { id: 'inventory', label: 'Inventory', path: '/inventory', icon: Package },
        { id: 'pricing', label: 'Pricing & Discounts', path: '/pricing', icon: Tag },
        { id: 'customers', label: 'Customers', path: '/customers', icon: Users },
        { id: 'reports', label: 'Reports', path: '/reports', icon: BarChart3 },
        { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
    ],

    defaultModule: 'dashboard'
};
