# Supabase Vault Restore Limitation

Task ID: Q360-PS-M6-S3

## Scope

This document records a known limitation for Q360 migration rehearsal and rollback planning when using Supabase Vault for encrypted secrets.

## Supabase Vault Behavior

Supabase Vault stores encrypted secrets using keys managed inside the Supabase project. A standard `pg_dump` / `pg_restore` of the Postgres database does **not** restore Vault secrets in a usable form across projects.

Specifically:

1. Vault secrets are encrypted with project-level keys that are not exported by `pg_dump`.
2. Restoring a dump into a different Supabase project (or a local database) will restore the Vault tables and functions, but the encrypted secret values cannot be decrypted because the destination project does not have the source encryption key.
3. This means a migration rollback that relies on restoring a Postgres dump cannot rely on Vault-decrypted secrets being available after the restore.

## Impact on Wave 0

Wave 0 does not use Supabase Vault secrets for the migration safety rehearsal. The rehearsal targets a disposable database and exercises schema-level changes only. However, this limitation must be recorded because future production rollback planning may assume a full database restore is sufficient.

## Mitigation

1. Store all application-critical secrets that are needed after a restore in a separate secret manager (for example, Railway variables, Vercel environment variables, or a dedicated vault) in addition to any Supabase Vault copies.
2. For rollback drills, provision a fresh disposable database and re-seed configuration from environment variables rather than expecting Vault secrets to survive restore.
3. If Vault secrets are required for a feature, document them in the runbook and plan a manual re-entry or re-encryption step after any cross-project restore.

## Rehearsal Rule

Because of this limitation, Wave 0 rollback evidence is based on schema fingerprint comparison, not on a full restore of encrypted secret state. The disposable database rehearsal proves the schema-level rollback path; secret restoration must be validated separately.
