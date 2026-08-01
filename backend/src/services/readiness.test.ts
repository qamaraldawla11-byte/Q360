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
    console.log('[readiness.test] readiness OK: PASS');

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
