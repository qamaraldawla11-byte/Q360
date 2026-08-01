# Wave 0 Disposable Migration Rehearsal Evidence Report

Task ID: Q360-PS-M6-S3

## Environment Confirmation

| Check | Result |
|-------|--------|
| Current branch | `clean/q360-core-m1-r5` |
| Worktree | `D:/VS CODE App/Q360/.worktrees/q360-core-m1-r5` |
| Git commit | `3ce713c75cb6dfa4122878ecce9a436f7d411316` |
| Production credentials configured | None found (only `.env.example` templates present) |
| Staging backup artifact path | No artifact present in workspace (`Q360_WAVE0_BACKUP_ARTIFACT_PATH` unset) |
| Disposable target | `postgresql://q360:wave0@127.0.0.1:5433/q360-staging` via Docker container `q360-wave0-disposable` (destroyed after rehearsal) |

## Deliverables Created

| Deliverable | File |
|-------------|------|
| Wave 0 migration boundaries | `docs/WAVE_0_MIGRATION_BOUNDARIES.md` |
| Non-interactive migration handler | `backend/src/scripts/migrate_noninteractive.ts` |
| Migration manifest generator | `backend/src/scripts/generate_migration_manifest.ts` |
| Schema fingerprint library | `backend/src/scripts/schema_fingerprint.ts` |
| Manifest finalizer | `backend/src/scripts/finalize_wave0_manifest.ts` |
| Canonical partial unique indexes doc | `docs/RESTAURANT_PARTIAL_UNIQUE_INDEXES_CANONICAL.md` |
| Migration manifest template | `docs/MIGRATION_MANIFEST_TEMPLATE.md` |
| `/readyz` readiness contract | `docs/READYZ_READINESS_CONTRACT.md` |
| Supabase Vault restore limitation | `docs/SUPABASE_VAULT_RESTORE_LIMITATION.md` |
| Evidence report | `docs/WAVE_0_DISPOSABLE_REHEARSAL_EVIDENCE_REPORT.md` |

## Modified Files

- `.gitignore` — ignore generated migration evidence directories.
- `backend/package.json` — add `db:push:staging` and `migrate:wave0` scripts.
- `backend/src/index.ts` — add `/readyz` readiness endpoint.

## Commands Executed

```bash
# 1. Confirm environment identity
git branch --show-current
git rev-parse --show-toplevel
git worktree list

# 2. Start disposable PostgreSQL container
docker run -d --name q360-wave0-disposable \
  -e POSTGRES_USER=q360 -e POSTGRES_PASSWORD=wave0 -e POSTGRES_DB=q360-staging \
  -p 127.0.0.1:5433:5432 postgres:16-alpine

# 3. Test database connectivity (temporary script, deleted after use)
Q360_DATABASE_ENV=staging Q360_DATABASE_NAME=q360-staging \
  DATABASE_URL="postgresql://q360:wave0@127.0.0.1:5433/q360-staging" \
  POSTGRES_SSL=false JWT_SECRET=wave0-rehearsal-secret \
  npx tsx src/scripts/_test_connection.ts

# 4. Capture baseline empty schema dump
pg_dump -h 127.0.0.1 -p 5433 -U q360 -d "q360-staging" --schema-only \
  --no-owner --no-privileges > backend/wave0-temp/baseline-empty.sql

# 5. Fail-closed guard test (no staging markers)
DATABASE_URL="postgresql://q360:wave0@127.0.0.1:5433/q360-staging" \
  POSTGRES_SSL=false JWT_SECRET=wave0-rehearsal-secret \
  npx tsx src/scripts/migrate_noninteractive.ts
# Result: blocked with "db:push:staging is blocked: set Q360_DATABASE_ENV=staging"

# 6. Run non-interactive migration rehearsal
Q360_DATABASE_ENV=staging Q360_DATABASE_NAME=q360-staging \
  DATABASE_URL="postgresql://q360:wave0@127.0.0.1:5433/q360-staging" \
  POSTGRES_SSL=false JWT_SECRET=wave0-rehearsal-secret \
  npm run migrate:wave0

# 7. Verify Restaurant service-flow and partial unique indexes
Q360_DATABASE_ENV=staging Q360_DATABASE_NAME=q360-staging \
  DATABASE_URL="postgresql://q360:wave0@127.0.0.1:5433/q360-staging" \
  POSTGRES_SSL=false JWT_SECRET=wave0-rehearsal-secret \
  npm run verify:restaurant-service-flow

# 8. Finalize manifest with final fingerprint
Q360_DATABASE_ENV=staging Q360_DATABASE_NAME=q360-staging \
  DATABASE_URL="postgresql://q360:wave0@127.0.0.1:5433/q360-staging" \
  POSTGRES_SSL=false JWT_SECRET=wave0-rehearsal-secret \
  npx tsx src/scripts/finalize_wave0_manifest.ts

# 9. Capture migrated schema dump
pg_dump -h 127.0.0.1 -p 5433 -U q360 -d "q360-staging" --schema-only \
  --no-owner --no-privileges > backend/wave0-temp/migrated.sql

# 10. Rollback: drop and recreate disposable database
psql -h 127.0.0.1 -p 5433 -U q360 -d postgres -c 'DROP DATABASE IF EXISTS "q360-staging";'
psql -h 127.0.0.1 -p 5433 -U q360 -d postgres -c 'CREATE DATABASE "q360-staging";'

# 11. Capture rollback fingerprint (temporary script, deleted after use)
Q360_DATABASE_ENV=staging Q360_DATABASE_NAME=q360-staging \
  DATABASE_URL="postgresql://q360:wave0@127.0.0.1:5433/q360-staging" \
  POSTGRES_SSL=false JWT_SECRET=wave0-rehearsal-secret \
  npx tsx src/scripts/_capture_rollback.ts

# 12. Record rollback evidence in manifest (temporary script, deleted after use)
Q360_DATABASE_ENV=staging Q360_DATABASE_NAME=q360-staging \
  DATABASE_URL="postgresql://q360:wave0@127.0.0.1:5433/q360-staging" \
  POSTGRES_SSL=false JWT_SECRET=wave0-rehearsal-secret \
  ROLLBACK_FINGERPRINT_PATH=wave0-temp/rollback-fingerprint.json \
  npx tsx src/scripts/_record_rollback.ts

# 13. Verify /health and /readyz endpoints
Q360_DATABASE_ENV=staging Q360_DATABASE_NAME=q360-staging \
  DATABASE_URL="postgresql://q360:wave0@127.0.0.1:5433/q360-staging" \
  POSTGRES_SSL=false JWT_SECRET=wave0-rehearsal-secret PORT=3001 \
  npx tsx src/index.ts &
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3001/readyz

# 14. Destroy disposable container
docker stop q360-wave0-disposable
docker rm q360-wave0-disposable
```

## Verification Results

| Command | Status | Exit Code | Summary |
|---------|--------|-----------|---------|
| `db:push:staging` fail-closed test | passed | non-zero (expected block) | Guard blocked the command when `Q360_DATABASE_ENV` was unset. |
| `migrate:wave0` (non-interactive push) | passed | 0 | Drizzle schema push completed; tables went from 0 to 35. |
| `verify:restaurant-service-flow` | passed | 0 | Restaurant lifecycle verification passed; partial unique indexes created and exercised. |
| `/health` endpoint | passed | 200 | Returns `{ status: "running" }`. |
| `/readyz` endpoint | passed | 200 | Returns `{ status: "ready", checks: { database: { status: "pass", responseMs: 38 } } }`. |

## Schema Fingerprints

| Phase | Tables | File | Hash (schema-only) |
|-------|--------|------|--------------------|
| Before migration | 0 | `backend/migration-manifests/2026-07-31T16-11-35-135Z-3ce713c7-a862371f-before.json` | `sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| After migration | 35 | `backend/migration-manifests/2026-07-31T16-11-35-135Z-3ce713c7-a862371f-after.json` | `sha256:a24807f8a206ebd58f26b8ca4ebb68326cf4999ae1f2bf5263dd37e02e8c6fb6` |
| Final (after verify) | 35 | `backend/migration-manifests/2026-07-31T16-11-35-135Z-3ce713c7-a862371f-final.json` | `sha256:86df76e67a8a70a3783b0cbc63f2d18c02b94cf9cb89bba727853c2db36f640d` |
| After rollback | 0 | `backend/wave0-temp/rollback-fingerprint.json` | `sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |

The final fingerprint includes the canonical partial unique indexes:

- `restaurant_orders_business_idempotency_key_idx` — `(business_id, idempotency_key) WHERE idempotency_key IS NOT NULL`
- `restaurant_orders_business_daily_visible_number_idx` — `(business_id, order_number_date, visible_order_number) WHERE visible_order_number IS NOT NULL AND order_number_date IS NOT NULL`

## Rollback Evidence

| Item | Value |
|------|-------|
| Strategy | drop-and-recreate-disposable-database |
| Target | `q360-staging` disposable local database |
| Executed | true |
| Before rollback fingerprint hash | `sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| After rollback fingerprint hash | `sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| Matches before fingerprint | true |

Rollback was achieved by dropping the disposable database and recreating it empty. The post-rollback schema fingerprint matches the before-migration fingerprint.

## Known Exceptions

1. **Missing encrypted staging backup artifact** (medium severity)
   - No staging backup artifact was present in the workspace and `Q360_WAVE0_BACKUP_ARTIFACT_PATH` was unset.
   - The rehearsal therefore ran against a freshly created disposable local database instead of a database restored from an encrypted staging backup.
   - Mitigation: obtain the confirmed staging backup artifact, set `Q360_WAVE0_BACKUP_ARTIFACT_PATH`, restore it into a disposable database, and rerun the rehearsal before approving the manifest.

2. **Supabase Vault restore limitation** (low severity)
   - Standard `pg_dump`/`pg_restore` does not carry Supabase Vault encryption keys across projects.
   - Wave 0 is schema-only, so this does not affect the rehearsal, but it must be accounted for in production rollback planning.
   - See `docs/SUPABASE_VAULT_RESTORE_LIMITATION.md`.

## Safety Compliance

| Requirement | Status |
|-------------|--------|
| No production database access | ✓ |
| No staging database writes | ✓ (only disposable local DB was written) |
| No Railway deployment | ✓ |
| No Vercel deployment | ✓ |
| No interactive `db:push` | ✓ (used `--force` non-interactive push) |
| No destructive SQL/truncation | ✓ (only schema push against disposable DB) |
| No unrelated features | ✓ |
| No branch cleanup | ✓ |
| No credential disclosure | ✓ (disposable local credentials only; not committed) |
| Protected areas unchanged | ✓ (OTP, tenant identity, Restaurant lifecycle, payments, KDS, deployment safety config untouched) |

## Verdict

**PARTIAL**

Wave 0 successfully delivered the migration safety foundation: boundaries, non-interactive migration handling, canonical partial unique index documentation, schema fingerprint capture, migration manifest, `/readyz` readiness contract, and rollback evidence. The fail-closed guard, migration, verification, and rollback were all exercised against a disposable local database and produced matching before/rollback fingerprints.

The verdict is **PARTIAL** rather than **PASS** because the rehearsal did not start from an encrypted staging backup artifact. The manifest records this exception and the mitigation required before approval.
