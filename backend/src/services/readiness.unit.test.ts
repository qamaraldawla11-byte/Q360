import { equal, ok, throws } from 'assert';
import type postgres from 'postgres';
import {
    performReadinessChecks,
    resolveReadinessTimeout,
    DEFAULT_READINESS_TIMEOUT_MS,
    MAX_READINESS_TIMEOUT_MS,
    MIN_READINESS_TIMEOUT_MS,
} from './readiness.js';
import { defaultSnapshotPaths } from './baseline_catalog.js';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const reconstructQuery = (strings: TemplateStringsArray, values: unknown[]): string =>
    strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? String(values[i]) : ''), '');

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

const TABLE_COLUMNS: Record<string, { name: string; type: string; nullable: boolean; default: string | null }[]> = {
    businesses: [{ name: 'id', type: 'uuid', nullable: false, default: null }, { name: 'public_code', type: 'varchar', nullable: true, default: null }],
    users: [{ name: 'id', type: 'uuid', nullable: false, default: null }, { name: 'module_access', type: 'jsonb', nullable: true, default: null }],
    restaurant_orders: [
        { name: 'id', type: 'uuid', nullable: false, default: null },
        { name: 'business_id', type: 'uuid', nullable: false, default: null },
        { name: 'idempotency_key', type: 'varchar', nullable: true, default: null },
        { name: 'visible_order_number', type: 'varchar', nullable: true, default: null },
        { name: 'order_number_date', type: 'date', nullable: true, default: null },
    ],
};

const defaultColumns = (tableName: string) => {
    if (TABLE_COLUMNS[tableName]) return TABLE_COLUMNS[tableName];
    return [{ name: 'id', type: 'uuid', nullable: false, default: null }];
};

/**
 * Build a minimal Postgres.js-compatible mock for readiness testing.
 *
 * Supports tagged-template queries and `sql.unsafe()` used by the catalog
 * capture helpers. Network latency is simulated with a per-query delay.
 */
const createMockSql = (options: { delayMs?: number; missingTables?: string[] } = {}): postgres.Sql => {
    const baseTables = CRITICAL_TABLES.filter((t) => !(options.missingTables ?? []).includes(t));

    const maybeDelay = async () => {
        if (options.delayMs) await sleep(options.delayMs);
    };

    const fn = async (strings: TemplateStringsArray, ...values: unknown[]) => {
        await maybeDelay();
        const query = reconstructQuery(strings, values);

        if (query.includes('SELECT 1')) return [{}];

        if (query.includes('__drizzle_migrations')) {
            return [];
        }

        if (query.includes('q360_baseline_provenance')) {
            return [{ key: 'baseline-marker' }];
        }

        if (query.includes('information_schema.tables')) {
            return baseTables.map((table_name) => ({ table_name }));
        }

        if (query.includes('pg_indexes')) {
            return [
                {
                    tablename: 'restaurant_orders',
                    indexname: 'restaurant_orders_business_idempotency_key_idx',
                    indexdef:
                        'CREATE UNIQUE INDEX restaurant_orders_business_idempotency_key_idx ON public.restaurant_orders USING btree (business_id, idempotency_key) WHERE (restaurant_orders.idempotency_key IS NOT NULL)',
                },
                {
                    tablename: 'restaurant_orders',
                    indexname: 'restaurant_orders_business_daily_visible_number_idx',
                    indexdef:
                        'CREATE UNIQUE INDEX restaurant_orders_business_daily_visible_number_idx ON public.restaurant_orders USING btree (business_id, order_number_date, visible_order_number) WHERE ((restaurant_orders.visible_order_number IS NOT NULL) AND (restaurant_orders.order_number_date IS NOT NULL))',
                },
            ];
        }

        return [];
    };

    const unsafe = async (query: string, params?: unknown[]) => {
        await maybeDelay();

        if (query.includes('pg_attribute')) {
            const tableName = String(params?.[1] ?? '');
            return defaultColumns(tableName);
        }

        if (query.includes('pg_constraint') && query.includes("contype = 'p'")) {
            const tableName = String(params?.[1] ?? '');
            return [{ name: `${tableName}_pkey`, columns: ['id'] }];
        }

        if (query.includes('pg_constraint') && query.includes("contype = 'u'")) {
            return [];
        }

        return [];
    };

    return Object.assign(fn, { unsafe }) as unknown as postgres.Sql;
};

const paths = defaultSnapshotPaths(process.cwd());
const migration0001SqlPath = paths.migration0000SqlPath.replace('0000_wave0_initial.sql', '0001_restaurant_partial_index_adoption.sql');

const runWithMock = async (sql: postgres.Sql, timeoutMs?: number) =>
    performReadinessChecks(sql, {
        snapshot0000Path: paths.snapshot0000Path,
        snapshot0001Path: paths.snapshot0001Path,
        migration0000SqlPath: paths.migration0000SqlPath,
        migration0001SqlPath,
        journalPath: paths.snapshot0000Path.replace('meta/0000_snapshot.json', 'meta/_journal.json'),
        timeoutMs,
    });

const run = async () => {
    // --- Config validation ---
    equal(resolveReadinessTimeout(), DEFAULT_READINESS_TIMEOUT_MS, 'default timeout');
    equal(resolveReadinessTimeout(String(DEFAULT_READINESS_TIMEOUT_MS)), DEFAULT_READINESS_TIMEOUT_MS, 'explicit string');
    equal(resolveReadinessTimeout(MAX_READINESS_TIMEOUT_MS), MAX_READINESS_TIMEOUT_MS, 'max boundary');
    equal(resolveReadinessTimeout(MIN_READINESS_TIMEOUT_MS), MIN_READINESS_TIMEOUT_MS, 'min boundary');
    throws(() => resolveReadinessTimeout(MIN_READINESS_TIMEOUT_MS - 1), /below minimum/, 'below min');
    throws(() => resolveReadinessTimeout(MAX_READINESS_TIMEOUT_MS + 1), /above maximum/, 'above max');
    throws(() => resolveReadinessTimeout('not-a-number'), /valid number/, 'non-numeric string');
    throws(() => resolveReadinessTimeout(Number.NaN), /valid number/, 'NaN');
    console.log('[readiness.unit.test] config validation: PASS');

    // --- Timeout scenario ---
    const slowSql = createMockSql({ delayMs: 100 });
    const timeoutResult = await runWithMock(slowSql, 1);
    equal(timeoutResult.ok, false, 'timeout result is not ready');
    equal(timeoutResult.timedOut, true, 'timedOut flag is set');
    ok(timeoutResult.elapsedMs >= 0, 'elapsedMs present');
    const timeoutCheck = timeoutResult.checks.find((c) => c.name === 'readiness_timeout');
    ok(timeoutCheck, 'readiness_timeout check exists');
    ok(timeoutCheck?.error?.includes('timed out'), 'timeout reason is clear');
    console.log('[readiness.unit.test] timeout scenario: PASS');

    // --- Critical failure: missing critical table ---
    const missingTableSql = createMockSql({ delayMs: 0, missingTables: ['restaurant_orders'] });
    const missingResult = await runWithMock(missingTableSql, 5_000);
    equal(missingResult.ok, false, 'missing table result is not ready');
    equal(missingResult.timedOut, undefined, 'not a timeout');
    ok(missingResult.checks.some((c) => c.name === 'table_restaurant_orders' && c.status === 'fail'), 'missing table reported');
    ok(missingResult.checks.some((c) => c.name === 'database' && c.status === 'pass'), 'database check still passes');
    console.log('[readiness.unit.test] critical failure (missing table): PASS');

    // --- Slow Supabase simulation ---
    // Each query takes 100ms. With parallel execution the wall-clock time should
    // stay well under the 10000ms safe default, proving the probe does not
    // artificially time out on a slow but healthy provider.
    const slowHealthySql = createMockSql({ delayMs: 100 });
    const slowResult = await runWithMock(slowHealthySql, DEFAULT_READINESS_TIMEOUT_MS);
    equal(slowResult.timedOut, undefined, 'slow provider did not time out');
    ok(slowResult.elapsedMs < 5_000, `slow provider completed in ${slowResult.elapsedMs}ms, expected < 5000ms`);
    // The mock is not fully healthy (journal hashes do not match real files), so
    // the result is not ok, but it proves the timeout window is large enough.
    ok(slowResult.checks.length > 0, 'checks completed despite slow queries');
    console.log('[readiness.unit.test] slow Supabase simulation: PASS');

    console.log('[readiness.unit.test] ALL PASS');
};

run()
    .catch((error) => {
        console.error('[readiness.unit.test] FAILED:', error);
        process.exitCode = 1;
    });
