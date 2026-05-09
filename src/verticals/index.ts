import type { VerticalManifest, VerticalType } from '@/types/vertical';
import { restaurantManifest } from '@/modules/commerce/restaurant/manifest';
import { pharmacyManifest } from '@/modules/commerce/pharmacy/manifest';
import { retailManifest } from '@/modules/commerce/retail/manifest';
import { supermarketManifest } from '@/modules/commerce/supermarket/manifest';
import { schoolManifest } from '@/modules/education/school/manifest';

// Central Registry of All Verticals
export const verticalRegistry: Record<VerticalType, VerticalManifest> = {
    restaurant: restaurantManifest,
    pharmacy: pharmacyManifest,
    retail: retailManifest,
    supermarket: supermarketManifest,
    school: schoolManifest,
    logistics: {} as VerticalManifest, // Placeholder for future
} as Record<VerticalType, VerticalManifest>;

// Helper: Get manifest by path
export function getManifestByPath(path: string): VerticalManifest | null {
    for (const manifest of Object.values(verticalRegistry)) {
        if (path.startsWith(manifest.basePath)) {
            return manifest;
        }
    }
    return null;
}

// Helper: Get all registered verticals
export function getRegisteredVerticals(): VerticalManifest[] {
    return Object.values(verticalRegistry);
}
