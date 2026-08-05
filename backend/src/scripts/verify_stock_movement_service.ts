import { createHmac } from 'crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';

requireQ360StagingDatabaseGuard('verify:stock-movement-service');
requireDatabaseUrl();
process.env.JWT_SECRET ||= 'stock-movement-verification';
process.env.NODE_ENV = 'test';

const { db, closeDatabase } = await import('../db/client.js');
const { businesses, inventoryItems, stockMovements, users, businessModules } = await import('../db/schema.js');
const { applyStockMovement, StockMovementError, computeStockStatus } = await import('../services/inventoryMovement.service.js');

const businessIds = ['biz_verify_sm_a', 'biz_verify_sm_b'];
const userIds = ['usr_verify_sm_a', 'usr_verify_sm_b'];

const token = (u: string, b: string) => {
    const e = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const n = Math.floor(Date.now() / 1000);
    const h = e({ alg: 'HS256', typ: 'JWT' });
    const p = e({ sub: u, email: `${u}@example.com`, role: 'admin', businessId: b, iat: n, exp: n + 3600 });
    const s = createHmac('sha256', process.env.JWT_SECRET!).update(`${h}.${p}`).digest('base64url');
    return `${h}.${p}.${s}`;
};

try {
    // Cleanup
    await db.delete(businessModules).where(inArray(businessModules.businessId, businessIds));
    await db.delete(stockMovements).where(inArray(stockMovements.businessId, businessIds));
    await db.delete(inventoryItems).where(inArray(inventoryItems.businessId, businessIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(businesses).where(inArray(businesses.id, businessIds));

    // Seed
    await db.insert(businesses).values(businessIds.map((id, i) => ({ id, name: `SM Biz ${i}`, type: 'retail' })));
    await db.insert(users).values(userIds.map((id, i) => ({ id, email: `${id}@example.com`, role: 'admin', businessId: businessIds[i] })));

    const [itemA] = await db.insert(inventoryItems).values({
        id: 'inv_sm_a_1',
        businessId: businessIds[0],
        name: 'Test Item A',
        current: 100,
        min: 10,
        unit: 'pcs',
        price: 5,
    }).returning();

    const [itemB] = await db.insert(inventoryItems).values({
        id: 'inv_sm_b_1',
        businessId: businessIds[1],
        name: 'Test Item B',
        current: 50,
        min: 5,
        unit: 'pcs',
        price: 5,
    }).returning();

    const baseA = { businessId: businessIds[0], userId: userIds[0], userRole: 'admin', inventoryItemId: itemA.id };

    // --- Idempotency ---
    const opId = `op_sm_${Date.now()}`;
    const firstCall = await applyStockMovement({
        ...baseA,
        delta: -3,
        reason: 'sale',
        operationId: opId,
        movementType: 'sale',
        sourceModule: 'orders',
    });
    if (firstCall.newCurrent !== 97 || firstCall.idempotent) throw new Error('First call should not be idempotent');

    const secondCall = await applyStockMovement({
        ...baseA,
        delta: -3,
        reason: 'sale',
        operationId: opId,
        movementType: 'sale',
        sourceModule: 'orders',
    });
    if (!secondCall.idempotent || secondCall.movementId !== firstCall.movementId || secondCall.newCurrent !== 97) {
        throw new Error('Idempotency failed');
    }

    // --- Negative stock rejection ---
    try {
        await applyStockMovement({
            ...baseA,
            delta: -1000,
            reason: 'oversell',
            movementType: 'sale',
            sourceModule: 'orders',
        });
        throw new Error('Oversell should have been rejected');
    } catch (error) {
        if (!(error instanceof StockMovementError) || error.status !== 409) {
            throw new Error(`Expected 409 StockMovementError, got ${error}`);
        }
    }
    const afterRejection = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemA.id));
    if (afterRejection[0].current !== 97) throw new Error('Stock changed despite rejection');

    // --- Tenant isolation ---
    await applyStockMovement({
        businessId: businessIds[1],
        userId: userIds[1],
        userRole: 'admin',
        inventoryItemId: itemB.id,
        delta: -5,
        reason: 'sale',
        movementType: 'sale',
        sourceModule: 'orders',
    });
    const [itemBAfter] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemB.id));
    if (itemBAfter.current !== 45) throw new Error('Tenant B stock not updated');
    const [itemAAfterIsolation] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemA.id));
    if (itemAAfterIsolation.current !== 97) throw new Error('Tenant A stock affected by tenant B');

    // --- Module authorization ---
    await db.insert(businessModules).values({
        id: 'bm_sm_disabled',
        businessId: businessIds[0],
        workspaceKey: 'restaurant',
        moduleKey: 'inventory',
        enabled: false,
    });
    try {
        await applyStockMovement({
            ...baseA,
            delta: 1,
            reason: 'test',
            movementType: 'manual_adjustment',
            sourceModule: 'inventory',
        });
        throw new Error('Disabled module should have been rejected');
    } catch (error) {
        if (!(error instanceof StockMovementError) || error.status !== 409) {
            throw new Error(`Expected 409 module error, got ${error}`);
        }
    }
    await db.delete(businessModules).where(eq(businessModules.id, 'bm_sm_disabled'));

    // --- Role authorization ---
    try {
        await applyStockMovement({
            ...baseA,
            userRole: 'viewer',
            delta: 1,
            reason: 'test',
            movementType: 'manual_adjustment',
            sourceModule: 'inventory',
        });
        throw new Error('Viewer role should have been rejected');
    } catch (error) {
        if (!(error instanceof StockMovementError) || error.status !== 403) {
            throw new Error(`Expected 403 role error, got ${error}`);
        }
    }

    // --- Ledger reconciliation ---
    const startStock = 97;
    await applyStockMovement({
        ...baseA,
        delta: 20,
        reason: 'purchase_received',
        movementType: 'purchase_received',
        sourceModule: 'suppliers',
    });
    await applyStockMovement({
        ...baseA,
        delta: -7,
        reason: 'sale',
        movementType: 'sale',
        sourceModule: 'orders',
    });

    const [itemAReconciled] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemA.id));
    const expectedStock = startStock + 20 - 7;
    if (itemAReconciled.current !== expectedStock) {
        throw new Error(`Ledger mismatch: expected ${expectedStock}, got ${itemAReconciled.current}`);
    }

    const movements = await db.select().from(stockMovements).where(eq(stockMovements.businessId, businessIds[0]));
    const sumDeltas = movements.reduce((sum, m) => sum + Number(m.delta), 0);
    if (sumDeltas !== expectedStock - 100) {
        throw new Error(`Movement ledger sum ${sumDeltas} does not match net stock change ${expectedStock - 100}`);
    }

    // --- computeStockStatus sanity ---
    if (computeStockStatus(100, 10) !== 'ok') throw new Error('computeStockStatus ok failed');
    if (computeStockStatus(10, 10) !== 'low') throw new Error('computeStockStatus low failed');
    if (computeStockStatus(5, 10) !== 'critical') throw new Error('computeStockStatus critical failed');

    console.log(JSON.stringify({
        idempotency: true,
        negativeStockRejection: true,
        tenantIsolation: true,
        moduleAuthorization: true,
        roleAuthorization: true,
        ledgerReconciliation: true,
        computeStockStatus: true,
    }, null, 2));
} catch (error) {
    console.error('Stock movement service verification failed:', error);
    process.exitCode = 1;
} finally {
    await db.delete(businessModules).where(inArray(businessModules.businessId, businessIds));
    await db.delete(stockMovements).where(inArray(stockMovements.businessId, businessIds));
    await db.delete(inventoryItems).where(inArray(inventoryItems.businessId, businessIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(businesses).where(inArray(businesses.id, businessIds));
    await closeDatabase();
}
