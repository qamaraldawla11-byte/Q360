import { Badge, type BadgeVariant } from '@/components/design-system';
import type { ProductStatus } from '@/api/products.api';

const statusMeta: Record<ProductStatus, { label: string; variant: BadgeVariant }> = {
    active: { label: 'Active', variant: 'success' },
    archived: { label: 'Archived', variant: 'warning' },
};

interface ProductStatusBadgeProps {
    status: ProductStatus;
}

export const ProductStatusBadge = ({ status }: ProductStatusBadgeProps) => {
    const meta = statusMeta[status] || { label: status, variant: 'default' as BadgeVariant };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
};
