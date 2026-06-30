# Q360 Staging Database Guard Implementation

## Scope

This change adds a non-secret staging database guard for destructive Q360 database commands only. It does not change Restaurant lifecycle behavior, runtime API behavior, authentication, tenant identity logic, schema definitions, deployment configuration, or environment values.

## Guard behavior

The shared guard lives in `backend/src/utils/env.ts` as `requireQ360StagingDatabaseGuard(commandName)`.

The guard requires both explicit markers:

```text
Q360_DATABASE_ENV=staging
Q360_DATABASE_NAME=q360-staging
```

`Q360_DATABASE_ENV=staging` is the required staging declaration. `Q360_DATABASE_NAME=q360-staging` is an additional human-readable safety marker. The guard does not parse or log `DATABASE_URL`, and it does not print hostnames, credentials, passwords, or connection details.

## Protected commands

The guard protects:

```text
db:push
db:seed
verify:tenant-identity
verify:restaurant
verify:business-pulse
verify:restaurant-setup
verify:restaurant-service-flow
```

For TypeScript seed and verification scripts, the guard runs before database client initialization. For `db:push`, `backend/drizzle.config.ts` runs the same guard before Drizzle receives database credentials.

## Drizzle config compatibility

The backend runtime uses NodeNext ESM source imports with `.js` specifiers so compiled files resolve correctly from `dist`. `backend/drizzle.config.ts` is executed directly by Drizzle's TypeScript config loader rather than from compiled output, so it imports the guard from `./src/utils/env.ts`.

`backend/drizzle.config.ts` explicitly calls dotenv with `process.env.DOTENV_CONFIG_PATH || '.env'` before invoking the guard. The guard import stays synchronous and TypeScript-source based, avoiding emitted `.js` resolution and top-level await so Drizzle's CommonJS config transform can load it. This lets `DOTENV_CONFIG_PATH=.env.staging` load the staging-only marker file before the guard call, while preserving default `.env` behavior when no staging path is provided.

## Production and beta safety

Production and beta runtime startup do not invoke the staging guard. Normal backend startup still uses the existing `DATABASE_URL` validation path.

The guard is scoped to destructive command entry points and Drizzle push configuration, so production and beta application runtime behavior is unchanged.

## Fail-closed verification

Fail-closed verification is performed without connecting to Postgres by invoking the shared guard directly for each protected command and by checking that the runtime entry point can load without staging markers.

Expected fail-closed behavior:

```text
missing Q360_DATABASE_ENV -> blocked
Q360_DATABASE_ENV not staging -> blocked
missing Q360_DATABASE_NAME -> blocked
Q360_DATABASE_NAME not q360-staging -> blocked
valid markers -> guard passes without printing connection details
```

## Files changed

```text
backend/src/utils/env.ts
backend/drizzle.config.ts
backend/src/db/seed.ts
backend/src/scripts/verify_tenant_identity.ts
backend/src/scripts/verify_restaurant_core.ts
backend/src/scripts/verify_business_pulse_snapshot.ts
backend/src/scripts/verify_restaurant_setup_foundation.ts
backend/src/scripts/verify_restaurant_service_flow.ts
docs/Q360_STAGING_DATABASE_GUARD_IMPLEMENTATION.md
```

## Remaining limitations

The guard proves explicit operator intent through non-secret environment markers. It does not independently authenticate the remote database service or inspect live database metadata, because this implementation intentionally avoids database connections before the destructive command is allowed to proceed.
