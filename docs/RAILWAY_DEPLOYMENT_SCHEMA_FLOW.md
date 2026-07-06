# Railway Deployment Schema Flow

## Current repository configuration

The repository currently defines backend build, deployment-time schema preparation, and startup.

- `railway.json`
  - Build Command: `cd backend && npm ci --include=dev && npm run build`
  - Deploy Command: `cd backend && npm run db:push`
  - Start Command: `cd backend && npm start`
  - Health check path: `/health`
- `Procfile`
  - `web: cd backend && npm start`
- `backend/package.json`
  - `npm start` runs `node dist/index.js`
  - `npm run build` runs `tsc`
  - `npm run db:push` runs `drizzle-kit push`
- `backend/drizzle.config.ts`
  - Uses `backend/src/db/schema.ts`
  - Reads `DATABASE_URL`
  - Reads `POSTGRES_SSL`
  - Runs `requireQ360StagingDatabaseGuard('db:push')` before Drizzle receives database credentials
- `DEPLOYMENT.md`
  - Recommends backend Build Command and Start Command
  - Documents `npm run db:push` as a manual Supabase schema step from `backend/`

Current repository files can enforce build, deploy-time schema preparation, and start behavior through Railway config-as-code.

## Intended Railway deployment sequence

The intended Railway deployment sequence is:

1. Build backend.
2. Run `cd backend && npm run db:push` once as the Railway Deploy Command.
3. Start backend with the existing `cd backend && npm start`.
4. Verify `/health`.

Expected deployment log order:

1. Backend build completes.
2. `cd backend && npm run db:push` begins.
3. Drizzle schema push succeeds.
4. `cd backend && npm start` begins.
5. Backend reports readiness.
6. `/health` returns HTTP 200.

## Why db:push must not run inside npm start

`npm start` is process startup, not deployment schema preparation. Startup can happen repeatedly due to restarts, scaling, crashes, health recovery, or redeploy behavior. Schema changes must not execute every time the server process starts.

Keeping `npm start` as `node dist/index.js` preserves a clean runtime boundary: start the compiled API server only. Schema preparation belongs in a deployment step that runs before startup and fails the deployment if schema preparation fails.

## Why db:push must not run during normal requests

Restaurant or other authenticated requests must never perform DDL such as `ALTER TABLE`, `CREATE TABLE`, or `CREATE INDEX`.

DDL during normal requests adds latency and can cause locking, request failures, and unpredictable production behavior. Request handlers should assume the schema is already prepared before traffic reaches the backend. Normal Restaurant request logs must never contain DDL, migration helper, `ALTER TABLE`, `CREATE INDEX`, or `ensureRestaurantServiceFlowSchema` activity.

## Railway configuration required

Required Railway settings by name:

- Build Command
- Deploy Command
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
- `Q360_DATABASE_ENV`
- `Q360_DATABASE_NAME`

Railway supplies `PORT`; do not configure it unless Railway support requires an override.

The intended command values are:

- Build Command: `cd backend && npm ci --include=dev && npm run build`
- Deploy Command: `cd backend && npm run db:push`
- Start Command: `cd backend && npm start`

Do not put secret values, connection strings, or credentials in documentation, logs, commits, screenshots, or frontend environment variables.

## Safe deploy checklist

- Confirm target branch and commit.
- Confirm `DATABASE_URL` is configured.
- Confirm required non-secret database guard markers are configured for the intended guarded schema command.
- Confirm build succeeds.
- Confirm Deploy Command runs once before startup.
- Confirm `db:push` succeeds.
- Confirm startup begins only after `db:push` succeeds.
- Confirm `/health` returns HTTP 200.
- Confirm Restaurant requests do not trigger schema work.
- Inspect Railway logs for schema preparation and startup ordering.

## Rollback considerations

Application rollback must be considered separately from schema changes. Do not assume `db:push` is automatically reversible.

Restore a previous application version only when its expected schema remains compatible with the already-applied database schema. Investigate failed deployment logs before retrying. Do not manually alter production schema without a reviewed plan.

## How to verify deployment logs

Expected order:

1. Backend build completes.
2. `cd backend && npm run db:push` begins.
3. Drizzle schema push succeeds.
4. `cd backend && npm start` begins.
5. Backend reports readiness.
6. `/health` returns HTTP 200.

Normal Restaurant request logs must never contain DDL, migration helper, `ALTER TABLE`, `CREATE INDEX`, or `ensureRestaurantServiceFlowSchema` activity.

## Repository versus Railway dashboard consistency

Consistency notes:

- `Procfile` only starts the backend with `cd backend && npm start`; it does not run schema preparation.
- `DEPLOYMENT.md` documents `npm run db:push` as a schema step, but its recommended Railway settings list Build Command and Start Command only, not a Railway Deploy Command.
- `backend/drizzle.config.ts` protects `db:push` with `Q360_DATABASE_ENV` and `Q360_DATABASE_NAME`. Any Railway Deploy Command that runs `db:push` must have the required guard marker names configured for the intended environment, or the schema push will fail before connecting.

Current repository startup may use `railway.json` or `Procfile` with `cd backend && npm start`. The repository Railway config-as-code setup defines the separate Deploy Command as `cd backend && npm run db:push`.
