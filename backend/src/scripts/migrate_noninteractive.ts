import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import path from 'path';
import postgres from 'postgres';
import { config as loadDotenv } from 'dotenv';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';
import { captureSchemaFingerprint } from './schema_fingerprint.js';
import { generateManifest, type VerificationResult } from './generate_migration_manifest.js';
import { ensureRestaurantServiceFlowSchema } from '../db/restaurantServiceFlowMigration.js';

// Load environment from an explicit path if provided, otherwise from .env.
loadDotenv({ path: process.env.DOTENV_CONFIG_PATH || '.env', quiet: true });

const COMMAND_NAME = 'db:migrate:staging';

// Confirm the operator has explicitly marked this as a staging operation.
requireQ360StagingDatabaseGuard(COMMAND_NAME);

const databaseUrl = requireDatabaseUrl();

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

const sha256 = (value: string): string => `sha256:${createHash('sha256').update(value).digest('hex')}`;

const main = async () => {
    const { execSync } = await import('child_process');
    const repositoryCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const repositoryBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();

    // Confirm backup artifact path only; do not read the artifact here.
    const backupArtifactPath = process.env.Q360_WAVE0_BACKUP_ARTIFACT_PATH ?? null;
    const backupChecksum: string | null = backupArtifactPath && existsSync(backupArtifactPath)
        ? sha256(await (await import('fs/promises')).readFile(backupArtifactPath, 'utf8'))
        : null;

    if (!backupArtifactPath) {
        console.warn('[migrate_noninteractive] No Q360_WAVE0_BACKUP_ARTIFACT_PATH configured; rehearsal will run against a disposable database only.');
    } else if (!existsSync(backupArtifactPath)) {
        console.warn(`[migrate_noninteractive] Configured backup artifact not found: ${backupArtifactPath}`);
    } else {
        console.log(`[migrate_noninteractive] Backup artifact confirmed: ${backupArtifactPath}`);
    }

    // Create a short-lived Postgres client for fingerprint capture. This client
    // is separate from the application pool and is ended immediately after use.
    const fingerprintClient = postgres(databaseUrl, {
        max: 1,
        ssl: process.env.POSTGRES_SSL === 'false' ? false : 'require',
    });

    let beforeFingerprint;
    let afterFingerprint;
    let pushResult: VerificationResult;

    try {
        console.log('[migrate_noninteractive] Capturing before-migration schema fingerprint...');
        beforeFingerprint = await captureSchemaFingerprint(fingerprintClient);
        console.log(`[migrate_noninteractive] Before fingerprint captured: ${beforeFingerprint.tables.length} tables.`);

        console.log('[migrate_noninteractive] Running non-interactive Drizzle migration...');
        const cwd = process.cwd();
        const drizzleConfigPath = path.join(cwd, 'drizzle.config.ts');
        if (!existsSync(drizzleConfigPath)) {
            throw new Error(`Drizzle config not found at ${drizzleConfigPath}`);
        }

        // Committed migrations are applied with `drizzle-kit migrate`. This is
        // deterministic and non-interactive: it executes the committed SQL files
        // in order and records progress in the `drizzle_migrations` journal
        // table. It never prompts, unlike `drizzle-kit push`, which can ask for
        // confirmation when adding unique constraints to tables that already
        // contain rows.
        const migrate = await runCommand(
            'npx drizzle-kit migrate',
            [],
            { cwd, env: process.env, shell: true },
        );

        // Stream output to the operator for transparency.
        if (migrate.stdout) process.stdout.write(migrate.stdout);
        if (migrate.stderr) process.stderr.write(migrate.stderr);

        if (migrate.exitCode !== 0) {
            throw new Error(`Drizzle migrate failed with exit code ${migrate.exitCode}.`);
        }

        // Apply the canonical Restaurant partial unique indexes idempotently.
        // These are not part of the Drizzle schema definition and must be
        // ensured after every Wave 0 migration run.
        console.log('[migrate_noninteractive] Ensuring canonical Restaurant partial unique indexes...');
        await ensureRestaurantServiceFlowSchema();
        console.log('[migrate_noninteractive] Canonical indexes ensured.');

        pushResult = {
            command: COMMAND_NAME,
            status: migrate.exitCode === 0 ? 'passed' : 'failed',
            exitCode: migrate.exitCode,
            summary: migrate.exitCode === 0
                ? 'Drizzle non-interactive migrate completed; canonical indexes ensured.'
                : `Drizzle migrate failed with exit code ${migrate.exitCode}.`,
        };

        console.log('[migrate_noninteractive] Capturing after-migration schema fingerprint...');
        afterFingerprint = await captureSchemaFingerprint(fingerprintClient);
        console.log(`[migrate_noninteractive] After fingerprint captured: ${afterFingerprint.tables.length} tables.`);
    } finally {
        await fingerprintClient.end();
    }

    const exceptions: { category: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string; mitigation: string }[] = [];
    if (!backupArtifactPath) {
        exceptions.push({
            category: 'missing-backup-artifact',
            severity: 'medium',
            description: 'No encrypted staging backup artifact path was configured or found; migration rehearsal ran against a disposable database instead of a restored staging backup.',
            mitigation: 'Set Q360_WAVE0_BACKUP_ARTIFACT_PATH to the confirmed staging backup and rerun the rehearsal before approving the manifest.',
        });
    }

    const result = await generateManifest({
        taskId: 'Q360-PS-M6-S3',
        repositoryCommit,
        repositoryBranch,
        migrationIdentifiers: ['drizzle-schema-push', 'restaurant-service-flow-partial-indexes'],
        backupArtifactPath,
        backupChecksum,
        beforeFingerprint,
        afterFingerprint,
        verificationResults: [pushResult],
        exceptions,
    });

    console.log(`[migrate_noninteractive] Manifest written to: ${result.manifestPath}`);
    if (result.beforePath) console.log(`[migrate_noninteractive] Before fingerprint: ${result.beforePath}`);
    if (result.afterPath) console.log(`[migrate_noninteractive] After fingerprint: ${result.afterPath}`);

    if (pushResult.status !== 'passed') {
        process.exitCode = 1;
    }
};

main().catch((error) => {
    console.error('[migrate_noninteractive] Migration handler failed:', error);
    process.exitCode = 1;
});
