import type postgres from 'postgres';
import {
    captureActualCatalog,
    hashFile,
    loadExpectedCatalog,
    type Catalog,
    type CatalogIndex,
} from './baseline_catalog.js';

export interface ReadinessCheck {
    name: string;
    status: 'pass' | 'fail';
    error?: string;
    durationMs: number;
}

export interface ReadinessResult {
    ok: boolean;
    checks: ReadinessCheck[];
    elapsedMs: number;
    timedOut?: boolean;
}

export interface ReadinessOptions {
    snapshot0000Path: string;
    snapshot0001Path: string;
    migration0000SqlPath: string;
    migration0001SqlPath: string;
    journalPath: string;
    timeoutMs?: number;
}

export const DEFAULT_READINESS_TIMEOUT_MS = 10_000;
export const MAX_READINESS_TIMEOUT_MS = 30_000;
export const MIN_READINESS_TIMEOUT_MS = 1_000;

/**
 * Resolve a user-supplied readiness timeout value.
 *
 * Fails safely: invalid values throw descriptive errors that callers should
 * surface as a readiness failure (HTTP 503). The result is clamped to a safe
 * operational range so an accidentally huge timeout cannot hang the probe.
 */
export const resolveReadinessTimeout = (input?: string | number | undefined | null): number => {
    if (input === undefined || input === null || input === '') {
        return DEFAULT_READINESS_TIMEOUT_MS;
    }

    let value: number;
    if (typeof input === 'string') {
        value = Number.parseInt(input.trim(), 10);
    } else if (typeof input === 'number') {
        value = input;
    } else {
        throw new Error(`READINESS_TIMEOUT_MS must be a number or numeric string, got: ${typeof input}`);
    }

    if (!Number.isFinite(value) || Number.isNaN(value)) {
        throw new Error(`READINESS_TIMEOUT_MS must be a valid number, got: ${JSON.stringify(input)}`);
    }

    if (value < MIN_READINESS_TIMEOUT_MS) {
        throw new Error(`READINESS_TIMEOUT_MS below minimum ${MIN_READINESS_TIMEOUT_MS}: ${value}`);
    }

    if (value > MAX_READINESS_TIMEOUT_MS) {
        throw new Error(`READINESS_TIMEOUT_MS above maximum ${MAX_READINESS_TIMEOUT_MS}: ${value}`);
    }

    return value;
};

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

type JournalRow = { hash: string; created_at: number };

const timed = <T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> => {
    const started = Date.now();
    return fn().then((result) => ({ result, durationMs: Date.now() - started }));
};

const timedSync = <T>(fn: () => T): { result: T; durationMs: number } => {
    const started = Date.now();
    const result = fn();
    return { result, durationMs: Date.now() - started };
};

const failGroup = (names: string[], error: string): ReadinessCheck[] =>
    names.map((name) => ({ name, status: 'fail' as const, error, durationMs: 0 }));

const runDatabaseCheck = async (sql: postgres.Sql): Promise<ReadinessCheck> => {
    try {
        const { durationMs } = await timed(() => sql`SELECT 1`);
        return { name: 'database', status: 'pass', durationMs };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { name: 'database', status: 'fail', error: message, durationMs: 0 };
    }
};

const runJournalCheck = async (sql: postgres.Sql): Promise<{ check: ReadinessCheck; rows: JournalRow[] }> => {
    try {
        const { result: rows, durationMs } = await timed(async () =>
            sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`
        );
        if (rows.length === 0) {
            return {
                check: { name: 'journal_exists', status: 'fail', error: 'drizzle.__drizzle_migrations is empty', durationMs },
                rows: [],
            };
        }
        return { check: { name: 'journal_exists', status: 'pass', durationMs }, rows: rows as unknown as JournalRow[] };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            check: { name: 'journal_exists', status: 'fail', error: message, durationMs: 0 },
            rows: [],
        };
    }
};

const runHashCheck = async (options: ReadinessOptions): Promise<{ ok: true; hash0: string; hash1: string; durationMs: number } | { ok: false; error: string; durationMs: number }> => {
    try {
        const { result: [hash0, hash1], durationMs } = await timed(() =>
            Promise.all([hashFile(options.migration0000SqlPath), hashFile(options.migration0001SqlPath)])
        );
        return { ok: true, hash0, hash1, durationMs };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message, durationMs: 0 };
    }
};

const runActualCatalog = async (sql: postgres.Sql): Promise<{ ok: true; catalog: Catalog; durationMs: number } | { ok: false; error: string; durationMs: number }> => {
    try {
        const { result: catalog, durationMs } = await timed(() => captureActualCatalog(sql));
        return { ok: true, catalog, durationMs };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message, durationMs: 0 };
    }
};

const runExpectedCatalog = async (options: ReadinessOptions): Promise<{ ok: true; catalog: Catalog; durationMs: number } | { ok: false; error: string; durationMs: number }> => {
    try {
        const { result: catalog, durationMs } = await timed(() =>
            loadExpectedCatalog({
                snapshot0000Path: options.snapshot0000Path,
                snapshot0001Path: options.snapshot0001Path,
            })
        );
        return { ok: true, catalog, durationMs };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message, durationMs: 0 };
    }
};

const runBaselineProvenanceCheck = async (sql: postgres.Sql): Promise<ReadinessCheck> => {
    try {
        const { result: rows, durationMs } = await timed(() =>
            sql`SELECT key FROM public.q360_baseline_provenance LIMIT 1`
        );
        if (rows.length > 0) {
            return { name: 'baseline_provenance', status: 'pass', durationMs };
        }
        return { name: 'baseline_provenance', status: 'fail', error: 'no provenance rows', durationMs };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { name: 'baseline_provenance', status: 'fail', error: message, durationMs: 0 };
    }
};

const buildSchemaChecks = (catalog: Catalog): ReadinessCheck[] => {
    const actualTables = new Map(catalog.tables.map((t) => [t.name, t]));
    const checks: ReadinessCheck[] = [];

    for (const tableName of CRITICAL_TABLES) {
        if (actualTables.has(tableName)) {
            checks.push({ name: `table_${tableName}`, status: 'pass', durationMs: 0 });
        } else {
            checks.push({ name: `table_${tableName}`, status: 'fail', error: 'missing', durationMs: 0 });
        }
    }

    for (const { table, column } of CRITICAL_COLUMNS) {
        const t = actualTables.get(table);
        if (t && t.columns.some((c) => c.name === column)) {
            checks.push({ name: `column_${table}_${column}`, status: 'pass', durationMs: 0 });
        } else {
            checks.push({ name: `column_${table}_${column}`, status: 'fail', error: 'missing', durationMs: 0 });
        }
    }

    return checks;
};

const buildMigrationHashChecks = (journalRows: JournalRow[], hashes: { hash0: string; hash1: string }): ReadinessCheck[] => {
    const has0 = journalRows.some((r) => r.hash === hashes.hash0);
    const has1 = journalRows.some((r) => r.hash === hashes.hash1);
    return [
        has0
            ? { name: 'journal_hash_0000', status: 'pass' as const, durationMs: 0 }
            : { name: 'journal_hash_0000', status: 'fail' as const, error: '0000 hash not found in journal', durationMs: 0 },
        has1
            ? { name: 'journal_version_0001', status: 'pass' as const, durationMs: 0 }
            : { name: 'journal_version_0001', status: 'fail' as const, error: '0001 hash not found in journal', durationMs: 0 },
    ];
};

const indexMatches = (expected: CatalogIndex, actual: CatalogIndex): boolean =>
    JSON.stringify(expected.columns) === JSON.stringify(actual.columns) &&
    expected.unique === actual.unique &&
    expected.method.toLowerCase() === actual.method.toLowerCase() &&
    expected.predicate === actual.predicate;

const buildIndexChecks = (expectedCatalog: Catalog, actualCatalog: Catalog): ReadinessCheck[] => {
    const expectedIndexes = new Map(expectedCatalog.indexes.map((i) => [i.name, i]));
    const actualIndexes = new Map(actualCatalog.indexes.map((i) => [i.name, i]));
    const checks: ReadinessCheck[] = [];

    for (const name of RESTAURANT_INDEX_NAMES) {
        const { result: check, durationMs } = timedSync(() => {
            const expectedIdx = expectedIndexes.get(name);
            const actualIdx = actualIndexes.get(name);
            if (!expectedIdx) {
                return { name: `index_${name}`, status: 'fail' as const, error: 'not defined in expected catalog' };
            }
            if (!actualIdx) {
                return { name: `index_${name}`, status: 'fail' as const, error: 'missing' };
            }
            if (indexMatches(expectedIdx, actualIdx)) {
                return { name: `index_${name}`, status: 'pass' as const };
            }
            return {
                name: `index_${name}`,
                status: 'fail' as const,
                error: 'predicate/definition mismatch',
            };
        });
        checks.push({ ...check, durationMs });
    }

    return checks;
};

const runReadiness = async (sql: postgres.Sql, options: ReadinessOptions): Promise<ReadinessResult> => {
    const started = Date.now();
    const checks: ReadinessCheck[] = [];

    // 1. Database connectivity is the sequential gate: every other check needs
    // the database, so we fail fast when it is unreachable.
    const databaseCheck = await runDatabaseCheck(sql);
    checks.push(databaseCheck);
    if (databaseCheck.status === 'fail') {
        return { ok: false, checks, elapsedMs: Date.now() - started };
    }

    // 2. Independent checks run in parallel after connectivity is confirmed.
    //   - journal query (needed by hash checks)
    //   - file hash computation (needed by hash checks)
    //   - actual catalog capture (needed by table/column and index checks)
    //   - expected catalog load (needed by index checks)
    //   - baseline provenance query
    const [journalResult, hashResult, actualResult, expectedResult, provenanceCheck] = await Promise.all([
        runJournalCheck(sql),
        runHashCheck(options),
        runActualCatalog(sql),
        runExpectedCatalog(options),
        runBaselineProvenanceCheck(sql),
    ]);

    checks.push(journalResult.check);
    checks.push(provenanceCheck);

    // 3. Critical tables and columns (depend only on actual catalog).
    if (!actualResult.ok) {
        checks.push(...failGroup(CRITICAL_TABLES.map((t) => `table_${t}`), actualResult.error));
        checks.push(...failGroup(CRITICAL_COLUMNS.map((c) => `column_${c.table}_${c.column}`), actualResult.error));
    } else {
        checks.push(...buildSchemaChecks(actualResult.catalog));
    }

    // 4. Migration hash validation (depends on journal rows and file hashes).
    if (!hashResult.ok) {
        checks.push(...failGroup(['journal_hash_0000', 'journal_version_0001'], hashResult.error));
    } else {
        checks.push(...buildMigrationHashChecks(journalResult.rows, { hash0: hashResult.hash0, hash1: hashResult.hash1 }));
    }

    // 5. Restaurant canonical indexes and predicates (depend on both catalogs).
    if (actualResult.ok === false) {
        checks.push(...failGroup(RESTAURANT_INDEX_NAMES.map((n) => `index_${n}`), actualResult.error));
    } else if (expectedResult.ok === false) {
        checks.push(...failGroup(RESTAURANT_INDEX_NAMES.map((n) => `index_${n}`), expectedResult.error));
    } else {
        checks.push(...buildIndexChecks(expectedResult.catalog, actualResult.catalog));
    }

    return {
        ok: checks.every((c) => c.status === 'pass'),
        checks,
        elapsedMs: Date.now() - started,
    };
};

/**
 * Execute all readiness checks against the supplied Postgres client.
 *
 * Independent checks run in parallel. The database connectivity check is the
 * only sequential gate: if it fails, the function returns immediately so the
 * service is not left waiting on unrelated work.
 *
 * A configurable timeout guards the entire operation. If the timeout fires,
 * the result is fail-closed (ok: false) with a single `readiness_timeout`
 * check explaining the failure.
 */
export const performReadinessChecks = async (
    sql: postgres.Sql,
    options: ReadinessOptions,
): Promise<ReadinessResult> => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
    const started = Date.now();

    const timeoutPromise = new Promise<ReadinessResult>((_, reject) => {
        setTimeout(() => reject(new Error(`readiness check timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
        return await Promise.race([runReadiness(sql, options), timeoutPromise]);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            ok: false,
            checks: [
                {
                    name: 'readiness_timeout',
                    status: 'fail',
                    error: message,
                    durationMs: timeoutMs,
                },
            ],
            elapsedMs: Date.now() - started,
            timedOut: true,
        };
    }
};
