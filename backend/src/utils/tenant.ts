import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { businesses, users, type User } from '../db/schema.js';

export const DEFAULT_BUSINESS_ID = 'biz_main';

export const isWorkspaceRoute = (value: string | null | undefined) =>
    typeof value === 'string' && value.startsWith('/app/');

export const stableTenantId = (value: string | null | undefined) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed && !isWorkspaceRoute(trimmed) ? trimmed : null;
};

export const resolveJwtBusinessId = (user: Pick<User, 'businessId'>) =>
    stableTenantId(user.businessId) ?? DEFAULT_BUSINESS_ID;

export const ensureBusinessRecord = async (businessId: string, name: string, type: string, ownerUserId?: string) => {
    const existing = await first(db.select().from(businesses).where(eq(businesses.id, businessId)));
    if (existing) {
        await db.update(businesses)
            .set({ name, type, ...(ownerUserId && !existing.ownerUserId ? { ownerUserId } : {}) })
            .where(eq(businesses.id, businessId));
        return businessId;
    }

    await db.insert(businesses).values({
        id: businessId,
        name,
        type,
        status: 'active',
        ownerUserId: ownerUserId || null,
    });
    return businessId;
};

export class TenantIdentityRequiredError extends Error {
    constructor() {
        super('TENANT_IDENTITY_REQUIRED');
        this.name = 'TenantIdentityRequiredError';
    }
}

export const ensureUserBusiness = async (
    userId: string,
    input: { businessName: string; segment: string },
) => {
    const user = await first(db.select().from(users).where(eq(users.id, userId)));
    if (!user) return null;
    if (!user.businessId) throw new TenantIdentityRequiredError();

    const stableId = stableTenantId(user.businessId);
    // Legacy workspace-route identities migrate to a fresh user-owned tenant,
    // never to the shared demo tenant.
    const businessId = stableId ?? `biz_${randomUUID()}`;
    await ensureBusinessRecord(businessId, input.businessName, input.segment, stableId ? undefined : userId);

    if (user.businessId !== businessId) {
        await db.update(users)
            .set({ businessId })
            .where(eq(users.id, userId));
    }

    return businessId;
};
