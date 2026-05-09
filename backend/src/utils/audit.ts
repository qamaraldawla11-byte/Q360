
import { Context } from 'hono';
import { db } from '../db/client.js';
import { auditLogs } from '../db/schema.js';

export const logAudit = async (
    c: Context,
    action: string,
    entity: string,
    entityId: string | null = null,
    details: any = null
) => {
    try {
        const userId = c.get('userId' as any) as string;
        const businessId = c.get('businessId' as any) as string;

        // If system action or unauthenticated (login), might need handling.
        // But for protected routes, userId and businessId should exist.
        if (!userId || !businessId) {
            console.warn('[Audit] Missing userId or businessId for audit log', { action, entity });
            return;
        }

        await db.insert(auditLogs).values({
            id: `aud_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            userId,
            businessId,
            action,
            entity,
            entityId,
            details: details ? JSON.stringify(details) : null,
        }).run();
    } catch (error) {
        console.error('[Audit] Failed to create audit log:', error);
    }
};
