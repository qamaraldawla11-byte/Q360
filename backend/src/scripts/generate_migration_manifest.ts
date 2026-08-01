import { createHash, randomUUID } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';
import path from 'path';
import type { SchemaFingerprint } from './schema_fingerprint.js';

export type VerificationStatus = 'passed' | 'failed' | 'skipped' | 'not_run';

export interface VerificationResult {
    command: string;
    status: VerificationStatus;
    exitCode: number | null;
    summary: string;
}

export interface RollbackEvidence {
    strategy: string;
    target: string;
    executed: boolean;
    beforeRollbackFingerprintHash: string | null;
    afterRollbackFingerprintHash: string | null;
    matchesBeforeFingerprint: boolean | null;
    summary: string;
}

export interface MigrationException {
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    mitigation: string;
}

export interface MigrationManifest {
    manifestVersion: string;
    taskId: string;
    repositoryCommit: string;
    repositoryBranch: string;
    migrationIdentifiers: string[];
    backupArtifactPath: string | null;
    backupChecksum: string | null;
    beforeFingerprintPath: string | null;
    afterFingerprintPath: string | null;
    beforeFingerprintHash: string | null;
    afterFingerprintHash: string | null;
    verificationResults: VerificationResult[];
    rollbackEvidence: RollbackEvidence;
    approvalStatus: 'pending' | 'approved' | 'rejected';
    approvedBy: string | null;
    timestamp: string;
    exceptions: MigrationException[];
}

const MANIFEST_DIR = 'migration-manifests';

export const hashFingerprint = (fingerprint: SchemaFingerprint): string => {
    const serialized = JSON.stringify(fingerprint, Object.keys(fingerprint).sort());
    return `sha256:${createHash('sha256').update(serialized).digest('hex')}`;
};

export const hashFile = async (filePath: string): Promise<string> => {
    const content = await readFile(filePath);
    return `sha256:${createHash('sha256').update(content).digest('hex')}`;
};

export const generateManifest = async (options: {
    taskId: string;
    repositoryCommit: string;
    repositoryBranch: string;
    migrationIdentifiers: string[];
    backupArtifactPath?: string | null;
    backupChecksum?: string | null;
    beforeFingerprint?: SchemaFingerprint | null;
    afterFingerprint?: SchemaFingerprint | null;
    verificationResults?: VerificationResult[];
    rollbackEvidence?: Partial<RollbackEvidence>;
    exceptions?: MigrationException[];
    baseDir?: string;
}): Promise<{ manifest: MigrationManifest; manifestPath: string; beforePath: string | null; afterPath: string | null }> => {
    const baseDir = options.baseDir ?? process.cwd();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const shortCommit = options.repositoryCommit.slice(0, 8);
    const runId = `${timestamp}-${shortCommit}-${randomUUID().slice(0, 8)}`;
    const manifestDir = path.join(baseDir, MANIFEST_DIR);
    await mkdir(manifestDir, { recursive: true });

    let beforePath: string | null = null;
    let afterPath: string | null = null;
    let beforeHash: string | null = null;
    let afterHash: string | null = null;

    if (options.beforeFingerprint) {
        beforePath = path.join(MANIFEST_DIR, `${runId}-before.json`);
        await writeFile(path.join(baseDir, beforePath), JSON.stringify(options.beforeFingerprint, null, 2));
        beforeHash = hashFingerprint(options.beforeFingerprint);
    }

    if (options.afterFingerprint) {
        afterPath = path.join(MANIFEST_DIR, `${runId}-after.json`);
        await writeFile(path.join(baseDir, afterPath), JSON.stringify(options.afterFingerprint, null, 2));
        afterHash = hashFingerprint(options.afterFingerprint);
    }

    const manifest: MigrationManifest = {
        manifestVersion: '1.0.0',
        taskId: options.taskId,
        repositoryCommit: options.repositoryCommit,
        repositoryBranch: options.repositoryBranch,
        migrationIdentifiers: options.migrationIdentifiers,
        backupArtifactPath: options.backupArtifactPath ?? null,
        backupChecksum: options.backupChecksum ?? null,
        beforeFingerprintPath: beforePath,
        afterFingerprintPath: afterPath,
        beforeFingerprintHash: beforeHash,
        afterFingerprintHash: afterHash,
        verificationResults: options.verificationResults ?? [],
        rollbackEvidence: {
            strategy: 'none',
            target: 'none',
            executed: false,
            beforeRollbackFingerprintHash: null,
            afterRollbackFingerprintHash: null,
            matchesBeforeFingerprint: null,
            summary: 'Rollback evidence not yet recorded.',
            ...options.rollbackEvidence,
        },
        approvalStatus: 'pending',
        approvedBy: null,
        timestamp: new Date().toISOString(),
        exceptions: options.exceptions ?? [],
    };

    const manifestPath = path.join(MANIFEST_DIR, `${runId}-manifest.json`);
    await writeFile(path.join(baseDir, manifestPath), JSON.stringify(manifest, null, 2));

    return { manifest, manifestPath, beforePath, afterPath };
};

/**
 * CLI entry point for generating a manifest from pre-existing fingerprint files.
 * Usage from backend/:
 *   npx tsx src/scripts/generate_migration_manifest.ts \
 *     --before=path/to/before.json \
 *     --after=path/to/after.json \
 *     --task-id=Q360-PS-M6-S3 \
 *     --backup-artifact=null
 */
const runCli = async () => {
    const args = process.argv.slice(2);
    const getArg = (name: string): string | undefined => {
        const prefix = `--${name}=`;
        return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
    };

    const taskId = getArg('task-id') ?? 'Q360-PS-M6-S3';
    const beforePath = getArg('before');
    const afterPath = getArg('after');
    const backupArtifactPath = getArg('backup-artifact') ?? null;
    const backupChecksum = getArg('backup-checksum') ?? null;

    const { execSync } = await import('child_process');
    const repositoryCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const repositoryBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();

    const beforeFingerprint = beforePath
        ? (JSON.parse(await readFile(beforePath, 'utf8')) as SchemaFingerprint)
        : null;
    const afterFingerprint = afterPath
        ? (JSON.parse(await readFile(afterPath, 'utf8')) as SchemaFingerprint)
        : null;

    const result = await generateManifest({
        taskId,
        repositoryCommit,
        repositoryBranch,
        migrationIdentifiers: ['wave0-disposable-rehearsal'],
        backupArtifactPath: backupArtifactPath === 'null' ? null : backupArtifactPath,
        backupChecksum: backupChecksum === 'null' ? null : backupChecksum,
        beforeFingerprint,
        afterFingerprint,
        verificationResults: [],
        exceptions: [],
    });

    console.log(`Manifest written to: ${result.manifestPath}`);
    if (result.beforePath) console.log(`Before fingerprint: ${result.beforePath}`);
    if (result.afterPath) console.log(`After fingerprint: ${result.afterPath}`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}
