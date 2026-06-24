import type { VerticalManifest } from '@/types/vertical';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Tag,
    Users,
    BarChart3,
    Settings,
    Truck,
    ShoppingCart as ProcurementIcon
} from 'lucide-react';

export const supermarketManifest: VerticalManifest = {
    id: 'supermarket',
    name: 'Supermarket OS',
    shortName: 'Supermarket',
    icon: ShoppingCart,
    color: '#3b82f6',
    basePath: '/app/supermarket',
    description: 'Comprehensive supermarket management with barcode POS, inventory, and offers.',

    modules: [
        { id: 'dashboard', label: 'Dashboard', path: '', icon: LayoutDashboard },
        { id: 'pos', label: 'Barcode POS', path: '/pos', icon: ShoppingCart },
        { id: 'catalog', label: 'Product Catalog', path: '/catalog', icon: Package },
        { id: 'inventory', label: 'Inventory', path: '/inventory', icon: Package },
        { id: 'procurement', label: 'Procurement', path: '/procurement', icon: ProcurementIcon },
        { id: 'suppliers', label: 'Suppliers', path: '/suppliers', icon: Truck },
        { id: 'offers', label: 'Offers & Pricing', path: '/offers', icon: Tag },
        { id: 'staff', label: 'Staff & Shifts', path: '/staff', icon: Users },
        { id: 'reports', label: 'Reports', path: '/reports', icon: BarChart3 },
        { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
    ],

    defaultModule: 'dashboard'
};
