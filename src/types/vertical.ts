import type { LucideIcon } from 'lucide-react';

export type VerticalType = 'restaurant' | 'pharmacy' | 'retail' | 'supermarket' | 'school' | 'supplier' | 'logistics' | 'admin' | 'settings';

export interface VerticalModule {
    id: string;
    label: string;
    path: string;
    icon: LucideIcon;
}

export interface VerticalManifest {
    id: VerticalType;
    name: string;
    shortName: string;
    icon: LucideIcon;
    color: string;
    basePath: string;
    description: string;

    // Modules define both routes and sidebar
    modules: VerticalModule[];

    // Default module (usually dashboard)
    defaultModule: string;
}
