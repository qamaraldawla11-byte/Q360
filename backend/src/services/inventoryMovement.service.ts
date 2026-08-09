import { randomUUID } from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import { db, first } from '../db/client.js';
import * as schema from '../db/schema.js';
import { inventoryItems, stockMovements } from '../db/schema.js';
import { isBusinessModuleEnabled } from './businessModules.js';
import { MODULE_MANAGEMENT_ROLES } from './moduleAccessControl.js';

type DbTransaction = PgTransaction<
    PostgresJsQueryResultHKT,
    typeof schema,
    import('drizzle-orm').ExtractTablesWithRelations<typeof schema>
>;

export type StockStatus = 'ok' | 'low' | 'critical';

export type MovementType =
    | 'purchase_received'
    | 'sale'
    | 'manual_adjustment'
    | 'restaurant_sale'
    | 'return'
    | 'wastage';

export interface ApplyStockMovementInput {
    businessId: string;
    userId: string;
    userRole: string;
    inventoryItemId: string;
    delta: number;
    reason: string;
    operationId?: string;
    movementType?: MovementType | string;
    sourceModule?: string;
    /** Module key to authorize. Defaults to 'inventory'. */
    moduleKey?: string;
    /** Workspace scope for module authorization. Defaults to 'restaurant'. */
    workspaceKey?: string;
    /** Allowed roles. Management roles always bypass. Defaults to owner/admin/manager/staff. */
    requiredRoles?: string[];
    /**
     * Optional existing Drizzle transaction. When provided, the stock update and
     * movement insert run inside the caller's transaction instead of opening a
     * new one. This lets multi-step flows (e.g. purchase receive + finance
     * record) stay atomic.
     */
    tx?: DbTransaction;
}

export interface ApplyStockMovementResult {
    movementId: string;
    inventoryItemId: string;
    previousCurrent: number;
    newCurrent: number;
    newStatus: StockStatus;
    deltaApplied: number;
    idempotent: boolean;
}

export class StockMovementError extends Error {
    constructor(
        message: string,
        readonly status: 400 | 403 | 404 | 409,
    ) {
        super(message);
    }
}

/**
 * Shared stock-status computation used by every inventory mutation.
 */
export const computeStockStatus = (current: number, min: number): StockStatus => {
    if (current <= min / 2) return 'critical';
    if (current <= min) return 'low';
    return 'ok';
};

/**
 * Apply a single, atomic, tenant-scoped stock movement.
 *
 * Guarantees:
 *  - tenant validation (item belongs to businessId)
 *  - module authorization
 *  - role authorization
 *  - operation-id idempotency (same operationId returns existing result)
 *  - atomic stock update
 *  - negative-stock rejection (409)
 *  - exactly one stock_movements record per successful call
 */
export const applyStockMovement = async (
    input: ApplyStockMovementInput,
): Promise<ApplyStockMovementResult> => {
    const {
        businessId,
        userId,
        userRole,
        inventoryItemId,
        delta,
        reason,
        operationId,
        movementType,
        sourceModule,
        moduleKey = 'inventory',
        workspaceKey = 'restaurant',
        requiredRoles = ['owner', 'admin', 'manager', 'staff'],
        tx,
    } = input;

    const executor = tx ?? db;

    // Role authorization: explicit allow-list, with management bypass.
    const effectiveRole = userRole ?? '';
    const allowed = requiredRoles.includes(effectiveRole) || MODULE_MANAGEMENT_ROLES.has(effectiveRole);
    if (!allowed) {
        throw new StockMovementError('Forbidden: Insufficient permissions', 403);
    }

    // Module authorization.
    const moduleEnabled = await isBusinessModuleEnabled(businessId, workspaceKey, moduleKey);
    if (!moduleEnabled) {
        throw new StockMovementError(`Module '${moduleKey}' is disabled for this business`, 409);
    }

    // Tenant validation: item must exist under the requesting tenant.
    const item = await first(
        executor.select().from(inventoryItems).where(
            and(eq(inventoryItems.id, inventoryItemId), eq(inventoryItems.businessId, businessId)),
        ),
    );
    if (!item) {
        throw new StockMovementError('Inventory item not found', 404);
    }

    // Operation-id idempotency: if a movement for this tenant+operation already
    // exists, return the previously applied result without mutating stock again.
    if (operationId) {
        const existing = await first(
            executor.select().from(stockMovements).where(
                and(
                    eq(stockMovements.businessId, businessId),
                    eq(stockMovements.operationId, operationId),
                    eq(stockMovements.inventoryItemId, inventoryItemId),
                ),
            ),
        );
        if (existing) {
            return {
                movementId: existing.id,
                inventoryItemId: existing.inventoryItemId,
                previousCurrent: item.current - existing.delta,
                newCurrent: item.current,
                newStatus: computeStockStatus(item.current, item.min),
                deltaApplied: existing.delta,
                idempotent: true,
            };
        }
    }

    const runMovement = async (ctx: DbTransaction) => {
        const [updatedItem] = await ctx
            .update(inventoryItems)
            .set({
                current: sql`${inventoryItems.current} + ${delta}`,
                status: computeStockStatus(item.current + delta, item.min),
            })
            .where(
                and(
                    eq(inventoryItems.id, inventoryItemId),
                    eq(inventoryItems.businessId, businessId),
                    sql`${inventoryItems.current} + ${delta} >= 0`,
                ),
            )
            .returning({ current: inventoryItems.current, min: inventoryItems.min });

        if (!updatedItem) {
            throw new StockMovementError('Insufficient stock for this operation', 409);
        }

        const newStatus = computeStockStatus(updatedItem.current, updatedItem.min);

        // Backwards compatibility: keep populating purchaseOrderId for supplier receive flow.
        const purchaseOrderId = sourceModule === 'suppliers' && operationId ? operationId : null;

        const [movement] = await ctx
            .insert(stockMovements)
            .values({
                id: randomUUID(),
                businessId,
                inventoryItemId,
                purchaseOrderId,
                operationId: operationId ?? null,
                movementType: movementType ?? null,
                sourceModule: sourceModule ?? null,
                delta,
                reason,
                createdBy: userId,
            })
            .returning({ id: stockMovements.id });

        return {
            movementId: movement.id,
            inventoryItemId,
            previousCurrent: item.current,
            newCurrent: updatedItem.current,
            newStatus,
            deltaApplied: delta,
            idempotent: false,
        };
    };

    // Atomic stock update with negative-stock rejection.
    if (tx) {
        return runMovement(tx);
    }
    return db.transaction(runMovement);
};
