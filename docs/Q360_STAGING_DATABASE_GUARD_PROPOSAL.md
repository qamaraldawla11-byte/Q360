# Q360 Staging Database Guard Proposal

## Problem

The current backend configuration loads `DATABASE_URL` through `dotenv/config` in `backend/drizzle.config.ts`, `backend/src/utils/env.ts`, and runtime entry points. `requireDatabaseUrl()` validates that `DATABASE_URL` is present and uses a Postgres protocol, but it does not classify the target environment.

The configured database name can resolve to `postgres`, which is common for managed Postgres providers and does not prove that the target is the isolated Q360 staging database. Destructive verification must therefore fail closed unless staging is explicitly declared through non-secret environment markers.

## Safe marker design

Use two non-secret markers:

```text
Q360_DATABASE_ENV=staging
Q360_DATABASE_NAME=q360-staging
```

`Q360_DATABASE_ENV=staging` is the required safety gate. Any command protected by the staging verification guard must refuse to run unless this exact value is present.

`Q360_DATABASE_NAME=q360-staging` is an additional human-readable confirmation for operators and logs. It should be checked alongside the environment marker, but it must not replace the environment marker and must not rely on the parsed Postgres database name.

The guard must never print `DATABASE_URL`, hostnames, passwords, pooler names, credentials, or any other secret-bearing connection detail.

## Where the guard should run

The smallest safe implementation is a shared backend utility in `backend/src/utils/env.ts`, next to `requireDatabaseUrl()`, for example `requireQ360StagingDatabaseGuard(commandName)`.

Every destructive TypeScript verification or seed entry point should call the guard before importing or initializing `backend/src/db/client.ts`, because `client.ts` creates the Postgres client at module load time.

`db:push` is different because it runs `drizzle-kit push` directly and reads `backend/drizzle.config.ts`. The guard for `db:push` should run inside `backend/drizzle.config.ts` before returning `dbCredentials`, or through a tiny package-script wrapper that validates the same markers before invoking Drizzle. Keeping the check in `drizzle.config.ts` is the safer central choice because it protects direct Drizzle usage as well as `npm run db:push`.

## Commands that require the guard

The guard should block these commands unless `Q360_DATABASE_ENV=staging` and the companion name marker is set to `q360-staging`:

```text
npm run db:push
npm run db:seed
npm run verify:tenant-identity
npm run verify:restaurant
npm run verify:business-pulse
npm run verify:restaurant-setup
npm run verify:restaurant-service-flow
```

These commands create, alter, delete, insert, update, seed, or verify against mutable database state. The Restaurant service-flow verification also calls `ensureRestaurantServiceFlowSchema()`, which executes `ALTER TABLE` and `CREATE UNIQUE INDEX IF NOT EXISTS`, so it must be treated as destructive schema work.

## Fail-closed behavior

If `Q360_DATABASE_ENV` is missing or not exactly `staging`, the guard should throw before any database client is created and before any command can mutate state.

If `Q360_DATABASE_NAME` is missing or not exactly `q360-staging`, the guard should also throw with a clear non-secret message stating that the staging database marker is absent or mismatched.

The failure message should include only the command name and the expected marker names and values. It should not include the actual connection string, host, username, password, project reference, or parsed database URL components.

## Local staging environment example

```text
Q360_DATABASE_ENV=staging
Q360_DATABASE_NAME=q360-staging
DATABASE_URL=<staging Postgres URL, do not commit or print>
POSTGRES_SSL=true
```

Operators should set these values only in the dedicated isolated staging execution environment used for Q360 verification. They should not be added to committed `.env` files unless those files are examples with placeholder values only.

## Production and beta safety

Production and beta runtime should not call the staging verification guard. Normal application startup, `npm run start`, `npm run dev`, request handlers, authentication, and non-destructive runtime code should continue to rely on the existing database URL validation.

The staging guard should be imported only by destructive scripts, verification scripts, seed entry points, and Drizzle push configuration. This keeps production and beta unaffected while making staging verification intentionally opt-in.

Production and beta environments should not set `Q360_DATABASE_ENV=staging`. If they accidentally run a guarded command without the markers, the command fails closed before connecting.

## Exact implementation scope

Implement a shared guard in `backend/src/utils/env.ts` without changing existing `requireDatabaseUrl()` behavior for normal runtime.

Add the guard to:

```text
backend/drizzle.config.ts
backend/src/db/seed.ts
backend/src/scripts/verify_tenant_identity.ts
backend/src/scripts/verify_restaurant_core.ts
backend/src/scripts/verify_business_pulse_snapshot.ts
backend/src/scripts/verify_restaurant_setup_foundation.ts
backend/src/scripts/verify_restaurant_service_flow.ts
```

Place each TypeScript script guard before any static or dynamic import that initializes `backend/src/db/client.ts`. If static imports currently initialize the client before the guard can run, convert only the minimum necessary imports to dynamic imports after the guard.

Do not weaken tenant-isolation checks, schema checks, lifecycle assertions, or verification assertions. Do not change production or beta runtime entry points.

## Verification plan

First, verify fail-closed behavior without connecting to a database by running each guarded command with `Q360_DATABASE_ENV` unset and confirming it exits before database initialization with a non-secret error.

Second, verify the companion marker by setting `Q360_DATABASE_ENV=staging` without `Q360_DATABASE_NAME=q360-staging` and confirming each guarded command exits before database initialization.

Third, in the dedicated isolated Q360 staging environment only, set:

```text
Q360_DATABASE_ENV=staging
Q360_DATABASE_NAME=q360-staging
```

Then run the destructive verification sequence in order:

```text
npm run db:push
npm run db:seed
npm run verify:tenant-identity
npm run verify:restaurant
npm run verify:business-pulse
npm run verify:restaurant-setup
npm run verify:restaurant-service-flow
```

Record pass/fail status and the first failing command, without printing connection strings or secrets.
