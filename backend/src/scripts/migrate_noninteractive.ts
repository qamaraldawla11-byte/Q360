import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import postgres from 'postgres';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';
import { captureSchemaFingerprint } from './schema_fingerprint.js';
import { generateManifest, type VerificationResult } from './generate_migration_manifest.js';
import {
    captureActualCatalog,
    compareCatalogs,
    defaultSnapshotPaths,
    generateAdditiveReconcileSql,
    loadExpectedCatalog,
    scanSqlForDestructiveStatements,
    verifyCatalogEquivalence,
} from '../services/baseline_catalog.js';
import { seedJournal } from './baseline_seed_journal.js';

loadDotenv({ path: process.env.DOTENV_CONFIG_PATH || '.env', quiet: true });

const COMMAND_NAME = 'db:migrate:staging';

requireQ360StagingDatabaseGuard(COMMAND_NAME);

const databaseUrl = requireDatabaseUrl();

// --- database identity guard -------------------------------------------------
// The staging guard above confirms intent. This guard confirms the exact host
// so the operator cannot accidentally target the wrong database through a
// shared connection string or environment mix-up.
const requireDatabaseIdentity = (url: string): void => {
    const allowlist = process.env.Q360_DATABASE_HOST_ALLOWLIST?.trim();
    if (!allowlist) {
        throw new Error(`${COMMAND_NAME} is blocked: Q360_DATABASE_HOST_ALLOWLIST is not configured.`);
    }
    const allowed = allowlist
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!allowed.some((a) => a.toLowerCase() === host)) {
        throw new Error(`${COMMAND_NAME} is blocked: database host "${host}" is not in Q360_DATABASE_HOST_ALLOWLIST.`);
    }
};

requireDatabaseIdentity(databaseUrl);

// --- journal handling --------------------------------------------------------
interface JournalEntry {
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
}

interface JournalFile {
    version: string;
    dialect: string;
    entries: JournalEntry[];
}

const loadJournal = async (journalPath: string): Promise<JournalFile> => {
    const content = await readFile(journalPath, 'utf8');
    return JSON.parse(content) as JournalFile;
};

interface MigrationPaths {
    firstBaselineEntry: JournalEntry;
    finalEntry: JournalEntry;
    firstBaselinePaths: {
        snapshot0000Path: string;
        migration0000SqlPath: string;
        journalPath: string;
    };
    finalSnapshotPath: string;
}

const getMigrationPaths = (cwd: string, entries: JournalEntry[]): MigrationPaths => {
    if (entries.length === 0) {
        throw new Error('Drizzle journal contains no entries; nothing to migrate.');
    }
    const first = entries[0];
    const last = entries[entries.length - 1];
    const snapshotPath = (idx: number) =>
        path.join(cwd, 'drizzle', 'meta', `${String(idx).padStart(4, '0')}_snapshot.json`);
    return {
        firstBaselineEntry: first,
        finalEntry: last,
        firstBaselinePaths: {
            snapshot0000Path: snapshotPath(first.idx),
            migration0000SqlPath: path.join(cwd, 'drizzle', `${first.tag}.sql`),
            journalPath: path.join(cwd, 'drizzle', 'meta', '_journal.json'),
        },
        finalSnapshotPath: snapshotPath(last.idx),
    };
};

// --- helpers -----------------------------------------------------------------
const runCommand = (
    command: string,
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv; shell?: boolean },
): Promise<{ exitCode: number; stdout: string; stderr: string }> =>
    new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: options.env,
            shell: options.shell ?? false,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
        child.on('close', (exitCode) => {
            resolve({ exitCode: exitCode ?? 1, stdout, stderr });
        });
    });

const sha256Hex = async (filePath: string): Promise<string> => {
    const bytes = await readFile(filePath);
    return createHash('sha256').update(bytes).digest('hex');
};

const sha256String = (value: string): string => createHash('sha256').update(value).digest('hex');

const drizzleMigrate = async (cwd: string): Promise<VerificationResult> => {
    const migrate = await runCommand('npx', ['drizzle-kit', 'migrate'], { cwd, env: process.env, shell: true });
    if (migrate.stdout) process.stdout.write(migrate.stdout);
    if (migrate.stderr) process.stderr.write(migrate.stderr);
    return {
        command: 'npx drizzle-kit migrate',
        status: migrate.exitCode === 0 ? 'passed' : 'failed',
        exitCode: migrate.exitCode,
        summary: migrate.exitCode === 0
            ? 'Drizzle non-interactive migrate completed.'
            : `Drizzle migrate failed with exit code ${migrate.exitCode}.`,
    };
};

const isPublicSchemaEmpty = async (sql: postgres.Sql): Promise<boolean> => {
    const rows = await sql`
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        LIMIT 1
    `;
    return rows.length === 0;
};

const hasJournalRowForHash = async (sql: postgres.Sql, hash: string): Promise<boolean> => {
    try {
        const rows = await sql`
            SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${hash} LIMIT 1
        `;
        return rows.length > 0;
    } catch {
        return false;
    }
};

const writeReconcileFile = async (baseDir: string, sqlText: string): Promise<string> => {
    const dir = path.join(baseDir, 'drizzle-baseline');
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, '0001_staging_reconcile.sql');
    await writeFile(filePath, sqlText);
    return filePath;
};

// --- migration tracks --------------------------------------------------------
const runEmptyPath = async ({
    cwd,
    sql,
    fingerprintClient,
    paths,
}: {
    cwd: string;
    sql: postgres.Sql;
    fingerprintClient: postgres.Sql;
    paths: MigrationPaths;
}): Promise<{
    beforeFingerprint: any;
    afterFingerprint: any;
    verificationResults: VerificationResult[];
}> => {
    const beforeFingerprint = await captureSchemaFingerprint(fingerprintClient);
    console.log(`[migrate_noninteractive] Empty public schema detected. Running Track A empty-database migration...`);

    const migrateResult = await drizzleMigrate(cwd);
    const verificationResults: VerificationResult[] = [migrateResult];

    // Empty path must land on the exact final snapshot target.
    const strictVerification = await verifyCatalogEquivalence(sql, {
        snapshot0000Path: paths.finalSnapshotPath,
        mode: 'strict',
        allowExtraTableNames: ['q360_baseline_provenance'],
    });
    if (!strictVerification.ok) {
        console.error(JSON.stringify(strictVerification.diffs, null, 2));
        throw new Error(`Track A final catalog does not match expected ${paths.finalEntry.tag} target.`);
    }

    // Record genesis baseline provenance for /readyz. The first baseline journal
    // row is already present from drizzle-kit migrate, so seedJournal will skip
    // the insert if it already exists.
    const { execSync } = await import('child_process');
    const repositoryCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    await seedJournal(sql, {
        migration0000SqlPath: paths.firstBaselinePaths.migration0000SqlPath,
        journalPath: paths.firstBaselinePaths.journalPath,
        tag: paths.firstBaselineEntry.tag,
        provenance: {
            backup_checksum: '',
            repository_commit: repositoryCommit,
            restored_fingerprint_hash: '',
            verification_report_hash: sha256String(JSON.stringify(strictVerification)),
            timestamp: new Date().toISOString(),
            operator_marker: process.env.USER || 'unknown',
            baseline_marker: 'genesis',
        },
        skipCatalogVerification: true,
    });

    const afterFingerprint = await captureSchemaFingerprint(fingerprintClient);
    return { beforeFingerprint, afterFingerprint, verificationResults };
};

const runLegacyPath = async ({
    cwd,
    sql,
    fingerprintClient,
    backupChecksum,
    paths,
}: {
    cwd: string;
    sql: postgres.Sql;
    fingerprintClient: postgres.Sql;
    backupChecksum: string | null;
    paths: MigrationPaths;
}): Promise<{
    beforeFingerprint: any;
    afterFingerprint: any;
    verificationResults: VerificationResult[];
}> => {
    const beforeFingerprint = await captureSchemaFingerprint(fingerprintClient);
    console.log(`[migrate_noninteractive] Non-empty legacy schema detected. Running Track B restored-baseline migration...`);

    // Idempotent re-run: if the schema already matches the final committed
    // target, skip the reconcile step and just let drizzle-kit migrate confirm
    // there is nothing left to apply.
    const finalExpected = await loadExpectedCatalog({ snapshot0000Path: paths.finalSnapshotPath });
    const actualCatalog = await captureActualCatalog(sql);
    const finalPreCheck = compareCatalogs(finalExpected, actualCatalog, {
        mode: 'strict',
        allowExtraTableNames: ['q360_baseline_provenance'],
    });
    if (finalPreCheck.ok) {
        console.log('[migrate_noninteractive] Schema already matches final target; skipping reconcile.');
        const migrateResult = await drizzleMigrate(cwd);
        const verificationResults: VerificationResult[] = [migrateResult];
        const finalVerification = await verifyCatalogEquivalence(sql, {
            snapshot0000Path: paths.finalSnapshotPath,
            mode: 'strict',
            allowExtraTableNames: ['q360_baseline_provenance'],
        });
        if (!finalVerification.ok) {
            console.error(JSON.stringify(finalVerification.diffs, null, 2));
            throw new Error('Final catalog verification failed after idempotent drizzle-kit migrate.');
        }
        const afterFingerprint = await captureSchemaFingerprint(fingerprintClient);
        return { beforeFingerprint, afterFingerprint, verificationResults };
    }

    // Reconcile the legacy schema to the first baseline, then apply the full
    // committed journal via drizzle-kit migrate.
    const firstPaths = defaultSnapshotPaths(cwd);
    const expected = await loadExpectedCatalog(firstPaths);
    const actual = await captureActualCatalog(sql);

    // Pre-reconcile: no unexpected or drifted objects; missing objects are allowed.
    const preCheck = compareCatalogs(expected, actual, {
        mode: 'pre_reconcile',
        allowExtraTableNames: ['q360_baseline_provenance'],
    });
    if (!preCheck.ok) {
        console.error(JSON.stringify(preCheck.diffs, null, 2));
        throw new Error('Pre-reconcile catalog check failed: legacy schema contains unexpected or drifted objects.');
    }

    const migration0000Hash = await sha256Hex(firstPaths.migration0000SqlPath);
    const alreadySeeded = await hasJournalRowForHash(sql, migration0000Hash);
    const alreadyEquivalent = (await verifyCatalogEquivalence(sql, {
        snapshot0000Path: firstPaths.snapshot0000Path,
        snapshot0001Path: firstPaths.snapshot0001Path,
        mode: 'strict',
        allowExtraTableNames: ['q360_baseline_provenance'],
    })).ok;

    const verificationResults: VerificationResult[] = [];

    if (!alreadySeeded || !alreadyEquivalent) {
        const reconcile = await generateAdditiveReconcileSql(sql, firstPaths);
        const reconcileFilePath = await writeReconcileFile(cwd, reconcile.sql);
        console.log(`[migrate_noninteractive] Reconcile SQL written to ${reconcileFilePath}`);
        console.log(
            `[migrate_noninteractive] Reconcile delta: ${reconcile.missingTables.length} tables, ` +
            `${reconcile.missingColumns.length} columns, ` +
            `${reconcile.missingUniqueConstraints.length} constraints, ` +
            `${reconcile.missingIndexes.length} indexes.`,
        );

        const scan = scanSqlForDestructiveStatements(reconcile.sql);
        if (!scan.safe) {
            console.error(JSON.stringify(scan.violations, null, 2));
            throw new Error('Destructive-SQL gate failed for reconcile script.');
        }
        verificationResults.push({
            command: 'destructive-sql-scan',
            status: 'passed',
            exitCode: 0,
            summary: `Scanned ${scan.violations.length} prohibited patterns; none found.`,
        });

        const statements = reconcile.sql
            .split('\n\n')
            .map((s) => s.trim())
            .filter(Boolean);
        await sql.begin(async (trx) => {
            for (const stmt of statements) {
                await trx.unsafe(stmt);
            }
        });

        const postReconcile = await verifyCatalogEquivalence(sql, {
            snapshot0000Path: firstPaths.snapshot0000Path,
            snapshot0001Path: firstPaths.snapshot0001Path,
            mode: 'strict',
            allowExtraTableNames: ['q360_baseline_provenance'],
        });
        if (!postReconcile.ok) {
            console.error(JSON.stringify(postReconcile.diffs, null, 2));
            throw new Error('Post-reconcile catalog verification failed: schema is not equivalent to first baseline.');
        }

        const { execSync } = await import('child_process');
        const repositoryCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        const verificationReportContent = JSON.stringify(postReconcile);
        const verificationReportHash = sha256String(verificationReportContent);

        await seedJournal(sql, {
            migration0000SqlPath: firstPaths.migration0000SqlPath,
            journalPath: path.join(firstPaths.snapshot0000Path, '..', '_journal.json'),
            tag: paths.firstBaselineEntry.tag,
            provenance: {
                backup_checksum: backupChecksum || '',
                repository_commit: repositoryCommit,
                restored_fingerprint_hash: '',
                verification_report_hash: verificationReportHash,
                timestamp: new Date().toISOString(),
                operator_marker: process.env.USER || 'unknown',
                baseline_marker: 'restored',
            },
            snapshot0000Path: firstPaths.snapshot0000Path,
            snapshot0001Path: firstPaths.snapshot0001Path,
            skipCatalogVerification: false,
        });
        console.log('[migrate_noninteractive] First baseline journal seeded and baseline provenance recorded.');
    } else {
        console.log('[migrate_noninteractive] Legacy schema already reconciled and seeded; skipping reconcile.');
    }

    const migrateResult = await drizzleMigrate(cwd);
    verificationResults.push(migrateResult);
    if (migrateResult.status !== 'passed') {
        throw new Error('Drizzle migrate failed on legacy path.');
    }

    // Final strict verification against the full committed target.
    const finalVerification = await verifyCatalogEquivalence(sql, {
        snapshot0000Path: paths.finalSnapshotPath,
        mode: 'strict',
        allowExtraTableNames: ['q360_baseline_provenance'],
    });
    if (!finalVerification.ok) {
        console.error(JSON.stringify(finalVerification.diffs, null, 2));
        throw new Error(`Track B final catalog does not match expected ${paths.finalEntry.tag} target.`);
    }

    const afterFingerprint = await captureSchemaFingerprint(fingerprintClient);
    return { beforeFingerprint, afterFingerprint, verificationResults };
};

// --- entry point -------------------------------------------------------------
const main = async () => {
    const { execSync } = await import('child_process');
    const repositoryCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const repositoryBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();

    const backupArtifactPath = process.env.Q360_WAVE0_BACKUP_ARTIFACT_PATH ?? null;
    let backupChecksum: string | null = null;
    if (backupArtifactPath && existsSync(backupArtifactPath)) {
        backupChecksum = await sha256Hex(backupArtifactPath);
    }

    const cwd = process.cwd();
    const drizzleConfigPath = path.join(cwd, 'drizzle.config.ts');
    if (!existsSync(drizzleConfigPath)) {
        throw new Error(`Drizzle config not found at ${drizzleConfigPath}`);
    }

    const journalPath = path.join(cwd, 'drizzle', 'meta', '_journal.json');
    const journal = await loadJournal(journalPath);
    const paths = getMigrationPaths(cwd, journal.entries);

    const fingerprintClient = postgres(databaseUrl, {
        max: 1,
        ssl: process.env.POSTGRES_SSL === 'false' ? false : 'require',
    });

    let beforeFingerprint: any;
    let afterFingerprint: any;
    let verificationResults: VerificationResult[] = [];

    try {
        const empty = await isPublicSchemaEmpty(fingerprintClient);

        if (empty) {
            const result = await runEmptyPath({ cwd, sql: fingerprintClient, fingerprintClient, paths });
            beforeFingerprint = result.beforeFingerprint;
            afterFingerprint = result.afterFingerprint;
            verificationResults = result.verificationResults;
        } else {
            if (!backupChecksum) {
                throw new Error('Legacy schema detected but no verified backup checksum is available.');
            }
            const result = await runLegacyPath({
                cwd,
                sql: fingerprintClient,
                fingerprintClient,
                backupChecksum,
                paths,
            });
            beforeFingerprint = result.beforeFingerprint;
            afterFingerprint = result.afterFingerprint;
            verificationResults = result.verificationResults;
        }
    } finally {
        await fingerprintClient.end();
    }

    const exceptions: { category: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string; mitigation: string }[] = [];
    if (!backupChecksum) {
        exceptions.push({
            category: 'missing-backup-artifact',
            severity: 'medium',
            description: 'No encrypted staging backup artifact path was configured or found; migration rehearsal ran against a disposable database instead of a restored staging backup.',
            mitigation: 'Set Q360_WAVE0_BACKUP_ARTIFACT_PATH to the confirmed staging backup and rerun the rehearsal before approving the manifest.',
        });
    }

    exceptions.push({
        category: 'supabase-vault-exception',
        severity: 'low',
        description: 'The encrypted staging backup contains Supabase-managed system schemas (auth, storage, realtime, vault, extensions). These extension-managed schemas are excluded from the disposable restore; only the public application schema is reconciled.',
        mitigation: 'Confirm that the migration touches only the public schema; system schemas remain managed by Supabase.',
    });

    const failed = verificationResults.some((r) => r.status === 'failed');

    const result = await generateManifest({
        taskId: 'Q360-PS-M6-S3N-R3',
        repositoryCommit,
        repositoryBranch,
        migrationIdentifiers: journal.entries.map((e) => e.tag),
        backupArtifactPath,
        backupChecksum,
        beforeFingerprint,
        afterFingerprint,
        verificationResults,
        exceptions,
        baseDir: cwd,
    });

    console.log(`[migrate_noninteractive] Manifest written to: ${result.manifestPath}`);
    if (result.beforePath) console.log(`[migrate_noninteractive] Before fingerprint: ${result.beforePath}`);
    if (result.afterPath) console.log(`[migrate_noninteractive] After fingerprint: ${result.afterPath}`);

    if (failed) {
        process.exitCode = 1;
    }
};

main().catch((error) => {
    console.error('[migrate_noninteractive] Migration handler failed:', error);
    process.exitCode = 1;
});
