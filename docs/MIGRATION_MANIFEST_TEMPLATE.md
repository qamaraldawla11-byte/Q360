# Q360 Migration Manifest Template

Task ID: Q360-PS-M6-S3

## Purpose

Every Q360 schema migration that crosses the Wave 0 gate must produce a migration manifest. The manifest is the durable evidence record for reviewers and operators. It contains no secrets, credentials, or customer data.

## File Location

Manifests are written to:

```text
backend/migration-manifests/<timestamp>-<short-commit>-wave0.json
```

The directory is ignored by `.gitignore` because manifests are generated artifacts, but they must be retained in the deployment evidence package for the migration they describe.

## Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| `manifestVersion` | Manifest schema version. | `1.0.0` |
| `taskId` | Wave or task identifier. | `Q360-PS-M6-S3` |
| `repositoryCommit` | Full git commit SHA at migration time. | `3ce713c...` |
| `repositoryBranch` | Current branch name. | `clean/q360-core-m1-r5` |
| `migrationIdentifiers` | Human-readable identifiers for the migrations applied. | `["restaurant-service-flow-partial-indexes"]` |
| `backupArtifactPath` | Confirmed path to the encrypted staging backup artifact, or `null` if none. | `s3://q360-staging-backups/...` or `null` |
| `backupChecksum` | SHA-256 checksum of the backup artifact, or `null`. | `sha256:...` or `null` |
| `beforeFingerprintPath` | Path to the before-migration schema fingerprint file. | `backend/migration-manifests/...-before.json` |
| `afterFingerprintPath` | Path to the after-migration schema fingerprint file. | `backend/migration-manifests/...-after.json` |
| `beforeFingerprintHash` | SHA-256 hash of the serialized before fingerprint. | `sha256:...` |
| `afterFingerprintHash` | SHA-256 hash of the serialized after fingerprint. | `sha256:...` |
| `verificationResults` | List of verification commands and their outcomes. | See below. |
| `rollbackEvidence` | Evidence that the rollback path was exercised or simulated. | See below. |
| `approvalStatus` | One of `pending`, `approved`, `rejected`. | `pending` |
| `approvedBy` | Identifier of the approver, or `null`. | `null` |
| `timestamp` | ISO 8601 timestamp when the manifest was generated. | `2026-07-31T15:59:41.517Z` |
| `exceptions` | Known exceptions or deviations from the ideal procedure. | See below. |

## Verification Results Shape

```json
{
  "verificationResults": [
    {
      "command": "db:push:staging",
      "status": "passed",
      "exitCode": 0,
      "summary": "Drizzle schema push completed without destructive prompts."
    },
    {
      "command": "verify:restaurant-service-flow",
      "status": "passed",
      "exitCode": 0,
      "summary": "Partial unique indexes confirmed."
    }
  ]
}
```

Status values: `passed`, `failed`, `skipped`, `not_run`.

## Rollback Evidence Shape

```json
{
  "rollbackEvidence": {
    "strategy": "database-snapshot-restore",
    "target": "disposable-local-database",
    "executed": true,
    "beforeRollbackFingerprintHash": "sha256:...",
    "afterRollbackFingerprintHash": "sha256:...",
    "matchesBeforeFingerprint": true,
    "summary": "Restored disposable database from pre-migration snapshot; fingerprint matches before state."
  }
}
```

## Exceptions Shape

```json
{
  "exceptions": [
    {
      "category": "missing-backup-artifact",
      "severity": "medium",
      "description": "No encrypted staging backup artifact was present in the workspace; rehearsal used a fresh disposable local database instead.",
      "mitigation": "Future rehearsals must obtain the artifact from the confirmed staging backup path before execution."
    }
  ]
}
```

## Approval Rule

A manifest must remain in `pending` status until a human reviewer confirms:

1. The target database was disposable and isolated.
2. Fingerprints prove the intended schema change and no unintended change.
3. Verification results pass.
4. Rollback evidence is acceptable.
5. No production or staging database was modified.

Only then may `approvalStatus` be updated to `approved` and `approvedBy` populated.
