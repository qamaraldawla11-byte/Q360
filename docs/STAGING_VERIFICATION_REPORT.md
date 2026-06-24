# Q360 Staging Verification Report

## Deployment status

Prepared but not run.

Railway and Vercel deployment steps are documented in `docs/STAGING_DEPLOYMENT_RUNBOOK.md`. No live Railway or Vercel deployment was performed from this environment because provider access, deployment CLIs, and staging URLs were not available.

## Environment configuration status

Prepared and locally inspected.

Required environment variable names were identified from `DEPLOYMENT.md`, `.env.example`, `backend/.env.example`, `backend/src/index.ts`, `backend/src/services/email.ts`, and `src/api/http.ts`. No secret values were read, printed, written, or committed.

## Health check result

Prepared but not run.

The backend exposes `/health` in `backend/src/index.ts` and returns a JSON response with `status: "running"` when the service is up. A live Railway `/health` check was not run because no Railway staging URL was available.

## Real SMTP OTP result

Prepared locally; live SMTP blocked by missing provider access.

The backend sends OTP email through backend-only SMTP variables when `SMTP_HOST` is configured. Local OTP behavior verification passed against the configured database. Real SMTP mailbox delivery was not tested because SMTP provider access, sender configuration, and a dedicated staging inbox were not available in this environment.

## Restaurant flow result

Passed locally; live browser staging flow not run.

The repository contains Restaurant UI and backend verification coverage. Local Playwright and backend Restaurant verification passed. Live browser verification against a deployed Vercel frontend and Railway backend was not run because provider deployments and staging environment values were unavailable.

## Tenant persistence result

Passed locally against the configured database.

`backend` includes `npm run verify:tenant-identity`. The sandboxed run failed with network `EACCES`; the retry with network permission exited `0` and confirmed stable business identity after re-login with persisted Restaurant rows visible.

## Payment integrity result

Passed locally against the configured database.

`backend` includes `npm run verify:restaurant`, which covers Restaurant order, KDS, billing, payment record creation, and duplicate-payment rejection. The command exited `0` and confirmed one payment record, duplicate-payment rejection with status `409`, and no extra payment after the duplicate attempt.

## Security and secret handling

Prepared.

No real secrets were included in the runbook or this report. Backend secrets must remain backend-only in Railway. Vercel frontend variables must be limited to `VITE_API_BASE_URL` and `VITE_SIMULATION_MODE`; no `DATABASE_URL`, SMTP credential, JWT secret, or Supabase service-role key belongs in Vite or browser-visible configuration.

## Issues found

Blocked by missing provider access:

- No Railway staging service URL or authenticated deployment access was available.
- No Vercel staging or preview deployment URL or authenticated deployment access was available.
- No provider-side confirmation was available that the configured Railway `DATABASE_URL` points to the intended Q360-beta Supabase pooled Postgres database.
- No SMTP provider credentials or dedicated staging inbox were available.

No code deployment blocker was identified during configuration inspection.

Local command results:

- `npm run build`: Passed, exit code `0`.
- `npm run lint`: Passed, exit code `0`.
- `cd backend && npm run build`: Passed, exit code `0`.
- `cd backend && npm run verify:tenant-identity`: sandbox run failed with network `EACCES`; retry with network permission passed, exit code `0`.
- `cd backend && npm run verify:otp`: Passed with network permission, exit code `0`.
- `cd backend && npm run verify:restaurant`: Passed with network permission, exit code `0`.
- `npx playwright test --reporter=list`: Passed, exit code `0`, `5 passed`.

## Final staging verdict

Prepared and locally verified, but not verified live.

Q360 is not ready to claim as live-staging verified for one closely supported Restaurant beta customer until Railway, Vercel, real SMTP delivery, and real browser checks pass against the controlled staging environment. Local build, lint, backend tenant identity, OTP, Restaurant/payment integrity, and Playwright checks passed.

## Manual actions still required

Configure Railway backend variables by name only:

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

Configure Vercel frontend variables by name only:

- `VITE_API_BASE_URL`
- `VITE_SIMULATION_MODE`

Deploy Railway backend, deploy Vercel frontend, then run live checks for `/health`, browser load, real SMTP OTP receipt, OTP login, Restaurant onboarding, menu, tables, POS order creation, KDS status updates, billing payment creation, duplicate-payment rejection, logout, and re-login persistence.

Provider/tooling blockers:

- Exact blocker: Railway deployment access and CLI were unavailable. Type: provider access/tooling. Smallest next action: install or authenticate Railway access and deploy the backend service using the runbook settings.
- Exact blocker: Vercel deployment access and CLI were unavailable. Type: provider access/tooling. Smallest next action: install or authenticate Vercel access and deploy the frontend with staging variables.
- Exact blocker: Deployed Railway backend URL was unavailable. Type: environment configuration. Smallest next action: deploy backend and record the staging API URL for `VITE_API_BASE_URL`.
- Exact blocker: Deployed Vercel staging origin was unavailable. Type: environment configuration. Smallest next action: deploy frontend and add its exact origin to backend `CORS_ORIGINS`.
- Exact blocker: Real SMTP mailbox delivery was not checked. Type: provider access. Smallest next action: configure SMTP sender and request OTP for a dedicated staging test inbox without exposing the code.
