# Railway Deployment Schema Flow

## Current repository configuration

The repository defines backend build, startup, and health-check behavior. Database schema mutation is intentionally **not** part of the deployment pipeline.

- `railway.json`
  - Build Command: `cd backend && npm ci --include=dev && npm run build`
  - Start Command: `cd backend && npm start`
  - Health check path: `/health`
- `Procfile`
  - `web: cd backend && npm start`
- `backend/package.json`
  - `npm start` runs `node dist/index.js`
  - `npm run build` runs `tsc`
  - `npm run db:migrate:staging` runs the guarded, journal-aware migration handler
- `backend/drizzle.config.ts`
  - Uses `backend/src/db/schema.ts`
  - Reads `DATABASE_URL`
  - Reads `POSTGRES_SSL`
- `backend/src/scripts/migrate_noninteractive.ts`
  - Reads `backend/drizzle/meta/_journal.json`
  - Applies only unapplied committed migrations via `drizzle-kit migrate`
  - Requires `Q360_DATABASE_ENV=staging`, `Q360_DATABASE_NAME=q360-staging`, and `Q360_DATABASE_HOST_ALLOWLIST`
  - Captures before/after fingerprints and writes a migration manifest
- `DEPLOYMENT.md`
  - Recommends backend Build Command and Start Command
  - Documents the separate, manual migration command

## Decoupled Railway deployment sequence

The deployment sequence is now:

1. Build backend.
2. Start backend with `cd backend && npm start`.
3. Verify `/health`.
4. Verify `/readyz` before sending traffic.

Database migrations are run separately by an authorized operator before the backend deployment is triggered.

Expected deployment log order:

1. Backend build completes.
2. `cd backend && npm start` begins.
3. Backend reports readiness.
4. `/health` returns HTTP 200.
5. `/readyz` returns HTTP 200 `ready`.

## Why schema mutation must not run during deployment

Application deployment can happen repeatedly due to restarts, scaling, crashes, health recovery, or redeploy behavior. If schema mutation were part of deployment, it would execute automatically on every deploy, without a separate approval or verification step. That couples code release to database mutation and removes the ability to roll back application code independently from schema changes.

Keeping `npm start` as `node dist/index.js` preserves a clean runtime boundary: start the compiled API server only. Schema preparation belongs in a separate, authorized operation that produces a migration manifest before the deployment begins.

## Why db:push must not run during normal requests

Restaurant or other authenticated requests must never perform DDL such as `ALTER TABLE`, `CREATE TABLE`, or `CREATE INDEX`.

DDL during normal requests adds latency and can cause locking, request failures, and unpredictable production behavior. Request handlers should assume the schema is already prepared before traffic reaches the backend. Normal request logs must never contain DDL, migration helper, `ALTER TABLE`, `CREATE INDEX`, or `ensureRestaurantServiceFlowSchema` activity.

## Railway configuration required

Required Railway settings by name:

- Build Command
- Start Command
- `DATABASE_URL`
- `JWT_SECRET`
- `NODE_ENV`
- `CORS_ORIGINS`
- `POSTGRES_SSL`
- `POSTGRES_POOL_SIZE`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`

The migration command (run separately from deployment) also requires:

- `Q360_DATABASE_ENV=staging`
- `Q360_DATABASE_NAME=q360-staging`
- `Q360_DATABASE_HOST_ALLOWLIST` — comma-separated list of approved database hosts
- `Q360_WAVE0_BACKUP_ARTIFACT_PATH` — required for non-empty legacy schemas

Railway supplies `PORT`; do not configure it unless Railway support requires an override.

The intended command values are:

- Build Command: `cd backend && npm ci --include=dev && npm run build`
- Start Command: `cd backend && npm start`

Do not put secret values, connection strings, or credentials in documentation, logs, commits, screenshots, or frontend environment variables.

## Safe deploy checklist

- Confirm target branch and commit.
- Confirm migrations have been applied by the authorized migration command and the manifest is approved.
- Confirm `DATABASE_URL` is configured.
- Confirm build succeeds.
- Confirm startup begins only after migration approval.
- Confirm `/health` returns HTTP 200.
- Confirm `/readyz` returns HTTP 200 `ready`.
- Confirm application requests do not trigger schema work.
- Inspect Railway logs for build and startup ordering only; no DDL should appear.

## Migration checklist (separate from deployment)

- Confirm `Q360_DATABASE_ENV=staging` and `Q360_DATABASE_NAME=q360-staging`.
- Confirm `Q360_DATABASE_HOST_ALLOWLIST` contains the target host.
- Confirm `Q360_WAVE0_BACKUP_ARTIFACT_PATH` is set and checksum verified (legacy schemas).
- Run `cd backend && npm run db:migrate:staging`.
- Review the generated migration manifest in `backend/migration-manifests/`.
- Confirm `/readyz` passes against the migrated database before deploying.

## Rollback considerations

Application rollback must be considered separately from schema changes. Do not assume schema changes are automatically reversible.

Restore a previous application version only when its expected schema remains compatible with the already-applied database schema. Investigate failed deployment logs before retrying. Do not manually alter production schema without a reviewed plan.

If a database restore is required, use the verified Supabase backup or point-in-time recovery (PITR).

## How to verify deployment logs

Expected order:

1. Backend build completes.
2. `cd backend && npm start` begins.
3. Backend reports readiness.
4. `/health` returns HTTP 200.
5. `/readyz` returns HTTP 200 `ready`.

Normal request logs must never contain DDL, migration helper, `ALTER TABLE`, `CREATE INDEX`, or `ensureRestaurantServiceFlowSchema` activity.

## Repository versus Railway dashboard consistency

Consistency notes:

- `railway.json` no longer contains a `preDeployCommand` or any database-mutating step.
- `Procfile` only starts the backend with `cd backend && npm start`; it does not run schema preparation.
- `DEPLOYMENT.md` documents the manual migration command and no longer recommends `db:push` for production schema changes.
- `backend/src/scripts/migrate_noninteractive.ts` is the only approved path for applying committed migrations; it is fail-closed on environment and host identity.
