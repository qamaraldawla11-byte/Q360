# Database Deployment Guard Review

## Current guard behavior

The database deployment guard is scoped to destructive or database-mutating maintenance commands, not normal backend startup. `railway.json` runs `cd backend && npm run db:push` as Railway's pre-deploy command, and `backend/package.json` maps `db:push` to `drizzle-kit push`. When Drizzle loads `backend/drizzle.config.ts`, the config loads dotenv and immediately calls `requireQ360StagingDatabaseGuard('db:push')` before returning database credentials.

The guard requires two exact non-secret markers:

- `Q360_DATABASE_ENV=staging`
- `Q360_DATABASE_NAME=q360-staging`

The Railway service environment name is separate from the database lifecycle classification. A Railway environment named `production` can still point at a beta/staging database, but this repository's current destructive-command guard does not look at Railway's environment name. It only accepts the explicit Q360 staging markers above.

Assumptions:

- The Railway log excerpt is from the pre-deploy command configured in `railway.json`.
- The current database project name is reported operationally as Q360-beta, but provider-side database identity was not available from the repository.
- No production Railway variables or database URLs were inspected or changed for this review.

## Evidence from code

- `backend/src/utils/env.ts:4-5` hardcodes the accepted guard markers as `staging` and `q360-staging`.
- `backend/src/utils/env.ts:7-18` blocks unless both `Q360_DATABASE_ENV` and `Q360_DATABASE_NAME` exactly match those markers. The failure text for the first check is: `set Q360_DATABASE_ENV=staging`.
- `backend/drizzle.config.ts:5-7` loads dotenv, then calls `requireQ360StagingDatabaseGuard('db:push')` before `dbCredentials` are returned.
- `backend/drizzle.config.ts:13-16` passes `DATABASE_URL` and SSL configuration to Drizzle only after the guard call.
- `backend/package.json:9` defines `db:push` as `drizzle-kit push`; there is no package-script wrapper that changes the guard.
- `railway.json:7-11` defines `preDeployCommand`, `startCommand`, `healthcheckPath`, and timeout under `deploy`.
- `Procfile:1` starts the backend only with `cd backend && npm start`; it does not run schema preparation.
- `backend/src/db/client.ts:7-12` validates `DATABASE_URL` for runtime DB clients and configures SSL as required unless `POSTGRES_SSL=false`.
- `docs/Q360_STAGING_DATABASE_GUARD_IMPLEMENTATION.md:11-18` documents the same two required markers and says the guard is a non-secret staging declaration plus human-readable marker.
- `docs/Q360_STAGING_DATABASE_GUARD_IMPLEMENTATION.md:42-46` states production and beta runtime startup do not invoke the staging guard, while destructive command entry points do.
- `docs/STAGING_DEPLOYMENT_RUNBOOK.md:75-104` identifies Q360-beta Supabase as the staging database target and requires confirmation that Railway `DATABASE_URL` points to Q360-beta, not production.
- `docs/LIVE_RESTAURANT_BETA_VERIFICATION.md:57-60` says provider-console access was not available to confirm the database is specifically the intended Q360-beta Supabase project.
- `docs/RESTAURANT_LIFECYCLE_STAGING_VERIFICATION_PLAN.md:9-15` previously classified the configured database as unknown until the owner verifies, in provider settings, that it is a dedicated staging/test project with no live/beta customer data.

`DATABASE_URL` validation is limited. `backend/src/utils/env.ts:21-37` checks that the variable exists, trims it, parses as a URL, and requires `postgresql:` or `postgres:` protocol. It does not validate expected host, expected project, expected database name, SSL query parameters, or whether the target is live production. SSL is configured separately by `backend/src/db/client.ts:9-12` and `backend/drizzle.config.ts:13-16`, where SSL defaults to `require` unless `POSTGRES_SSL=false`.

## Why Railway deployment failed

Railway ran the configured pre-deploy command, which invoked `npm run db:push`. Drizzle loaded `backend/drizzle.config.ts`, and the staging guard ran before Drizzle received `DATABASE_URL`. The log message means `Q360_DATABASE_ENV` was missing or not exactly `staging` in that Railway environment.

This happened even though the Railway environment is named `production` because the guard is not checking the Railway environment label. It is checking the database lifecycle marker used for destructive schema commands. In other words, `production` is the Railway service environment name; `staging` is the required database classification for automatic schema push.

The behavior is intentional safety design based on the repository docs and implementation. It is hardcoded, but not provably incorrect: the implementation explicitly protects `db:push`, seed, and verification commands from running unless the operator marks the target as the isolated Q360 staging database.

## Environment classification decision

Repository evidence supports this decision:

- Q360-beta is intended by the staging runbook to be the beta/staging Supabase target.
- Other docs explicitly say provider-side confirmation was not available from the repository alone.

Therefore, Q360-beta should be treated as staging/beta only after the owner confirms in Railway and the database provider console that it is an isolated Q360-beta database with no live production customer data and no production ownership role. Until that confirmation, the database classification remains unknown, and automatic schema push should remain blocked.

If that out-of-band confirmation is completed, the safe marker values for the current isolated Q360-beta environment are the existing guard values:

- `Q360_DATABASE_ENV=staging`
- `Q360_DATABASE_NAME=q360-staging`

`Q360_DATABASE_NAME` is checked against an exact expected value. It is not merely required to exist, and it is not used only for logging.

## Recommended staging policy

Automatic Railway pre-deploy `db:push` may run only when all of these are true:

- The target database has been confirmed in the provider console as the isolated Q360-beta/staging database.
- The database contains no live production customer data.
- Railway `DATABASE_URL` points to that isolated database and is backend-only.
- The explicit guard markers are set to the exact staging values required by the current guard.
- `POSTGRES_SSL` is configured according to the provider, with Supabase-style pooled Postgres expected to use SSL.
- The deployment log shows build completed, pre-deploy schema push ran once, startup began only afterward, and `/health` passed.

Minimum verification after deploy:

- Check Railway logs for the order: build, pre-deploy `db:push`, backend start, health check.
- Confirm `/health` returns running status.
- Confirm normal Restaurant requests do not run schema work.
- Confirm the deployed frontend points only at the intended Railway beta backend.
- Confirm no secret-bearing values, database URLs, hostnames, or credentials were copied into docs or frontend variables.

## Recommended production policy

Automatic `db:push` should be disabled by default for live production. Production schema changes should require an explicit, time-bounded approval mechanism that is separate from normal application startup.

Conservative options, from safest to less safe:

- A separate production migration workflow with review, backup confirmation, deploy window, and rollback plan.
- A one-time manual deploy action run by an operator after confirming the exact production database and schema diff.
- A temporary Railway approval variable that is added only for the migration deploy and removed immediately afterward.

Production must not use the staging markers. A production approval mechanism should be deliberately named for production and should still require database identity confirmation before any schema mutation. Backend startup should remain `cd backend && npm start`; it should not include `db:push`. If a required schema change has not been deliberately approved and applied, startup may fail due to application/schema incompatibility, which is safer than silently altering a production database during every process start.

## Required Railway variable names only

- `DATABASE_URL`
- `POSTGRES_SSL`
- `POSTGRES_POOL_SIZE`
- `Q360_DATABASE_ENV`
- `Q360_DATABASE_NAME`
- `NODE_ENV`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`

## Recommended smallest code/config change

No code change is required based on repository evidence. The current guard is consistent with the documented Q360 staging guard design and fails closed before Drizzle receives credentials.

The smallest safe operational/configuration action is: after provider-side confirmation that Q360-beta is isolated staging/beta and not live production, set the existing guard marker variables for the Railway service that points at Q360-beta. Do not change `npm start`, `backend/package.json`, `Procfile`, schema, migrations, routes, or tenant logic.

If Q360-beta is actually live production or contains production customer data, do not set the staging markers. Instead, remove or override automatic pre-deploy schema push for that live production service and use a separate production migration approval workflow.

## Risks and rollback

Safety boundaries:

- A Railway service cannot alter a database through the guarded `db:push` path merely because `DATABASE_URL` is present; it also needs the exact Q360 guard markers.
- The guard does not prove database identity by inspecting host, project, or database metadata. Operator/provider-console confirmation is still required.
- `DATABASE_URL` validation catches missing, malformed, and non-Postgres URLs, but it does not detect an unexpected host, an accidental live database target, or missing provider-side SSL requirements.
- SSL defaults to required unless explicitly disabled with `POSTGRES_SSL=false`; this is configuration behavior, not database identity validation.
- `db:push` is not automatically reversible. Application rollback and schema rollback must be planned separately.

Rollback considerations:

- Before schema push, confirm backups or point-in-time recovery for the target database.
- If a deploy fails after schema push, check whether the previous application version remains compatible with the updated schema before rolling back code.
- Do not manually alter production schema without a reviewed plan.
- Do not promote a staging/beta database to production without an ownership decision, backup plan, and compatibility review.
