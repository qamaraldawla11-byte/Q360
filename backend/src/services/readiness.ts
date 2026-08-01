import type postgres from 'postgres';
import {
    captureActualCatalog,
    hashFile,
    loadExpectedCatalog,
    type CatalogIndex,
} from './baseline_catalog.js';

export interface ReadinessCheck {
    name: string;
    status: 'pass' | 'fail';
    error?: string;
}

export interface ReadinessResult {
    ok: boolean;
    checks: ReadinessCheck[];
}

const CRITICAL_TABLES = [
    'users',
    'businesses',
    'audit_logs',
    'staff_invitations',
    'staff_members',
    'business_modules',
    'customers',
    'quotes',
    'quote_items',
    'restaurant_orders',
    'restaurant_payments',
    'kds_tickets',
    'orders',
    'products',
    'inventory_items',
];

const CRITICAL_COLUMNS: { table: string; column: string }[] = [
    { table: 'businesses', column: 'public_code' },
    { table: 'users', column: 'module_access' },
    { table: 'restaurant_orders', column: 'idempotency_key' },
    { table: 'restaurant_orders', column: 'visible_order_number' },
    { table: 'restaurant_orders', column: 'order_number_date' },
];

const RESTAURANT_INDEX_NAMES = [
    'restaurant_orders_business_idempotency_key_idx',
    'restaurant_orders_business_daily_visible_number_idx',
];

export const performReadinessChecks = async (
    sql: postgres.Sql,
    options: {
        snapshot0000Path: string;
        snapshot0001Path: string;
        migration0000SqlPath: string;
        migration0001SqlPath: string;
        journalPath: string;
    },
): Promise<ReadinessResult> => {
    const checks: ReadinessCheck[] = [];

    // 1. Database connectivity
    try {
        await sql`SELECT 1`;
        checks.push({ name: 'database', status: 'pass' });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        checks.push({ name: 'database', status: 'fail', error: message });
        return { ok: false, checks };
    }

    // 2. Migration journal exists and contains expected rows.
    let journalRows: { hash: string; created_at: number }[] = [];
    try {
        journalRows = await sql`
            SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
        `;
        if (journalRows.length === 0) {
            checks.push({ name: 'journal_exists', status: 'fail', error: 'drizzle.__drizzle_migrations is empty' });
        } else {
            checks.push({ name: 'journal_exists', status: 'pass' });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        checks.push({ name: 'journal_exists', status: 'fail', error: message });
    }

    // 3. Expected migration hashes and current version.
    try {
        const hash0 = await hashFile(options.migration0000SqlPath);
        const hash1 = await hashFile(options.migration0001SqlPath);
        const has0 = journalRows.some((r) => r.hash === hash0);
        const has1 = journalRows.some((r) => r.hash === hash1);
        if (has0) {
            checks.push({ name: 'journal_hash_0000', status: 'pass' });
        } else {
            checks.push({ name: 'journal_hash_0000', status: 'fail', error: '0000 hash not found in journal' });
        }
        if (has1) {
            checks.push({ name: 'journal_version_0001', status: 'pass' });
        } else {
            checks.push({ name: 'journal_version_0001', status: 'fail', error: '0001 hash not found in journal' });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        checks.push({ name: 'journal_hash_0000', status: 'fail', error: message });
        checks.push({ name: 'journal_version_0001', status: 'fail', error: message });
    }

    // 4. Critical tables and columns.
    try {
        const actual = await captureActualCatalog(sql);
        const actualTables = new Map(actual.tables.map((t) => [t.name, t]));

        for (const tableName of CRITICAL_TABLES) {
            if (actualTables.has(tableName)) {
                checks.push({ name: `table_${tableName}`, status: 'pass' });
            } else {
                checks.push({ name: `table_${tableName}`, status: 'fail', error: 'missing' });
            }
        }

        for (const { table, column } of CRITICAL_COLUMNS) {
            const t = actualTables.get(table);
            if (t && t.columns.some((c) => c.name === column)) {
                checks.push({ name: `column_${table}_${column}`, status: 'pass' });
            } else {
                checks.push({ name: `column_${table}_${column}`, status: 'fail', error: 'missing' });
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const tableName of CRITICAL_TABLES) {
            checks.push({ name: `table_${tableName}`, status: 'fail', error: message });
        }
        for (const { table, column } of CRITICAL_COLUMNS) {
            checks.push({ name: `column_${table}_${column}`, status: 'fail', error: message });
        }
    }

    // 5. Restaurant canonical indexes and predicates.
    try {
        const expected = await loadExpectedCatalog({
            snapshot0000Path: options.snapshot0000Path,
            snapshot0001Path: options.snapshot0001Path,
        });
        const actual = await captureActualCatalog(sql);
        const expectedIndexes = new Map(expected.indexes.map((i) => [i.name, i]));
        const actualIndexes = new Map(actual.indexes.map((i) => [i.name, i]));

        for (const name of RESTAURANT_INDEX_NAMES) {
            const expectedIdx = expectedIndexes.get(name);
            const actualIdx = actualIndexes.get(name);
            if (!expectedIdx) {
                checks.push({ name: `index_${name}`, status: 'fail', error: 'not defined in expected catalog' });
                continue;
            }
            if (!actualIdx) {
                checks.push({ name: `index_${name}`, status: 'fail', error: 'missing' });
                continue;
            }
            const match =
                JSON.stringify(expectedIdx.columns) === JSON.stringify(actualIdx.columns) &&
                expectedIdx.unique === actualIdx.unique &&
                expectedIdx.method.toLowerCase() === actualIdx.method.toLowerCase() &&
                expectedIdx.predicate === actualIdx.predicate;
            if (match) {
                checks.push({ name: `index_${name}`, status: 'pass' });
            } else {
                checks.push({
                    name: `index_${name}`,
                    status: 'fail',
                    error: `predicate/definition mismatch: expected ${JSON.stringify(expectedIdx)}, actual ${JSON.stringify(actualIdx)}`,
                });
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const name of RESTAURANT_INDEX_NAMES) {
            checks.push({ name: `index_${name}`, status: 'fail', error: message });
        }
    }

    // 6. Baseline provenance exists.
    try {
        const rows = await sql`
            SELECT key FROM public.q360_baseline_provenance LIMIT 1
        `;
        if (rows.length > 0) {
            checks.push({ name: 'baseline_provenance', status: 'pass' });
        } else {
            checks.push({ name: 'baseline_provenance', status: 'fail', error: 'no provenance rows' });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        checks.push({ name: 'baseline_provenance', status: 'fail', error: message });
    }

    return {
        ok: checks.every((c) => c.status === 'pass'),
        checks,
    };
};
