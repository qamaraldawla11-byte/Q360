import type { VerticalManifest } from '@/types/vertical';
import {
    LayoutDashboard,
    Package,
    Users,
    BarChart3,
    Settings,
    Truck,
    ClipboardList,
} from 'lucide-react';

export const supplierManifest: VerticalManifest = {
    id: 'supplier',
    name: 'Supplier OS',
    shortName: 'Supplier',
    icon: Truck,
    color: '#6366f1',
    basePath: '/app/supplier',
    description: 'B2B distribution and order management system for distributors and wholesalers.',

    modules: [
        { id: 'dashboard', label: 'Dashboard', path: '', icon: LayoutDashboard },
        { id: 'orders', label: 'Orders Management', path: '/orders', icon: ClipboardList },
        { id: 'products', label: 'Product Catalog', path: '/products', icon: Package },
        { id: 'buyers', label: 'Buyers (CRM)', path: '/buyers', icon: Users },
        { id: 'analytics', label: 'Revenue & Growth', path: '/analytics', icon: BarChart3 },
        { id: 'settings', label: 'Business Profile', path: '/settings', icon: Settings },
    ],

    defaultModule: 'dashboard'
};
