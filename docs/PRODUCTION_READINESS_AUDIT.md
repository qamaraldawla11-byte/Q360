# Q360 Production Readiness Audit

## 1. Repository overview

* Frontend: Vite + React 19 + TypeScript in `src/`, with public assets in `public/` and production build output in `dist/`.
* Backend: Hono API in `backend/src/`, Drizzle/Postgres schema in `backend/src/db/schema.ts`, route modules in `backend/src/routes/`, middleware in `backend/src/middleware/`, and backend verification scripts in `backend/src/scripts/`.
* Database: Supabase/Postgres expected through `DATABASE_URL`, Drizzle schema push through `backend/package.json` script `db:push`, seed data through `backend/src/db/seed.ts`.
* Deployment: frontend Vercel config in `vercel.json`; backend Railway-style process in `Procfile`; deployment notes in `DEPLOYMENT.md`.
* Tests: Playwright E2E specs in `tests/e2e/`; backend verification scripts `verify:otp` and `verify:restaurant`; no backend `test` script exists.

Main entry points:

* Frontend: `src/main.tsx`, `src/App.tsx`, `src/views/routes.tsx`, `index.html`.
* Backend: `backend/src/index.ts`.
* Database client/schema: `backend/src/db/client.ts`, `backend/src/db/schema.ts`.
* Deployment entry: `Procfile` runs `cd backend && npm start`; backend `start` runs `node --import tsx src/index.ts`.

Current environment variables required or documented:

* Frontend: `VITE_API_BASE_URL`, `VITE_SIMULATION_MODE`.
* Backend/runtime: `NODE_ENV`, `PORT`, `JWT_SECRET`, `CORS_ORIGINS`.
* Database: `DATABASE_URL`, `POSTGRES_SSL`, `POSTGRES_POOL_SIZE`.
* Optional Supabase service client: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
* OTP email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_JSON_TRANSPORT`.
* Evidence: `.env.example`, `backend/.env.example`, `DEPLOYMENT.md`, `backend/src/db/client.ts`, `backend/src/middleware/auth.ts`, `backend/src/services/email.ts`.

Current routes and workspaces:

* Public frontend routes: `/`, `/pricing`, `/docs`, `/support`, `/ai`, `/login`.
* Onboarding frontend routes: `/onboarding/identity`, `/onboarding/segment`, `/onboarding/type`, `/onboarding/workspace`.
* App workspaces: `/app/personal`, `/app/restaurant`, `/app/pharmacy`, `/app/retail`, `/app/supermarket`, `/app/school`, plus `/app/segments`, `/app/marketplace`, `/app/logistics`, `/app/merchants`, `/app/settings`.
* Admin routes: `/admin/users`, `/admin/businesses`, `/admin/audit-logs`, `/admin/settings`.
* Backend routes: `/`, `/health`, `/api/auth/*`, `/api/user/profile`, `/api/inventory/*`, `/api/products/search`, `/api/orders/*`, `/api/suppliers/*`, `/api/admin/*`, `/api/restaurant/*`.
* Workspace manifests exist for restaurant, pharmacy, retail, supermarket, and school in `src/modules/**/manifest.ts`; `src/verticals/index.ts` also contains a placeholder `logistics` manifest.

## 2. Verified working capabilities

OTP authentication:

* What exists: Email OTP request at `POST /api/auth/login`, OTP verification at `POST /api/auth/verify`, JWT session at `GET /api/auth/session`, logout at `POST /api/auth/logout`.
* Relevant files: `backend/src/routes/auth.ts`, `backend/src/services/email.ts`, `backend/src/middleware/auth.ts`, `src/api/auth.api.ts`, `src/store/auth.store.ts`, `src/modules/auth/LoginView.tsx`.
* Persistence level: Backend-connected and database-backed through `otp_codes` and `users`.
* Evidence: OTP hashes are HMAC-SHA256 with `JWT_SECRET`, expire after 10 minutes, allow 5 attempts, mark codes used, and create a user if missing. Playwright has a mocked OTP test in `tests/e2e/01-otp-login.spec.ts`; backend `verify:otp` exists but failed locally because `DATABASE_URL` is unset.

Onboarding:

* What exists: Protected onboarding flow stores user type, segment, business name, country, currency, onboarding completion, and primary workspace via `PUT /api/user/profile`.
* Relevant files: `src/modules/onboarding/IdentityView.tsx`, `SegmentView.tsx`, `SubSegmentView.tsx`, `BusinessTypeView.tsx`, `backend/src/routes/user.ts`, `backend/src/db/schema.ts`, `src/api/user.api.ts`.
* Persistence level: Backend-connected and persistent for final profile fields; the name typed in `IdentityView` is only local store state and is not sent in `PUT /api/user/profile`.
* Evidence: `users` table has `userType`, `segment`, `businessName`, `country`, `currency`, `onboardingCompleted`, and `primaryWorkspace`; `tests/e2e/02-onboarding.spec.ts` covers the happy path with mocked API.

Feature toggles / segment routing:

* What exists: Segment selection maps business types to workspace paths; protected routes redirect users based on `onboardingCompleted`, `primaryWorkspace`, `segment`, and `userType`.
* Relevant files: `src/views/routes.tsx`, `src/modules/onboarding/SubSegmentView.tsx`, `backend/src/routes/user.ts`, `src/verticals/index.ts`.
* Persistence level: Backend-connected for final user profile; route guards are frontend-only.
* Evidence: `workspacePaths` in `backend/src/routes/user.ts` maps restaurant/pharmacy/supermarket/retail to app paths; TODO mappings send autoparts to retail, clinic to pharmacy, and services to personal.

Restaurant workflow:

* What exists: Menu, tables, POS order creation, KDS status updates, order status updates, billing view, and dashboard metrics.
* Relevant files: `backend/src/routes/restaurant.ts`, `backend/src/db/schema.ts`, `backend/src/db/seed.ts`, `src/api/restaurant.api.ts`, `src/modules/commerce/restaurant/views/*`, `tests/e2e/03-restaurant-loop.spec.ts`, `backend/src/scripts/verify_restaurant_core.ts`.
* Persistence level: Backend-connected and database-backed for menu, tables, orders, KDS tickets, and payments API; frontend billing currently marks orders paid through status update, not the payments endpoint.
* Evidence: restaurant tables include `restaurant_menus`, `menu_categories`, `menu_items`, `restaurant_tables`, `restaurant_orders`, `restaurant_order_items`, `kds_tickets`, and `restaurant_payments`. E2E restaurant loop exists but is mocked and the full Playwright command timed out locally.

Retail / Supermarket workflow:

* What exists: Retail and supermarket screens for POS, catalog, inventory, procurement, reports/settings; shared API services for inventory, product search, orders, suppliers, and procurement.
* Relevant files: `src/modules/commerce/retail/views/*`, `src/modules/commerce/supermarket/views/*`, `src/core/services/inventory.service.ts`, `src/core/services/orders.service.ts`, `src/core/services/procurement.service.ts`, `backend/src/routes/inventory.ts`, `backend/src/routes/orders.ts`, `backend/src/routes/suppliers.ts`.
* Persistence level: Partial. Inventory/orders/supplier procurement are backend-connected and persistent; retail customers, retail sales history, and retail settings are local browser persistence through Zustand `persist`.
* Evidence: backend `inventory_items`, `products`, `orders`, and `suppliers` tables exist; retail store persists to `localStorage` key `one-os-retail`.

Pharmacy:

* What exists: Pharmacy dashboard, catalog, inventory, suppliers, procurement, dispensing/POS, prescriptions, staff, and reports views.
* Relevant files: `src/modules/commerce/pharmacy/manifest.ts`, `src/modules/commerce/pharmacy/views/*`, `src/modules/commerce/pharmacy/store/pharmacy.store.ts`.
* Persistence level: Frontend-only.
* Evidence: `pharmacy.store.ts` contains `INITIAL_INVENTORY` and `INITIAL_RX` mock data and local Zustand actions; no backend pharmacy routes or pharmacy tables were found.

Role-based access:

* What exists: Backend JWT middleware and `requireRole`; frontend admin route guard for `admin` and `owner`.
* Relevant files: `backend/src/middleware/auth.ts`, `backend/src/routes/admin.ts`, `backend/src/routes/inventory.ts`, `backend/src/routes/orders.ts`, `backend/src/routes/suppliers.ts`, `src/views/routes.tsx`.
* Persistence level: Backend-connected.
* Evidence: admin routes require `owner` or `admin`; inventory writes require owner/admin/manager; orders require owner/admin/manager/staff; route guards redirect non-admin frontend users from `/admin`.

Audit logs:

* What exists: `audit_logs` table, helper `logAudit`, admin audit log UI/API, and explicit audit inserts for admin actions.
* Relevant files: `backend/src/db/schema.ts`, `backend/src/utils/audit.ts`, `backend/src/routes/admin.ts`, `backend/src/routes/inventory.ts`, `backend/src/routes/orders.ts`, `backend/src/routes/suppliers.ts`, `src/views/admin/AuditLogsPage.tsx`, `src/api/admin.api.ts`.
* Persistence level: Backend-connected and database-backed, but partial coverage.
* Evidence: inventory stock updates, inventory create, generic order create, supplier procurement, and admin mutations write audit records. Restaurant-specific menu/order/KDS/payment actions do not call `logAudit`.

Playwright E2E tests:

* What exists: Five Playwright specs for OTP login, onboarding to restaurant, restaurant POS/KDS/billing loop, personal navigation, and sign out.
* Relevant files: `playwright.config.ts`, `tests/e2e/*.spec.ts`, `tests/e2e/fixtures.ts`.
* Persistence level: Frontend E2E with mocked backend routes.
* Evidence: fixtures intercept `/api/auth/*`, `/api/user/profile`, and `/api/restaurant/**`; the real backend and real database are not exercised by Playwright.

Deployment configuration:

* What exists: Vercel config for SPA frontend, Railway-style backend process, deployment guide for Railway + Supabase + Vercel.
* Relevant files: `vercel.json`, `Procfile`, `DEPLOYMENT.md`, `.env.example`, `backend/.env.example`.
* Persistence level: Configuration only; no successful deployed environment was verified from this checkout.
* Evidence: `vercel.json` rewrites all routes to `index.html`; `Procfile` starts backend; `DEPLOYMENT.md` lists Railway, Supabase, Vercel, and launch checks.

## 3. Broken, incomplete, or risky areas

1. Severity: Blocker
   Why it matters for a real beta customer: After onboarding and a later re-login, the JWT `businessId` can become a route path such as `/app/restaurant` instead of the seeded/data business id `biz_main`, causing workspace APIs to query the wrong tenant.
   Relevant files: `backend/src/routes/auth.ts`, `backend/src/routes/user.ts`, `backend/src/db/schema.ts`.
   Smallest recommended fix: Separate workspace route path from business/tenant id; keep `primaryWorkspace` as route path only if intended, and issue JWT `businessId` from a stable business id field.
   Blocks production deployment: Yes.

2. Severity: Blocker
   Why it matters for a real beta customer: Required database validation, seed, OTP verification, and restaurant verification cannot run in this checkout because `DATABASE_URL` is not configured.
   Relevant files: `backend/src/db/client.ts`, `backend/drizzle.config.ts`, `backend/src/scripts/verify_otp.ts`, `backend/src/scripts/verify_restaurant_core.ts`, `backend/package.json`.
   Smallest recommended fix: Configure a beta/staging Postgres `DATABASE_URL`, run `npm run db:push`, `npm run db:seed`, `npm run verify:otp`, and `npm run verify:restaurant`.
   Blocks production deployment: Yes.

3. Severity: High
   Why it matters for a real beta customer: Playwright E2E is currently not producing a pass/fail result; the command timed out twice after starting all five tests.
   Relevant files: `playwright.config.ts`, `tests/e2e/*.spec.ts`.
   Smallest recommended fix: Debug the hanging Playwright run, ensure each spec completes, and add a CI-safe reporter/artifact path.
   Blocks production deployment: Yes.

4. Severity: High
   Why it matters for a real beta customer: Restaurant payment records are not created by the frontend billing path, even though the backend has `POST /api/restaurant/orders/:id/payments`.
   Relevant files: `src/modules/commerce/restaurant/views/BillingView.tsx`, `src/api/restaurant.api.ts`, `backend/src/routes/restaurant.ts`, `backend/src/db/schema.ts`.
   Smallest recommended fix: Add a frontend API method for the payment endpoint and use it when marking a ready/served order as paid.
   Blocks production deployment: No, but blocks reliable financial records for beta.

5. Severity: High
   Why it matters for a real beta customer: Pharmacy is presented as a workspace but uses mock in-memory data only, including prescriptions and stock.
   Relevant files: `src/modules/commerce/pharmacy/store/pharmacy.store.ts`, `src/modules/commerce/pharmacy/views/*`.
   Smallest recommended fix: Do not choose pharmacy for first beta, or label it internal/mock until persistent backend support exists.
   Blocks production deployment: No if pharmacy is excluded from beta scope.

6. Severity: Medium
   Why it matters for a real beta customer: Audit logs are partial; restaurant menu/order/KDS/payment actions are not audited.
   Relevant files: `backend/src/utils/audit.ts`, `backend/src/routes/restaurant.ts`, `backend/src/routes/inventory.ts`, `backend/src/routes/orders.ts`, `backend/src/routes/suppliers.ts`.
   Smallest recommended fix: Add `logAudit` calls to restaurant create/status/payment mutations.
   Blocks production deployment: No, but reduces supportability and accountability.

7. Severity: Medium
   Why it matters for a real beta customer: Rate limiting is process-local memory keyed by `x-forwarded-for` or `unknown-ip`, so it is not durable across restarts/instances and can collapse unidentified traffic into one bucket.
   Relevant files: `backend/src/middleware/rateLimit.ts`, `backend/src/index.ts`.
   Smallest recommended fix: Use trusted proxy IP parsing and a managed/shared limiter for production, or at minimum configure Railway proxy headers explicitly.
   Blocks production deployment: No for one closely supported beta, but risky.

8. Severity: Medium
   Why it matters for a real beta customer: No security headers middleware was found, and JWTs are stored in `localStorage`.
   Relevant files: `backend/src/index.ts`, `src/store/auth.store.ts`, `src/api/http.ts`.
   Smallest recommended fix: Add security headers/CSP at Vercel/backend and document XSS posture; consider httpOnly cookie sessions later.
   Blocks production deployment: No for internal testing; should be addressed before broader beta.

9. Severity: Medium
   Why it matters for a real beta customer: Retail sales, customers, and settings persist only in browser local storage, not shared server state.
   Relevant files: `src/modules/commerce/retail/store/retail.store.ts`, `src/modules/commerce/retail/views/*`.
   Smallest recommended fix: Do not use retail customer/sales history as source of truth for beta, or wire these records to backend tables.
   Blocks production deployment: No if first beta scope uses restaurant only.

10. Severity: Low
    Why it matters for a real beta customer: Privacy and terms pages/routes were not found, despite handling business, user, order, and pharmacy-like data.
    Relevant files: `src/views/routes.tsx`, `src/modules/public/*`.
    Smallest recommended fix: Add basic privacy/terms pages before external beta sign-in.
    Blocks production deployment: No for internal testing; yes for public beta.

## 4. Production readiness checklist

* Production environment variables: Partial. Variables are documented in `.env.example`, `backend/.env.example`, and `DEPLOYMENT.md`; current local command runs lacked `DATABASE_URL`.
* SMTP / OTP email delivery: Partial. SMTP transport is implemented; no live SMTP configuration was verified.
* Database persistence: Partial. Postgres/Drizzle persistence exists; local schema/seed/verify could not run without `DATABASE_URL`.
* Database backup and restore: Partial. `backend/src/scripts/backup.ts` only prints guidance to use Supabase backups/PITR or `pg_dump`; no restore command or tested run exists.
* Error handling: Partial. Backend has global `onError` and request ids; many route catches return generic errors.
* Logging: Partial. Hono logger and console errors exist; no structured production log sink was found.
* Monitoring: Missing. No Sentry, uptime monitor, metrics, or alerting configuration found.
* Security headers: Missing. No CSP/HSTS/frame/content-type headers middleware found.
* Rate limiting: Partial. In-memory limiter exists globally.
* Authentication protection: Verified. JWT middleware protects API routes; frontend route guards protect app/admin routes.
* Authorization / roles: Partial. Backend RBAC exists for admin/inventory/order/procurement; restaurant routes require auth but no role restrictions.
* Audit logs: Partial. Schema/API/UI exist, but restaurant workflow is not audited.
* Data validation: Partial. Auth/profile/inventory/orders/suppliers/restaurant routes validate core fields; admin update endpoints accept broad bodies.
* Privacy / terms pages: Missing. No route/page found.
* Mobile usability: Unknown. Responsive CSS exists in places, but no mobile verification command or screenshot was run for this audit.
* E2E test coverage: Partial. Five mocked Playwright specs exist; command timed out and does not exercise real backend/database.
* Build and lint status: Verified. `npm run build` and `npm run lint` passed.
* Vercel configuration: Verified. `vercel.json` exists with build command, output directory, and SPA rewrite.
* Railway configuration: Partial. `Procfile` and `DEPLOYMENT.md` exist; no Railway project/config file or deployed health check was verified.
* CORS and API URL configuration: Verified. Backend uses `CORS_ORIGINS` in production; frontend uses `VITE_API_BASE_URL`.

## 5. First-beta critical path

1. Fix the tenant/workspace identity bug so JWT `businessId` is a stable business id, not a frontend path.
2. Provision a staging/beta Supabase Postgres database and set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, and SMTP variables.
3. Run `npm run db:push` and `npm run db:seed` from `backend/`.
4. Run `npm run verify:otp` and `npm run verify:restaurant` from `backend/` against the beta database.
5. Fix the Playwright hang and require `npx playwright test` to complete successfully.
6. Deploy backend to Railway and verify `/health`; deploy frontend to Vercel with `VITE_API_BASE_URL` pointing at Railway.
7. Exercise one real OTP sign-in, onboarding to restaurant, menu/table load, POS order, KDS completion, and billing/payment in the deployed environment.
8. Add minimum supportability checks: review backend logs, verify audit coverage for selected beta actions, and document backup/restore responsibility.

Single most suitable currently implemented workspace for first beta: Restaurant. It has the most complete code evidence: persistent schema, backend routes, seed data, frontend API wiring, E2E coverage, and a backend restaurant verification script. Supermarket/retail have persistent inventory/order pieces but more local-only workflow state. Pharmacy is frontend mock-only.

## 6. Exact commands and results

`npm run build`

* Result: Passed.
* Summary: `tsc -b && vite build` completed successfully; Vite transformed 1872 modules and built `dist/` in 32.73s.

`npm run lint`

* Result: Passed.
* Summary: `eslint .` completed with no reported errors.

`npx playwright test`

* Result: Failed by timeout.
* First run: timed out after 180594 ms.
* Second run: timed out after 360708 ms.
* Output summary before timeout: `Running 5 tests using 4 workers`; it listed all five specs (`01-otp-login`, `02-onboarding`, `03-restaurant-loop`, `04-personal-navigation`, `05-sign-out`) but did not print pass/fail completion.
* Affected files: `playwright.config.ts`, `tests/e2e/*.spec.ts`, `tests/e2e/fixtures.ts`.

Backend test command:

* No `test` script exists in `backend/package.json`.
* Closest backend verification commands found and run:

`npm run build` from `backend/`

* Result: Passed.
* Summary: `tsc --noEmit` completed successfully.

`npm run verify:otp` from `backend/`

* Result: Failed.
* Error summary: `Error: DATABASE_URL is required. Run drizzle-kit push before OTP verification.`
* Affected file: `backend/src/scripts/verify_otp.ts`.

`npm run verify:restaurant` from `backend/`

* Result: Failed.
* Error summary: `Error: DATABASE_URL is required. Point it at the Supabase Postgres connection string before running this verification.`
* Affected file: `backend/src/scripts/verify_restaurant_core.ts`.

Database migration or schema validation command:

`npm run db:push` from `backend/`

* Result: Failed.
* Error summary: Drizzle read `backend/drizzle.config.ts` but reported `Please provide required params for Postgres driver: [x] url: ''`.
* Affected files: `backend/drizzle.config.ts`, `backend/src/db/schema.ts`.

`npm run db:seed` from `backend/`

* Result: Failed.
* Error summary: `Error: DATABASE_URL is required. Use the Supabase pooled Postgres connection string.`
* Affected file: `backend/src/db/client.ts`.

Additional migration scripts:

* `backend/src/db/migrate_restaurant_core.ts`, `migrate_phase2_5.ts`, and `migrate_phase3.ts` only print that schema is managed by Drizzle Postgres and to run `npx drizzle-kit push`.

## 7. Recommended next implementation task

Fix business tenant identity before beta.

Implementation brief: Separate route/workspace navigation from backend tenant identity. Add or use a stable business id for JWT `businessId`, keep frontend workspace paths as navigation-only values, update onboarding/profile serialization accordingly, and add a focused verification that a restaurant user can onboard, log out, log back in, and still load the same restaurant menu/tables/orders from the same tenant.

## Final verdict

Not ready for beta

The frontend build and lint pass, and there is meaningful backend work for OTP, onboarding, admin, inventory/orders/suppliers, and restaurant operations. However, the repository is not beta-ready because the tenant identity bug can break persisted workspace data after re-login. The database cannot currently be pushed, seeded, or verified in this checkout because `DATABASE_URL` is absent. Playwright E2E does not complete, and the existing E2E tests mock the backend rather than validating real persistence. Restaurant is the strongest first-beta candidate, but payment recording, audit coverage, and deployment verification still need tightening before a real customer depends on it.
