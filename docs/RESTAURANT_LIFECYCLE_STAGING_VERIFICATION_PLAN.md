# Restaurant Lifecycle Staging Verification Plan

## Why staging is required

The Restaurant lifecycle refactor changes persisted order semantics and adds schema state for service status, payment status, order type, payment timing, and idempotency. The verification scripts also create, delete, and update database rows. Running them against an unproven database risks modifying live or beta tenant data.

The current configured database could not be proven isolated from repository evidence. A safe verification path therefore requires a dedicated staging database or project where resets, seeds, schema pushes, and migration checks are explicitly permitted.

## Current database classification

Classification: `unknown`.

Inspection found `backend/.env` contains a Postgres `DATABASE_URL` with a Supabase-like provider hint. Secret values, hostnames, and database names were not printed. Existing documentation references Q360-beta Supabase usage, but it also states provider-console evidence was unavailable to confirm the configured database identity. Because the target is not proven to be a dedicated staging/test database, it must be treated as unknown and unsafe for destructive verification.

The configured database must not be treated as staging until the owner verifies, in the database provider console and deployment environment settings, that it is a dedicated staging/test project or database with no live/beta customer data.

## EACCES root cause

Actual failed command inspected:

```bash
cd backend && npm run verify:restaurant-service-flow
```

Exact operation attempted when it failed:

```sql
ALTER TABLE restaurant_orders
ADD COLUMN IF NOT EXISTS order_type text,
ADD COLUMN IF NOT EXISTS service_status text,
ADD COLUMN IF NOT EXISTS payment_status text,
ADD COLUMN IF NOT EXISTS payment_timing text,
ADD COLUMN IF NOT EXISTS idempotency_key text
```

The error was raised by Node's network layer inside the Postgres client connection attempt: `AggregateError [EACCES]` from `node:net` during `internalConnectMultiple`. That means the observed failure came from sandbox/platform network access being denied before PostgreSQL could accept, reject, authenticate, authorize, or execute the SQL. It is not proven to be a PostgreSQL role permission error.

Other database-backed verification commands failed similarly at first database access:

- `verify:tenant-identity`: failed during a `SELECT` from `users`.
- `verify:restaurant`: failed during seed `INSERT` into `businesses`.
- `verify:business-pulse`: failed during `SELECT` from `restaurant_orders`.
- `verify:restaurant-setup`: failed during `DELETE` from `restaurant_tables`.

Required permissions differ by layer:

- Platform/sandbox permission: outbound TCP access from Node/Postgres client to the staging database endpoint.
- Database login permission: connect to the staging database with SSL as configured.
- Schema permission: create/alter tables and indexes for `npm run db:push` and the service-flow schema guard.
- Seed/test-data permission: insert, update, select, and delete rows in the staging schema for the fixed verification tenants.

Safest fix: provision a dedicated staging database, point a fresh shell explicitly at that staging-only connection, then run schema/seed/verification commands only after confirming the database identity out of band.

## Staging database requirements

Use one of these isolated targets:

- Dedicated Supabase project named `q360-staging`.
- Dedicated Postgres database named `q360_test` or `q360_staging` in an isolated environment.

The staging database must have no live/beta customer data. Do not copy production data unless it is explicitly anonymized, approved, and documented before import.

Recommended roles:

- `q360_staging_app`: least-privilege application role for normal app runtime. Needs connect, usage on the app schema, and CRUD on application tables/sequences. It should not own production data and should not be shared with live/beta.
- `q360_staging_migrator`: schema migration role for `db:push` and schema verification. Needs create/alter/index permissions only in the staging schema/database.

For this repository's current scripts, the role used during verification must be allowed to:

- Run Drizzle schema push.
- Execute the Restaurant service-flow `ALTER TABLE` and `CREATE UNIQUE INDEX IF NOT EXISTS`.
- Insert seed data.
- Delete and reinsert fixed verification tenants and their Restaurant records.
- Select verification rows and audit records.

If separate migrator and app roles are used, run `db:push` with the migrator role, then run seeds and verification with the staging app/test role that has CRUD only on the staging schema.

## Safe environment-variable rules

Use staging-only variables in a fresh terminal session. Do not edit committed config, do not paste secrets into docs, and do not put backend secrets in Vercel/frontend variables.

Required backend variables for staging verification:

- `DATABASE_URL`: staging-only Postgres/Supabase pooled URL.
- `POSTGRES_SSL`: set according to the staging provider; expected `true` for Supabase-style pooled Postgres.
- `POSTGRES_POOL_SIZE`: small staging pool, for example `5` or `10`.
- `JWT_SECRET`: staging-only random secret.
- `CORS_ORIGINS`: staging frontend origins only if running deployed staging.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: staging-only, only if a script or service-role feature truly requires direct Supabase API access.
- `RESEND_API_KEY`, `EMAIL_FROM`, and `VERIFY_EMAIL`: staging-only, only for live email verification.

Safety checks before running any database command:

- Confirm the provider console project/database name is `q360-staging`, `q360_test`, or equivalent staging-only naming.
- Confirm no live/beta production project name appears in `DATABASE_URL`, `SUPABASE_URL`, Railway variables, or local shell variables.
- Confirm `backend/.env` is not committed and is not reused from live/beta.
- Confirm `DATABASE_URL` is backend-only and never exposed through Vite variables.

## Schema and seed procedure

From a fresh shell, set staging-only environment variables without printing their values. Then run commands from `backend/`.

Schema procedure:

```bash
npm run build
npm run db:push
```

The repository's migration scripts for older phases only print that schema is managed by Drizzle. The active schema push path is `npm run db:push`, which runs `drizzle-kit push` using `backend/drizzle.config.ts`.

The Restaurant service-flow refactor also has a runtime schema guard that executes:

- `ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS ...`
- `CREATE UNIQUE INDEX IF NOT EXISTS restaurant_orders_business_idempotency_key_idx ...`

Run the new service-flow verification after `db:push` so both Drizzle schema and the runtime guard are exercised in staging.

Seed procedure:

```bash
npm run db:seed
```

`db:seed` inserts the demo business, admin, inventory, products, suppliers, menu, and tables with conflict handling. It also deletes specific legacy Restaurant menu item IDs and legacy table IDs under `biz_main`. That is acceptable only in staging/test.

## Verification command order

Run these from `backend/` after confirming `DATABASE_URL` points to the isolated staging database:

```bash
npm run build
npm run db:push
npm run db:seed
npm run verify:jwt-init
npm run verify:otp
npm run verify:tenant-identity
npm run verify:restaurant-setup
npm run verify:restaurant
npm run verify:business-pulse
npm run verify:restaurant-service-flow
```

Then run frontend checks from the repository root:

```bash
npm run lint
npm run build
```

Optional staging email check, only with a dedicated staging inbox:

```bash
cd backend
VERIFY_EMAIL=<staging-test-inbox> npm run verify:resend-live
```

Do not run live browser or deployed checks until the database-backed local staging verification passes.

## Data-reset safety rules

Verification scripts may reset only the isolated staging database.

Scripts that delete/reinsert fixed verification data:

- `verify:restaurant`: deletes and recreates fixed Restaurant verification tenants and also runs `db:seed`.
- `verify:restaurant-service-flow`: ensures service-flow schema columns, runs `db:seed`, deletes and recreates fixed service-flow tenants, and exercises lifecycle transitions.
- `verify:restaurant-setup`: deletes and recreates fixed setup tenants.
- `verify:business-pulse`: deletes and recreates fixed Business Pulse tenants and audit rows.

Scripts that write data without broad fixture resets:

- `verify:tenant-identity`: creates OTP/user/onboarding data, Restaurant table/menu/order records for a verification email.
- `verify:otp`: creates OTP/user/session records for a generated test email.
- `verify:phase2_5`: inserts fixed competitor-style fixture rows if run manually.
- `db:seed`: inserts demo data and deletes specific legacy Restaurant IDs under the seeded demo tenant.

Stop immediately if any command's environment points at live/beta, an unknown project, a shared database, or a database containing customer data.

Do not bypass safety by weakening tests, removing deletes, changing assertions, using broad reset commands, or running against a shared schema.

## Migration test cases

Run these only against staging:

1. Fresh schema push succeeds on an empty staging database.
2. `db:seed` succeeds after schema push.
3. `verify:restaurant-service-flow` can add service-flow columns/index if absent.
4. Re-running `verify:restaurant-service-flow` succeeds with the columns/index already present.
5. `verify:restaurant` still passes after service-flow schema exists.
6. `verify:tenant-identity` still proves stable JWT-derived tenant identity after onboarding and re-login.
7. `verify:restaurant-setup` still proves tenant-separated menu/table setup.
8. `verify:business-pulse` still proves tenant-scoped snapshot evidence and audit rows.
9. Dine-in lifecycle reaches paid and releases the table only after delivery plus payment.
10. Takeaway pay-before-service reaches paid before kitchen, then ready, collected, and closed.
11. Takeaway pay-after-service rejects early payment, then collects, pays, and closes.
12. Cross-tenant transition attempts return not found or forbidden without leaking data.
13. Duplicate POS idempotency retry returns the same order and does not create a second KDS ticket.

## Deployment gate

Do not deploy the uncommitted Restaurant lifecycle refactor to live/beta until all of the following are true:

- Current database target is proven to be dedicated staging/test before verification.
- `npm run db:push`, `npm run db:seed`, and all required database-backed verification commands pass against staging.
- Local frontend `npm run lint` and `npm run build` pass after staging verification.
- Staging browser checks complete one dine-in flow and both takeaway payment-timing flows without duplicate orders or premature table release.
- Provider console confirms live/beta credentials were not used for staging verification.

Current gate conclusion: blocked. The current database is `unknown`, and the observed `EACCES` was a platform/sandbox network denial, not proof of database readiness or isolation.

## Rollback plan

Because this plan does not deploy or modify live/beta, rollback is limited to the isolated staging environment.

If staging schema verification fails:

- Stop all verification commands.
- Keep logs with secret values redacted.
- Drop or recreate only the isolated staging database/project if a clean retry is needed.
- Do not run cleanup against live/beta or any unknown database.

If staging credentials are exposed:

- Rotate the staging credential in the provider.
- Update only staging environment variables.
- Invalidate staging sessions/tokens if applicable.
- Do not reuse the exposed value in live/beta.

If a lifecycle defect is revealed:

- Do not change tests to pass around it.
- Document the exact failing command, route, payload, expected state, and actual state.
- Make the smallest code fix in a separate implementation step, then rerun the full staging verification order.
