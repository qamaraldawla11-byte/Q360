import { ok, equal, notEqual } from 'assert';
import postgres from 'postgres';
import {
    verifyCatalogEquivalence,
    compareCatalogs,
    loadExpectedCatalog,
    captureActualCatalog,
    scanSqlForDestructiveStatements,
    defaultSnapshotPaths,
} from './baseline_catalog.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
    console.error('DATABASE_URL is required to run baseline_catalog tests');
    process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, ssl: process.env.POSTGRES_SSL === 'false' ? false : 'require' });
const paths = defaultSnapshotPaths();

const run = async () => {
    // 1. Strict equivalence against the committed 0000 + 0001 target.
    const strict = await verifyCatalogEquivalence(sql, {
        snapshot0000Path: paths.snapshot0000Path,
        snapshot0001Path: paths.snapshot0001Path,
        mode: 'strict',
        allowExtraTableNames: ['q360_baseline_provenance'],
    });
    ok(strict.ok, `Expected strict equivalence, got diffs: ${JSON.stringify(strict.diffs)}`);
    console.log('[baseline_catalog.test] strict equivalence: PASS');

    // 2. Pre-reconcile mode tolerates missing objects but rejects drift.
    const expected = await loadExpectedCatalog({
        snapshot0000Path: paths.snapshot0000Path,
        snapshot0001Path: paths.snapshot0001Path,
    });
    const actual = await captureActualCatalog(sql);
    const preCheck = compareCatalogs(expected, actual, {
        mode: 'pre_reconcile',
        allowExtraTableNames: ['q360_baseline_provenance'],
    });
    ok(preCheck.ok, `Expected pre-reconcile check to pass, got diffs: ${JSON.stringify(preCheck.diffs)}`);
    console.log('[baseline_catalog.test] pre-reconcile check: PASS');

    // 3. Detect a missing critical table.
    const missingTableActual = {
        ...actual,
        tables: actual.tables.filter((t) => t.name !== 'customers'),
    };
    const missingTableCheck = compareCatalogs(expected, missingTableActual, {
        mode: 'strict',
        allowExtraTableNames: ['q360_baseline_provenance'],
    });
    equal(missingTableCheck.ok, false, 'Expected missing customers table to fail strict check');
    ok(
        missingTableCheck.diffs.some((d) => d.kind === 'missing_table' && d.table === 'customers'),
        `Expected missing_table diff for customers, got ${JSON.stringify(missingTableCheck.diffs)}`,
    );
    console.log('[baseline_catalog.test] missing table detection: PASS');

    // 4. Destructive-SQL scanner rejects prohibited statements.
    const destructiveScan = scanSqlForDestructiveStatements('DROP TABLE users;');
    equal(destructiveScan.safe, false, 'Expected DROP to be flagged');
    notEqual(destructiveScan.violations.length, 0);

    const additiveScan = scanSqlForDestructiveStatements(
        'CREATE TABLE "t" ("id" text PRIMARY KEY NOT NULL);\n' +
        'ALTER TABLE "t" ADD COLUMN "x" text;\n' +
        'ALTER TABLE "t" ADD CONSTRAINT "u" UNIQUE ("x");\n' +
        'CREATE INDEX "idx" ON "t" ("x");',
    );
    ok(additiveScan.safe, `Expected additive SQL to pass scan, got ${JSON.stringify(additiveScan.violations)}`);
    console.log('[baseline_catalog.test] destructive SQL scan: PASS');

    console.log('[baseline_catalog.test] ALL PASS');
};

run()
    .catch((error) => {
        console.error('[baseline_catalog.test] FAILED:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sql.end();
    });
