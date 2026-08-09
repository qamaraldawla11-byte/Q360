import { createHash } from 'crypto';
import { config as loadDotenv } from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';
import postgres from 'postgres';
import { requireDatabaseUrl } from '../utils/env.js';
import {
    verifyCatalogEquivalence,
    defaultSnapshotPaths,
    hashFile,
} from '../services/baseline_catalog.js';

loadDotenv({ path: process.env.DOTENV_CONFIG_PATH || '.env', quiet: true });

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

const sha256Hex = async (filePath: string): Promise<string> => {
    return hashFile(filePath);
};

const ensureBaselineProvenanceTable = async (sql: postgres.Sql) => {
    await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS public.q360_baseline_provenance (
            key text PRIMARY KEY NOT NULL,
            value text NOT NULL,
            recorded_at timestamp DEFAULT now() NOT NULL
        )
    `);
};

const ensureJournalTable = async (sql: postgres.Sql) => {
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
            id SERIAL PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint NOT NULL
        )
    `);
};

export const seedJournal = async (
    sql: postgres.Sql,
    options: {
        migration0000SqlPath: string;
        journalPath: string;
        tag: string;
        provenance: Record<string, string>;
        snapshot0000Path?: string;
        snapshot0001Path?: string;
        skipCatalogVerification?: boolean;
    },
) => {
    const journal = await loadJournal(options.journalPath);
    const entry = journal.entries.find((e) => e.tag === options.tag);
    if (!entry) {
        throw new Error(`Journal entry not found for tag ${options.tag}`);
    }

    if (!options.skipCatalogVerification) {
        const verification = await verifyCatalogEquivalence(sql, {
            snapshot0000Path: options.snapshot0000Path || defaultSnapshotPaths().snapshot0000Path,
            snapshot0001Path: options.snapshot0001Path,
            mode: 'strict',
        });
        if (!verification.ok) {
            throw new Error('Catalog verification failed before journal seed');
        }
    }

    const hash = await sha256Hex(options.migration0000SqlPath);

    await ensureJournalTable(sql);

    const existing = await sql`
        SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${hash} LIMIT 1
    `;

    if (existing.length === 0) {
        await sql`
            INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
            VALUES (${hash}, ${entry.when})
        `;
    }

    await ensureBaselineProvenanceTable(sql);
    const recordedAt = new Date().toISOString();
    for (const [key, value] of Object.entries(options.provenance)) {
        await sql`
            INSERT INTO public.q360_baseline_provenance (key, value, recorded_at)
            VALUES (${key}, ${value}, ${recordedAt})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, recorded_at = EXCLUDED.recorded_at
        `;
    }

    return { hash, createdAt: entry.when, recordedAt };
};

const run = async () => {
    const args = process.argv.slice(2);
    const getArg = (name: string): string | undefined =>
        args.find((a) => a.startsWith(`--${name}=`))?.slice(`--${name}=`.length);

    const baseDir = getArg('base-dir');
    const paths = defaultSnapshotPaths(baseDir);

    const operator = getArg('operator') || process.env.USER || 'unknown';
    const backupChecksum = getArg('backup-checksum') || process.env.Q360_WAVE0_BACKUP_CHECKSUM || '';
    const restoredFingerprintHash = getArg('restored-fingerprint-hash') || '';
    const verificationReportHash = getArg('verification-report-hash') || '';
    const genesis = args.includes('--genesis');
    const restored = args.includes('--restored');
    const marker = genesis ? 'genesis' : restored ? 'restored' : 'unknown';

    const databaseUrl = requireDatabaseUrl();
    const sql = postgres(databaseUrl, {
        max: 1,
        ssl: process.env.POSTGRES_SSL === 'false' ? false : 'require',
    });

    try {
        const verification = await verifyCatalogEquivalence(sql, {
            snapshot0000Path: paths.snapshot0000Path,
            snapshot0001Path: paths.snapshot0001Path,
            mode: 'strict',
        });
        if (!verification.ok) {
            console.error(
                JSON.stringify(
                    {
                        ok: false,
                        error: 'Catalog verification failed before journal seed',
                        diffs: verification.diffs,
                    },
                    null,
                    2,
                ),
            );
            process.exitCode = 1;
            return;
        }

        const { execSync } = await import('child_process');
        const repositoryCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

        const verificationReportContent = JSON.stringify(verification);
        const computedVerificationHash = createHash('sha256')
            .update(verificationReportContent)
            .digest('hex');

        const provenance: Record<string, string> = {
            backup_checksum: backupChecksum,
            repository_commit: repositoryCommit,
            restored_fingerprint_hash: restoredFingerprintHash,
            verification_report_hash: verificationReportHash || computedVerificationHash,
            timestamp: new Date().toISOString(),
            operator_marker: operator,
            baseline_marker: marker,
        };

        const result = await seedJournal(sql, {
            migration0000SqlPath: paths.migration0000SqlPath,
            journalPath: path.join(paths.snapshot0000Path, '..', '_journal.json'),
            tag: '0000_wave0_initial',
            provenance,
            snapshot0000Path: paths.snapshot0000Path,
            snapshot0001Path: paths.snapshot0001Path,
            skipCatalogVerification: false,
        });

        console.log(
            JSON.stringify(
                {
                    ok: true,
                    hash: result.hash,
                    createdAt: result.createdAt,
                    recordedAt: result.recordedAt,
                    provenance,
                },
                null,
                2,
            ),
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(JSON.stringify({ ok: false, error: message }, null, 2));
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
};

if (import.meta.url === `file://${process.argv[1]}`) {
    await run();
}
