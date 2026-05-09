import type { VerticalManifest } from '@/types/vertical';
import {
    LayoutDashboard,
    Pill,
    Package,
    Truck,
    ShoppingCart,
    FileText,
    Users,
    BarChart3
} from 'lucide-react';

export const pharmacyManifest: VerticalManifest = {
    id: 'pharmacy',
    name: 'Pharmacy OS',
    shortName: 'Pharmacy',
    icon: Pill,
    color: '#06b6d4',
    basePath: '/app/pharmacy',
    description: 'Prescriptions, inventory, compliance, and dispensing.',

    modules: [
        { id: 'dashboard', label: 'Dashboard', path: '', icon: LayoutDashboard },
        { id: 'catalog', label: 'Catalog', path: '/catalog', icon: Pill },
        { id: 'inventory', label: 'Inventory', path: '/inventory', icon: Package },
        { id: 'suppliers', label: 'Suppliers', path: '/suppliers', icon: Truck },
        { id: 'pos', label: 'Dispensing', path: '/pos', icon: ShoppingCart },
        { id: 'rx', label: 'Prescriptions', path: '/rx', icon: FileText },
        { id: 'staff', label: 'Staff', path: '/staff', icon: Users },
        { id: 'reports', label: 'Reports', path: '/reports', icon: BarChart3 },
    ],

    defaultModule: 'dashboard'
};
