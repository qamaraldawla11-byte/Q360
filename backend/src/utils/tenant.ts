import { eq } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { businesses, users, type User } from '../db/schema.js';

export const DEFAULT_BUSINESS_ID = 'biz_main';

export const isWorkspaceRoute = (value: string | null | undefined) =>
    typeof value === 'string' && value.startsWith('/app/');

const stableTenantId = (value: string | null | undefined) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed && !isWorkspaceRoute(trimmed) ? trimmed : null;
};

export const resolveJwtBusinessId = (user: Pick<User, 'businessId'>) =>
    stableTenantId(user.businessId) ?? DEFAULT_BUSINESS_ID;

export const ensureBusinessRecord = async (businessId: string, name: string, type: string) => {
    const existing = await first(db.select().from(businesses).where(eq(businesses.id, businessId)));
    if (existing) {
        await db.update(businesses)
            .set({ name, type })
            .where(eq(businesses.id, businessId));
        return businessId;
    }

    await db.insert(businesses).values({
        id: businessId,
        name,
        type,
        status: 'active',
    });
    return businessId;
};

export const ensureUserBusiness = async (
    userId: string,
    input: { businessName: string; segment: string },
) => {
    const user = await first(db.select().from(users).where(eq(users.id, userId)));
    if (!user) return null;

    const businessId = stableTenantId(user.businessId) ?? DEFAULT_BUSINESS_ID;
    await ensureBusinessRecord(businessId, input.businessName, input.segment);

    if (user.businessId !== businessId) {
        await db.update(users)
            .set({ businessId })
            .where(eq(users.id, userId));
    }

    return businessId;
};
