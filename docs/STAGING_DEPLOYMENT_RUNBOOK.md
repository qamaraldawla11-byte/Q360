# Q360 Staging Deployment Runbook

This runbook prepares a controlled Q360 Restaurant staging deployment for first-beta readiness. It intentionally does not include secret values.

## Required Environment Variable Names

Frontend Vercel variables:

- `VITE_API_BASE_URL`
- `VITE_SIMULATION_MODE`

Backend Railway variables:

- `NODE_ENV`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `DATABASE_URL`
- `POSTGRES_SSL`
- `POSTGRES_POOL_SIZE`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_JSON_TRANSPORT`

Railway supplies `PORT`; do not configure it unless Railway support requires an override.

## Railway Service Configuration

- Root directory: repository root
- Build command: `cd backend && npm ci --include=dev && npm run build && npm prune --omit=dev`
- Start command: `cd backend && npm start`
- Required port behavior: the backend reads `process.env.PORT` and falls back to `3001` only for local development. Railway should provide `PORT`.
- Health-check endpoint: `/health`

The backend production startup entry point is the compiled `backend/dist/index.js`. It loads `dotenv/config`, configures CORS, mounts API routes under `/api`, exposes `/` and `/health`, and starts Hono using the Railway-provided port.

## Vercel Configuration

- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- SPA routing: `vercel.json` rewrites all paths to `/index.html`.

Required frontend variables:

- `VITE_API_BASE_URL`
- `VITE_SIMULATION_MODE`

`VITE_API_BASE_URL` must point to the deployed Railway staging backend API URL and include `/api`.

## CORS Requirement

The exact staging Vercel origin must be included in backend `CORS_ORIGINS`.

The current backend expects `CORS_ORIGINS` as a comma-separated list of full origins. Example shape only:

```text
https://q360-staging.example.vercel.app,https://q360-preview.example.vercel.app
```

Do not use wildcard CORS for authenticated staging. In production mode, the backend uses only the origins listed in `CORS_ORIGINS`; local development origins are not automatically allowed.

## SMTP Requirements

Required backend-only variable names:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

`SMTP_FROM` should use a sender address on a domain authorized by the SMTP provider. The provider should have SPF, DKIM, and DMARC configured for the sender domain before first-beta testing.

Check OTP delivery safely by requesting a code for a dedicated staging test user and confirming receipt in the mailbox. Do not print, screenshot, commit, or paste OTP codes. In staging, `SMTP_JSON_TRANSPORT` must be unset or set to `false`.

## Database Requirement

Use the Q360-beta Supabase pooled Postgres connection string in `DATABASE_URL`.

`DATABASE_URL` is backend-only. Never expose it to Vite, Vercel frontend variables, browser code, screenshots, or client logs.

Use:

- `POSTGRES_SSL`
- `POSTGRES_POOL_SIZE`

Keep existing local verification scripts usable by configuring `backend/.env` locally when running from development. Do not commit `backend/.env`.

## Staging Versus Production

Staging must use separate names and URLs from production:

- Railway service name clearly marked as Q360 staging.
- Vercel project or preview deployment clearly marked as Q360 staging.
- Supabase project/database clearly identified as Q360-beta.
- SMTP sender approved for staging use.

Use separate environment variables in Railway and Vercel for staging. Confirm before deploy that:

- Vercel `VITE_API_BASE_URL` points only to the Railway staging backend.
- Railway `CORS_ORIGINS` includes only the staging Vercel origin or explicitly approved preview origins.
- Railway `DATABASE_URL` points to Q360-beta Supabase, not production.
- No backend secrets are configured in Vercel.

To prevent accidental production connection, compare project names and URLs in Railway, Vercel, Supabase, and SMTP before each deploy. Stop immediately if any production hostname, database, or sender appears in a staging variable.

## Rollback

Vercel rollback:

- Use the Vercel deployment list for the staging project.
- Promote the last known-good deployment.
- Confirm the promoted deployment still uses the intended staging environment variables.

Railway rollback:

- Use Railway deployment history for the staging backend service.
- Roll back to the last known-good deployment.
- Recheck `/health` and confirm CORS from the Vercel staging origin.

If secrets are exposed:

- Remove the exposed value from the affected place immediately.
- Rotate the exposed secret in its provider.
- Update Railway or Vercel with the rotated value.
- Invalidate any affected sessions or tokens where applicable.
- Do not continue beta testing until rotation is complete.

## `/health` Verification

Open the Railway staging backend health URL in a browser:

```text
https://RAILWAY-STAGING-BACKEND/health
```

Or run:

```bash
curl https://RAILWAY-STAGING-BACKEND/health
```

Expected result: a JSON response with `status` set to `running`. Do not include secret-bearing headers for this check.

## First Beta Operating Rule

First beta is limited to one closely supported Restaurant customer only.

The staging database must not be used as a production customer database without an explicit decision to promote it, a backup/restore plan, and a written environment ownership decision.
