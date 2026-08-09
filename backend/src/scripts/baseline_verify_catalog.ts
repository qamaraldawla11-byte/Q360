import { config as loadDotenv } from 'dotenv';
import postgres from 'postgres';
import { requireDatabaseUrl } from '../utils/env.js';
import { verifyCatalogEquivalence, defaultSnapshotPaths } from '../services/baseline_catalog.js';

// Load environment from an explicit path if provided, otherwise from .env.
loadDotenv({ path: process.env.DOTENV_CONFIG_PATH || '.env', quiet: true });

const run = async () => {
    const args = process.argv.slice(2);
    const modeArg = args.find((a) => a.startsWith('--mode='))?.slice('--mode='.length);
    const mode = modeArg === 'pre_reconcile' ? 'pre_reconcile' : 'strict';
    const baseDirArg = args.find((a) => a.startsWith('--base-dir='))?.slice('--base-dir='.length);

    const databaseUrl = requireDatabaseUrl();
    const paths = defaultSnapshotPaths(baseDirArg);

    const sql = postgres(databaseUrl, {
        max: 1,
        ssl: process.env.POSTGRES_SSL === 'false' ? false : 'require',
    });

    try {
        const report = await verifyCatalogEquivalence(sql, {
            snapshot0000Path: paths.snapshot0000Path,
            snapshot0001Path: paths.snapshot0001Path,
            mode,
            allowExtraTableNames: ['q360_baseline_provenance'],
        });

        const output = {
            ...report,
            mode,
            database: databaseUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'),
        };

        console.log(JSON.stringify(output, null, 2));
        process.exitCode = report.ok ? 0 : 1;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(JSON.stringify({ ok: false, error: message }, null, 2));
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
};

await run();
