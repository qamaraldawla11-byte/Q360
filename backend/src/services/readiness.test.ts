import { ok, equal } from 'assert';
import postgres from 'postgres';
import { performReadinessChecks } from './readiness.js';
import { defaultSnapshotPaths } from './baseline_catalog.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
    console.error('DATABASE_URL is required to run readiness tests');
    process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, ssl: process.env.POSTGRES_SSL === 'false' ? false : 'require' });
const paths = defaultSnapshotPaths();

const run = async () => {
    const result = await performReadinessChecks(sql, {
        snapshot0000Path: paths.snapshot0000Path,
        snapshot0001Path: paths.snapshot0001Path,
        migration0000SqlPath: paths.migration0000SqlPath,
        migration0001SqlPath: paths.migration0000SqlPath.replace('0000_wave0_initial.sql', '0001_restaurant_partial_index_adoption.sql'),
        journalPath: paths.snapshot0000Path.replace('meta/0000_snapshot.json', 'meta/_journal.json'),
    });

    equal(result.ok, true, `Expected readiness OK, got failing checks: ${JSON.stringify(result.checks.filter((c) => c.status === 'fail'))}`);
    ok(result.checks.length > 0, 'Expected at least one readiness check');
    ok(result.elapsedMs >= 0, 'Expected elapsedMs to be present and non-negative');
    ok(result.checks.every((c) => typeof c.durationMs === 'number'), 'Expected every check to include durationMs');
    console.log('[readiness.test] readiness OK: PASS');

    // Timeout path: an impossibly short timeout should fail safely with a clear
    // timeout reason and no unhandled rejection.
    const timeoutResult = await performReadinessChecks(sql, {
        snapshot0000Path: paths.snapshot0000Path,
        snapshot0001Path: paths.snapshot0001Path,
        migration0000SqlPath: paths.migration0000SqlPath,
        migration0001SqlPath: paths.migration0000SqlPath.replace('0000_wave0_initial.sql', '0001_restaurant_partial_index_adoption.sql'),
        journalPath: paths.snapshot0000Path.replace('meta/0000_snapshot.json', 'meta/_journal.json'),
        timeoutMs: 1,
    });
    equal(timeoutResult.ok, false, 'Expected timeout readiness result to be not ready');
    equal(timeoutResult.timedOut, true, 'Expected timedOut flag');
    ok(timeoutResult.checks.some((c) => c.name === 'readiness_timeout'), 'Expected readiness_timeout check');
    console.log('[readiness.test] timeout path: PASS');

    console.log('[readiness.test] ALL PASS');
};

run()
    .catch((error) => {
        console.error('[readiness.test] FAILED:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sql.end();
    });
