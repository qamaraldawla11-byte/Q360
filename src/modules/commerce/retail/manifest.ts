import type { VerticalManifest } from '@/types/vertical';
import {
    Boxes,
    Contact,
    FileText,
    FileBarChart,
    LayoutDashboard,
    Package,
    Settings,
    ShoppingBag,
    ShoppingCart
} from 'lucide-react';

export const retailManifest: VerticalManifest = {
    id: 'retail',
    name: 'Retail OS',
    shortName: 'Retail',
    icon: ShoppingBag,
    color: '#8b5cf6',
    basePath: '/app/retail',
    description: 'Point of sale, inventory, and customer management for retail stores.',

    modules: [
        { id: 'dashboard', label: 'Dashboard', path: '', icon: LayoutDashboard },
        { id: 'pos', label: 'Point of Sale', path: '/pos', icon: ShoppingBag },
        { id: 'catalog', label: 'Product Catalog', path: '/catalog', icon: Package },
        { id: 'inventory', label: 'Inventory', path: '/inventory', icon: Boxes },
        { id: 'customers', label: 'Customers', path: '/customers', icon: Contact },
        { id: 'quotes', label: 'Quotes', path: '/quotes', icon: FileText },
        { id: 'procurement', label: 'Procurement', path: '/procurement', icon: ShoppingCart },
        { id: 'reports', label: 'Reports', path: '/reports', icon: FileBarChart },
        { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
    ],

    defaultModule: 'dashboard'
};
