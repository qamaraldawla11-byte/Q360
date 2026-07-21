# Security Remediation — M3 Implementation Report

Date: 2026-07-18
Branch: `security/authz-evidence-baseline`
Status: **IMPLEMENTED + VERIFIED. Nothing committed or pushed. Awaiting architectural review.**
Evidence baseline: `docs/SECURITY_AUTHZ_M0_M1_BASELINE.md`, `docs/SECURITY_AUTHZ_M2_EVIDENCE.md`.

---

## 1. Exact files changed

| File | Change | Lines (git diff --stat) |
|---|---|---|
| `backend/src/routes/restaurant.ts` | 8 role gates inserted | +16 |
| `backend/src/routes/quotes.ts` | requireRole import + 2 route guards + param guard | +7 |
| `backend/src/routes/admin.ts` | create-user tenant validation + update allowlist | +56 |
| `backend/src/routes/auth.ts` | NULL-tenant fail-safe at OTP verify | +8 |
| `backend/src/routes/user.ts` | TENANT_IDENTITY_REQUIRED handling on PUT /profile | +12 |
| `backend/src/utils/tenant.ts` | TenantIdentityRequiredError + NULL guard | +8 |
| `src/views/admin/UsersPage.tsx` | explicit business ID input, validation, disabled submit | +18 |
| `backend/package.json` | register `verify:security-authz` | +1 |
| `backend/src/scripts/verify_security_authz.ts` | **new** — 41-check verification script | new file |

Not touched: schema, migrations, seed, deployment config, `GuestQConcierge.tsx`,
`LandingView.tsx`, design-previews, unrelated docs/tests. The `GuestQConcierge.tsx` and
`LandingView.tsx` diffs visible in `git diff` are **pre-existing unrelated working-tree
changes** (confirmed dirty at M3 pre-flight, before any M3 edit). They must be excluded
from any M3 commit.

## 2. Exact policy applied per route

All gates reuse the existing convention: `restaurantActorFor(c)` + `canUseQ(actor)`
(= owner, admin, manager, legacy-owner-compatible) + `forbid(c)` → 403
`{ error: 'Forbidden: Insufficient permissions' }`. Success responses, paths, and tenant
scoping unchanged.

| Route | Policy |
|---|---|
| POST `/api/restaurant/menu/categories` | owner/admin/manager/legacy-owner |
| PATCH `/api/restaurant/menu/categories/:id` | owner/admin/manager/legacy-owner |
| DELETE `/api/restaurant/menu/categories/:id` | owner/admin/manager/legacy-owner |
| POST `/api/restaurant/menu/items` | owner/admin/manager/legacy-owner (all fields; no kitchen 86 permission) |
| PATCH `/api/restaurant/menu/items/:id` | owner/admin/manager/legacy-owner (all fields) |
| POST `/api/restaurant/menu/items/:id/image` | owner/admin/manager/legacy-owner |
| POST `/api/restaurant/tables` | owner/admin/manager/legacy-owner |
| PATCH `/api/restaurant/tables/:id/status` | owner/admin/manager/legacy-owner **+ waiter** (FloorView operational route) |
| POST `/api/quotes` | `requireRole(['owner','admin','manager'])` (customers.ts convention) |
| PATCH `/api/quotes/:id` | `requireRole(['owner','admin','manager'])` |
| All reads (menu, tables, quotes) | unchanged — any authenticated tenant role |

## 3. Admin update allowlist (PATCH `/admin/users/:id`)

Allowed (validated): `name` (non-empty string), `role` (`user|cashier|manager|admin|owner`
— the exact set the admin UI offers), `status` (`active|inactive`), `isLocked` (boolean),
`moduleAccess` (string[]).

Protected — silently ignored: `id`, `email`, `businessId`, `primaryWorkspace`,
`createdAt`, `userType`, `segment`, `businessName`, `country`, `currency`,
`onboardingCompleted`, and any unknown key. Body containing *only* protected/unknown
fields → 400 `{ error: 'No supported fields to update' }`. Invalid values for allowed
fields → 400 with field-specific message. Audit log records the applied subset only.
Response shape `{ message: 'User updated' }` preserved. Admin-only router guard untouched.

## 4. Tenant-identity behavior before → after

**Admin create (POST `/admin/users`)**
- Before: body `businessId` written to `primaryWorkspace` (defaulting to `'biz_main'`);
  `users.businessId` left NULL.
- After: `businessId` required, must reference an existing `businesses` row
  (400 `'businessId is required'` / `'businessId must reference an existing business'`);
  written to `users.businessId`; `primaryWorkspace: null`.

**OTP verify (POST `/auth/verify`)**
- Before: user with NULL `businessId` → `resolveJwtBusinessId` → `'biz_main'`,
  persisted to `users.businessId`, JWT issued for the shared demo tenant.
- After: NULL `businessId` → **400 `{ error: 'TENANT_IDENTITY_REQUIRED', message: 'A stable business identity is required.' }`**,
  no JWT, no persist. Legacy workspace-route `businessId` migration (`/app/…` → biz_main
  + `ensureBusinessRecord`) explicitly preserved for pre-tenant accounts.

**Business setup (PUT `/user/profile` via `ensureUserBusiness`)**
- Before: NULL `businessId` → silently resolved to `biz_main` and persisted.
- After: NULL → same 400 TENANT_IDENTITY_REQUIRED contract. Workspace-route legacy
  values keep migrating.

**Unchanged by design:** `DEFAULT_BUSINESS_ID` constant, schema defaults (14),
seed fixtures (22), `middleware/auth.ts:46` legacy-token fallback (documented residual),
middleware 401 for workspace-route token `businessId`.

**Admin frontend (`UsersPage.tsx`)**: hardcoded `businessId: 'biz_main'` removed; explicit
Business ID input; Create disabled + amber hint shown while empty; no silent fallback.

## 5. Tests added

`backend/src/scripts/verify_security_authz.ts` (registered as `verify:security-authz`),
41 checks, in-process Hono + real staging DB, self-cleaning fixtures:

- Restaurant: waiter ×7 management mutations → 403; kitchen menu update → 403; staff
  create item/table → 403; waiter table-status → 200; owner create category → 201;
  manager create table → 201; legacy owner-compatible creator → 201; waiter menu read → 200.
- Quotes: staff POST/PATCH → 403; manager POST → 201; owner PATCH → 200; staff read → 200.
- Admin create: missing businessId → 400; nonexistent → 400; valid → 201 with correct
  non-NULL, non-biz_main `users.businessId`; owner token → 403.
- Admin update: protected-only body → 400; mixed body → 200 with name/role applied and
  email/businessId proven immutable; unknown role → 400.
- Tenant identity: wrong-OTP control → 400 `'Invalid sign-in code'` (distinct cause);
  valid OTP + NULL businessId → 400 with the exact TENANT_IDENTITY_REQUIRED body, no JWT,
  `users.businessId` still NULL; valid-tenant control → 200 + token carrying stable id;
  workspace-route token → 401 preserved.

## 6. Commands and results

| Command | Result |
|---|---|
| backend `tsc --noEmit` | ✅ clean |
| `tsx src/scripts/verify_security_authz.ts` | ✅ 41/41 PASS |
| Full maintained suite (21 baseline scripts, incl. tenant-identity, restaurant ×4, quotes, OTP, JWT) | ✅ 21/21 PASS |
| frontend `tsc -b` | ✅ clean |
| frontend `vite build` | ✅ built in 8.23s |
| `git diff --check` | ✅ no whitespace errors (CRLF notices only, pre-existing repo state) |

Logs: `tmp/m3_regression/*.log`.

## 7. Remaining uncertainty / residuals

1. `middleware/auth.ts:46` legacy-token fallback (token without `businessId` claim →
   biz_main) intentionally preserved — only reachable by pre-businessId legacy tokens.
   Recommend a follow-up milestone to time-box or remove it.
2. `ensureUserBusiness` workspace-route migration still resolves to `biz_main` for legacy
   accounts (by design); new NULL-identity users can no longer reach it via OTP (blocked
   at verify), so it is effectively legacy-only.
3. Admin PATCH remains cross-tenant by user id (platform-admin semantics) — unchanged,
   documented in M2.
4. `role` on admin create is not yet enum-validated (only update is) — existing behavior
   preserved deliberately; trivial follow-up if desired.
5. The legacy workspace-route OTP migration path is preserved by code inspection but was
   NOT executed end-to-end in tests, because executing it would mutate the shared
   `biz_main` business row in the staging DB (fixture safety).
6. `docs/SECURITY_AUTHZ_M0_M1_BASELINE.md`, `docs/SECURITY_AUTHZ_M2_EVIDENCE.md`, and this
   file were created during the evidence/remediation phases — keep-or-delete decision
   deferred to review.

## 8. Git diff summary

10 files changed, +992/−2371 — **but −2371/+~900 of that is the pre-existing unrelated
`LandingView.tsx`/`GuestQConcierge.tsx` working-tree churn**. Actual M3 footprint:
8 files, ~+126 lines, plus one new script (+~370 lines).

## 9. Git status

Branch `security/authz-evidence-baseline`. M3 files modified as listed in §1; new file
`backend/src/scripts/verify_security_authz.ts` untracked. Pre-existing unrelated dirt:
`src/modules/public/GuestQConcierge.tsx`, `src/modules/public/LandingView.tsx`, many
untracked docs/design-preview/tmp paths. **No commits, no pushes.**

## 10. Proposed commit split (NOT executed)

1. `fix(security): enforce role checks on restaurant menu/table mutations` —
   restaurant.ts only.
2. `fix(security): require management role for quote mutations` — quotes.ts only.
3. `fix(security): allowlist admin user updates and validate admin-created tenant
   identity` — admin.ts + UsersPage.tsx.
4. `fix(security): fail closed on missing tenant identity instead of biz_main fallback` —
   auth.ts + user.ts + utils/tenant.ts.
5. `test(security): add verify:security-authz coverage` — verify_security_authz.ts +
   backend/package.json.

Alternatively a single commit `fix(security): authorization and tenant-identity
remediation (M3)` if preferred. Docs (M0/M1/M2/M3) can be a separate docs commit or
dropped per review.

**STOP — awaiting architectural review. Do not commit or push until approved.**
