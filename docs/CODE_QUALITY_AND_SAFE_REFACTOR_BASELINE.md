# Q360 Code Quality and Safe Refactor Baseline

## 1. Current architecture map

Q360 is a React 19/Vite frontend with a Hono/Drizzle/Postgres backend. The root `package.json` exposes `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`, and `npm run test:e2e`. The backend `package.json` exposes `npm run build`, `npm run db:push`, `npm run db:seed`, and verification scripts for Restaurant, Restaurant service flow, Restaurant setup, Business Pulse, tenant identity, JWT initialization, OTP, and Resend live email.

The frontend API boundary is `src/api/http.ts`, which uses `VITE_API_BASE_URL || http://localhost:3001/api` and sends `localStorage` `auth_token` as a bearer token. `src/api/restaurant.api.ts` is the dedicated Restaurant client for dashboard, menu, tables, orders, pay-now takeaway orders, payments, cancellation, and KDS.

Main backend route groups are `backend/src/routes/auth.ts`, `user.ts`, `inventory.ts`, `orders.ts`, `suppliers.ts`, `admin.ts`, and the large dedicated `restaurant.ts`. Shared tenant and auth helpers live in `backend/src/middleware/auth.ts` and `backend/src/utils/tenant.ts`. Restaurant domain transition and authorization logic is partially extracted into `backend/src/services/restaurantDomain.ts`; most HTTP validation, persistence, response shaping, timing instrumentation, and audit writes remain in `backend/src/routes/restaurant.ts`.

Deployment configuration is split between Vercel frontend config (`vercel.json`, `.vercelignore`) and Railway backend config (`railway.json`, `Procfile`, `nixpacks.toml`). `railway.json` runs `cd backend && npm run db:push` as `preDeployCommand`, then `cd backend && npm start` with `/health` as the health check. `vercel.json` builds with `npm run build`, outputs `dist`, and rewrites all routes to `index.html`. `.vercelignore` excludes `backend/`.

## 2. Production-critical flows that must stay protected

The highest-risk protected flows are JWT-derived tenant identity, OTP login/session restoration, onboarding-to-workspace routing, Restaurant menu/table setup, Restaurant order creation, Restaurant pay-now takeaway order creation, Restaurant KDS transitions, Restaurant delivery/collection/payment lifecycle, cancellation behavior, legacy Restaurant owner-compatible authorization, audit log creation, and deployment environment separation.

Restaurant order creation is no longer only the old generic `/api/orders` path. `src/modules/commerce/restaurant/views/PosView.tsx` calls `restaurantApi.createOrder` or `restaurantApi.createPayNowTakeawayOrder`; those hit `backend/src/routes/restaurant.ts`. The old generic `backend/src/routes/orders.ts` remains active for supermarket/retail-style commerce flows and must not be deleted as part of Restaurant cleanup.

Restaurant payment behavior is production-critical because `backend/src/routes/restaurant.ts` writes `restaurant_payments`, derives legacy order status from service/payment state, rejects duplicate completed payments, releases tables only through lifecycle rules, and is covered by `verify:restaurant` and service-flow verification evidence in docs.

Restaurant KDS behavior is production-critical because POS creates tickets, Kitchen reads `/restaurant/kds`, KDS updates update both `kds_tickets` and `restaurant_orders`, and cancellation also cancels related KDS tickets.

## 3. Tenant-isolation and security-sensitive code

Tenant identity is JWT-derived. `backend/src/middleware/auth.ts` verifies the bearer token, sets `userId`, `userEmail`, `userRole`, and `businessId`, rejects JWT `businessId` values that are workspace routes such as `/app/...`, and falls back to `biz_main` only for missing legacy token business IDs.

`backend/src/utils/tenant.ts` defines `DEFAULT_BUSINESS_ID`, `isWorkspaceRoute`, `resolveJwtBusinessId`, `ensureBusinessRecord`, and `ensureUserBusiness`. Repository docs state `users.business_id` is the stable backend tenant pointer and `primaryWorkspace` is a frontend route value.

Security-sensitive files that must be treated as guarded boundaries are:

- `backend/src/middleware/auth.ts`
- `backend/src/utils/tenant.ts`
- `backend/src/routes/auth.ts`
- `backend/src/routes/user.ts`
- `backend/src/routes/admin.ts`
- `backend/src/routes/restaurant.ts`
- `backend/src/services/restaurantDomain.ts`
- `backend/src/utils/audit.ts`
- `src/store/auth.store.ts`
- `src/api/http.ts`
- `src/views/routes.tsx`

Audit logs are written through both direct `db.insert(auditLogs)` calls in admin routes and `logAudit` in shared utilities/operational routes. `logAudit` swallows logging failures after printing an error, so refactors must preserve current API behavior while adding tests before changing audit semantics.

## 4. Persistent versus mock versus browser-only modules

Persistent production-backed modules from current code evidence:

- Auth/session/profile: `backend/src/routes/auth.ts`, `user.ts`, `users`, `otp_codes`, `businesses`.
- Admin users/businesses/settings/audit logs: `backend/src/routes/admin.ts`, `audit_logs`, `system_settings`.
- Restaurant menu, tables, orders, order items, KDS tickets, payments, dashboard, and Business Pulse snapshot: `backend/src/routes/restaurant.ts` plus Restaurant tables in `backend/src/db/schema.ts`.
- Supermarket/shared commerce inventory, products, generic orders, suppliers/procurement: `backend/src/routes/inventory.ts`, `orders.ts`, `suppliers.ts`.

Partially persistent modules:

- Retail uses shared inventory/order/procurement APIs for catalog/inventory/POS/procurement, but also has browser-persisted local retail store state in `src/modules/commerce/retail/store/retail.store.ts`.
- Supermarket mixes persistent inventory/products/orders/suppliers/procurement with mock stats, reports, and offers through `stats.service.ts` and `promotions.service.ts`.
- Restaurant views use persistent APIs for dashboard/menu/tables/POS/KDS/billing/floor, while staff, inventory, reports, and settings are static or display-only surfaces.

Mock-only or browser-only modules:

- Pharmacy is Zustand/store-backed browser state in `src/modules/commerce/pharmacy/store/` and view files; there is no dedicated backend persistence in inspected routes.
- Personal dashboard/navigation uses frontend components and E2E mocks, not inspected backend persistence.
- Marketplace, logistics, merchants, and several public/support surfaces are shell/static screens.
- `src/core/mocks/` remains live through stats, reports, offers, and fixtures.

Test fixtures and mocks:

- `tests/e2e/fixtures.ts` mocks OTP, profile, Restaurant API, KDS, payment, and logout using Playwright `page.route`.
- Browser E2E tests verify rendered flows and navigation, not live backend persistence.

## 5. Duplicate or overlapping code candidates

There is real overlap between generic commerce order code and Restaurant-specific order code. `backend/src/routes/orders.ts`, `src/core/services/orders.service.ts`, supermarket POS, and retail POS are generic commerce paths. `backend/src/routes/restaurant.ts`, `src/api/restaurant.api.ts`, and Restaurant POS/KDS/Billing are Restaurant-specific lifecycle paths. This overlap needs labeling and tests, not deletion.

There is overlap between admin direct audit inserts and `backend/src/utils/audit.ts`. This is a candidate for a later adapter only after audit coverage exists.

There is overlap between frontend route/workspace mappings in `src/views/routes.tsx`, onboarding views, and backend `user.ts` workspace mapping comments for legacy segment aliases such as auto parts to retail, clinic to pharmacy, and services to personal. These mappings must remain compatibility behavior during beta.

There is overlap between mock services and persistent services in `src/core/services/`, especially supermarket stats/reports/offers versus persistent inventory/orders/procurement.

## 6. Large or high-complexity files

Largest inspected files by size include:

- `backend/src/routes/restaurant.ts` at 86,368 bytes.
- `backend/src/scripts/verify_restaurant_service_flow.ts` at 82,820 bytes.
- `src/modules/public/LandingView.tsx` at 53,460 bytes.
- `backend/src/scripts/verify_restaurant_core.ts` at 24,549 bytes.
- `src/modules/commerce/restaurant/views/PosView.tsx` at 19,697 bytes.
- `src/views/routes.tsx` at 19,521 bytes.
- `src/modules/commerce/restaurant/views/BillingView.tsx` at 18,525 bytes.
- `backend/src/routes/admin.ts` at 17,536 bytes.

The main high-complexity concern is `backend/src/routes/restaurant.ts`, because it combines route handling, authorization lookup, validation, lifecycle transitions, persistence, response mapping, performance timing, audit logging, and dashboard/Business Pulse calculations.

## 7. Dead-code candidates requiring manual review

Do not automatically delete any of these. They are unused-looking or mock-looking, but repository evidence shows they may be fixtures, compatibility shims, demos, or planned surfaces:

- `src/core/services/auth.service.ts`.
- `src/core/mocks/*`.
- Design preview folders.
- `scripts/e2e-verify.ts` and `scripts/verify_supermarket_loop.ts`.
- Generic `backend/src/routes/orders.ts` while retail/supermarket still call generic order services.
- Legacy segment mappings in onboarding and `backend/src/routes/user.ts`.
- Pharmacy, personal, logistics, merchants, marketplace, school, and public views.
- Historical/audit documentation under `docs/`.
- Verification scripts, even when they reset fixed staging tenants.

## 8. Test coverage reality

Existing root commands are `npm run lint`, `npm run build`, and `npm run test:e2e`. Existing backend commands include `npm run build`, `npm run verify:tenant-identity`, `npm run verify:jwt-init`, `npm run verify:otp`, `npm run verify:restaurant`, `npm run verify:restaurant-setup`, `npm run verify:business-pulse`, and `npm run verify:restaurant-service-flow`.

Playwright E2E reality:

- `tests/e2e/01-otp-login.spec.ts` mocks OTP APIs and verifies UI login flow.
- `tests/e2e/02-onboarding.spec.ts` mocks OTP/profile/dashboard and verifies SME-to-Restaurant navigation.
- `tests/e2e/03-restaurant-loop.spec.ts` uses a mocked Restaurant API to verify POS to KDS to Billing browser behavior.
- `tests/e2e/04-personal-navigation.spec.ts` mocks auth/profile and verifies Personal navigation.
- `tests/e2e/05-sign-out.spec.ts` mocks logout and verifies sign-out UI behavior.

Therefore Playwright currently protects browser UI behavior, not live OTP delivery, real Railway API behavior, real tenant isolation, real Restaurant persistence, or real payment/KDS database state.

Backend verification scripts are the stronger persistence checks, but staging docs warn that several scripts create/delete fixed verification tenants and must run only against a verified isolated staging database.

## 9. Missing safety checks

Missing or weak safety checks before refactoring:

- No single documented CI gate currently combines lint, builds, mocked browser E2E, and isolated-staging backend verification order.
- Browser E2E mocks can pass while live API, CORS, SMTP/Resend, tenant persistence, or deployment variables are broken.
- There is no evident unit test harness for pure Restaurant lifecycle helpers in `restaurantDomain.ts`.
- Audit logging behavior lacks focused automated tests.
- Cross-tenant negative tests are not visible in Playwright; tenant identity is covered by backend verification scripts.
- Deployment docs require live Vercel/Railway/browser checks, but no concrete deployed URLs are present in repository evidence.
- `railway.json` runs `db:push` during deploy, which is operationally sensitive and must not be changed in a refactor baseline.

## 10. Refactor rules for Q360

Preserve current API behavior as non-negotiable. Do not change schemas, routes, request/response shapes, status codes, auth behavior, tenant identity, onboarding behavior, payment lifecycle, KDS lifecycle, deployment configuration, frontend behavior, or environment files during a refactor unless the task explicitly scopes and verifies that change.

Every refactor must be small, reversible, domain-focused, and protected by before/after checks. Prefer extracting pure helpers from existing code over changing behavior. Keep legacy Restaurant owner-compatible authorization intact. Keep `businessId` as the tenant key and keep `primaryWorkspace` as route/navigation state. Keep generic commerce and Restaurant order paths separate unless a later task explicitly proves shared behavior.

Do not combine product features with refactors. Do not delete mock or legacy-looking code without manual owner review and usage evidence. Do not run verification scripts that mutate data unless the database is confirmed isolated staging/test.

## 11. Recommended CI quality gate

Practical repository-fit gate:

1. Root frontend lint: `npm run lint`.
2. Root frontend production build: `npm run build`.
3. Backend TypeScript build: from `backend/`, `npm run build`.
4. Mocked browser E2E: root `npm run test:e2e` or `npx playwright test --reporter=list`.
5. For Restaurant/tenant/auth/payment/KDS changes only, run backend verification against a confirmed isolated staging database from `backend/`: `npm run verify:jwt-init`, `npm run verify:otp`, `npm run verify:tenant-identity`, `npm run verify:restaurant-setup`, `npm run verify:restaurant`, `npm run verify:business-pulse`, and `npm run verify:restaurant-service-flow`.

Do not make `db:push`, `db:seed`, or live Resend/browser checks unconditional CI steps unless the CI environment is explicitly isolated and approved. Do not claim deployed readiness from mocked Playwright tests.

## 12. Top three safe refactor candidates

Candidate 1: Extract Restaurant response mapping and lightweight request normalization from `backend/src/routes/restaurant.ts`.

- Risk or maintenance pain solved: reduces the 86 KB Restaurant route file without changing lifecycle behavior.
- Likely files/modules involved: `backend/src/routes/restaurant.ts`; possibly a new backend service/helper under `backend/src/services/restaurantResponses.ts` or extension of `backend/src/services/restaurantDomain.ts`.
- Safe or unsafe before beta users: safest of the three if limited to pure mapping/normalization and no persistence/auth changes.
- What must not change: routes, HTTP status codes, JSON shapes, tenant filters, audit writes, timing headers/body fields, order/payment/KDS state transitions.
- Database/API impact: none.
- Tenant-isolation impact: none; helper inputs must receive already-scoped rows and must not query by itself.
- Tests before changing code: `npm run lint`; root `npm run build`; backend `npm run build`; `npm run test:e2e`; if staging is available, backend `npm run verify:tenant-identity`, `npm run verify:restaurant`, and `npm run verify:restaurant-service-flow`.
- Tests after changing code: same commands as before; compare key Restaurant API responses in `verify:restaurant` output and mocked E2E behavior.
- Rollback approach: revert the helper extraction and inline mapping back into `restaurant.ts`; no schema/data rollback.

Candidate 2: Add focused unit-style coverage for pure Restaurant domain helpers before any further Restaurant lifecycle refactor.

- Risk or maintenance pain solved: protects `canPerformRestaurantAction`, legacy owner compatibility, service/payment status derivation, cancellation, and duplicate-payment rules before touching route code.
- Likely files/modules involved: `backend/src/services/restaurantDomain.ts`; backend package test setup if one is introduced.
- Safe or unsafe before beta users: safe if it only adds tests and no runtime dependency/tool churn that destabilizes CI.
- What must not change: production code, routes, schema, generated tokens, role behavior, or verification scripts.
- Database/API impact: none.
- Tenant-isolation impact: none directly, but tests should assert cross-business order denial.
- Tests before changing code: root `npm run lint`; backend `npm run build`; existing Restaurant verification scripts on isolated staging if available.
- Tests after changing code: same plus the new focused test command if added.
- Rollback approach: remove the new tests/test script only; no runtime rollback.

Candidate 3: Classify mock-backed modules in code comments or docs and avoid false production-readiness claims.

- Risk or maintenance pain solved: prevents product/refactor planning from treating browser-only or mock-only modules as tenant-safe production modules.
- Likely files/modules involved: docs only, or very small comments near `src/core/mocks`, `src/core/services/stats.service.ts`, `src/core/services/promotions.service.ts`, pharmacy store/views, and Personal stub views.
- Safe or unsafe before beta users: safe as docs-only; less safe if touching UI labels because it could alter frontend behavior.
- What must not change: UI text, routes, API calls, onboarding, or module availability.
- Database/API impact: none.
- Tenant-isolation impact: none.
- Tests before changing code: root `npm run lint` if code comments are touched; no tests required for docs-only.
- Tests after changing code: root `npm run lint` if code comments are touched; no tests required for docs-only.
- Rollback approach: revert documentation/comment-only changes.

## 13. Choose exactly one best next refactor

Best next refactor: Candidate 1, extract pure Restaurant response mapping and request normalization from `backend/src/routes/restaurant.ts`.

Reason: it is small, reversible, domain-focused, and attacks the highest-complexity production-critical file without changing behavior. It should be done only after recording before/after outputs from existing Restaurant verification and mocked browser E2E checks.

Scope limit: only move pure functions or shape-building code. Do not move database transactions, authorization checks, tenant filtering, route declarations, lifecycle transition decisions, audit logging, or deployment/script behavior in the first pass.

## 14. What must not be automatically deleted

Do not automatically delete generic order routes/services, mock data, pharmacy/browser stores, Personal stubs, design-preview folders, staging/live verification docs, old audit reports, verification scripts, seed scripts, compatibility route aliases, legacy segment mappings, or user-modified files.

Do not delete anything merely because it appears unused from static search. For this repository, unused-looking code may be a test fixture, browser-only demo, compatibility path, staging verification helper, or planned beta surface.

## 15. Regression checklist before every commit

Before every refactor commit:

- Confirm working tree and protect unrelated user changes.
- Identify whether the change touches tenant identity, auth, Restaurant order creation, payment, KDS, audit logs, onboarding, deployment config, or frontend behavior.
- Run `npm run lint`.
- Run `npm run build`.
- From `backend/`, run `npm run build`.
- Run `npm run test:e2e` or `npx playwright test --reporter=list`.
- If auth/tenant/Restaurant/payment/KDS/audit behavior is touched and an isolated staging database is confirmed, run `npm run verify:jwt-init`, `npm run verify:otp`, `npm run verify:tenant-identity`, `npm run verify:restaurant-setup`, `npm run verify:restaurant`, `npm run verify:business-pulse`, and `npm run verify:restaurant-service-flow`.
- For deployed readiness, run the live browser checklist separately against actual Vercel/Railway/staging URLs; do not treat mocked Playwright as live verification.
- Verify no schema, API, route, environment, deployment, onboarding, authentication, tenant isolation, payment lifecycle, KDS lifecycle, or frontend behavior changed unless explicitly scoped and reviewed.
