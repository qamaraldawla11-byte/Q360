// Verification-only script for Q360-PS-CTO-B1-S5.
// Runs the same readiness checks as /readyz without starting the HTTP server.

import path from 'path';
import postgres from 'postgres';
import { queryClient } from '../db/client.js';
import { performReadinessChecks } from '../services/readiness.js';
import { defaultSnapshotPaths } from '../services/baseline_catalog.js';

const run = async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL is required');
        process.exit(1);
    }

    // Ensure the shared queryClient connects to the same database.
    // queryClient is already instantiated from db/client.js; we rely on DATABASE_URL being set.
    const sql = queryClient;

    const paths = defaultSnapshotPaths(process.cwd());

    const result = await performReadinessChecks(sql, {
        snapshot0000Path: paths.snapshot0000Path,
        snapshot0001Path: paths.snapshot0001Path,
        snapshot0004Path: path.join(paths.snapshot0000Path, '..', '0004_snapshot.json'),
        migration0000SqlPath: paths.migration0000SqlPath,
        migration0001SqlPath: path.join(paths.migration0000SqlPath, '..', '0001_restaurant_partial_index_adoption.sql'),
        journalPath: path.join(paths.snapshot0000Path, '..', '_journal.json'),
        timeoutMs: 10000,
    });

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
};

run();
