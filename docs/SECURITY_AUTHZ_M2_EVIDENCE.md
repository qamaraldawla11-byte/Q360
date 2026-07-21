# Security Remediation — M2 Per-Route Evidence Report

Date: 2026-07-18
Branch: `security/authz-evidence-baseline`
Status: **EVIDENCE ONLY. No application code, tests, schema, config, or dependencies were modified. Nothing committed or pushed.**
Baseline: M0 (21/21 verify scripts green, typecheck clean) and M1 (authorization map) accepted — see
`docs/SECURITY_AUTHZ_M0_M1_BASELINE.md` (created during the evidence-only phase; keep-or-delete decision deferred).

---

## 1. Restaurant — menu categories, menu items, tables

### 1.1 Guard call-path trace (required proof)

Every route below is mounted under the router-level `restaurant.use('/*', authMiddleware)` (`restaurant.ts:205`).
Call path for any authenticated request:

1. `authMiddleware` (`middleware/auth.ts:27-58`) — verifies JWT, rejects workspace-route `businessId` (401),
   sets `userId`, `businessId`, and `userRole` (via `resolveEffectiveBusinessRole`,
   `services/businessOwnership.ts:21-50`).
2. Handler runs. **For all menu/table mutation routes listed below, the handler body contains no call to
   `restaurantActorFor`, no role comparison, no `forbid`, and no `requireRole`.** Verified by reading each
   handler in full (line ranges below) and by grep: `restaurant.ts` role-gate usage exists only at
   lines 1771/1825 (bookings) and in Q/business-pulse handlers (`canUseQ`, `canReviewQDraft`).
3. Contrast — bookings DO gate: `restaurant.post('/bookings')` line 1771 and `restaurant.patch('/bookings/:id')`
   line 1825 call `restaurantActorFor(c)` and enforce `canUseQ(actor) || actor.role === 'waiter'`.

`resolveEffectiveBusinessRole` runs for every request (inside `authMiddleware`), but it only *resolves* the role
into context — nothing in the menu/table handlers *reads* it. Reachable `userRole` values for these routes:
`owner`, `admin`, `manager`, `staff`, `user`, `waiter`, `cashier`, `kitchen` (staff roles reach `users.role`
via invitation acceptance at `auth.ts:189`). Legacy restaurant creators surface as `owner` after upgrade.

### 1.2 Per-route evidence — menu categories

| Route | File:lines | Guards in handler | Current behavior | Expected rule (existing conventions) | Classification | Impact | Smallest correction | Confidence |
|---|---|---|---|---|---|---|---|---|
| POST `/menu/categories` | restaurant.ts:1524-1577 | authMiddleware only | Any authenticated user of the tenant creates a category | owner/admin/manager + legacy-owner-compatible (= `canUseQ` role set) | **Confirmed** | Waiter/kitchen/cashier can alter menu configuration tenant-wide | Add actor gate at handler top; 403 via existing `forbid` | High |
| PATCH `/menu/categories/:id` | restaurant.ts:1648-1664 | authMiddleware only | Any authenticated user renames categories (audit-logged) | same | **Confirmed** | same | same | High |
| DELETE `/menu/categories/:id` | restaurant.ts:1666-1680 | authMiddleware only | Any authenticated user deletes empty categories (audit-logged) | same | **Confirmed** | same | same | High |

### 1.3 Per-route evidence — menu items

| Route | File:lines | Guards in handler | Current behavior | Expected rule | Classification | Impact | Smallest correction | Confidence |
|---|---|---|---|---|---|---|---|---|
| POST `/menu/items` | restaurant.ts:1579-1646 | authMiddleware only | Any authenticated user creates items (can auto-create categories via `ensureCategory`) | owner/admin/manager + legacy-owner | **Confirmed** | Menu config writable by operational staff | Actor gate | High |
| PATCH `/menu/items/:id` | restaurant.ts:1682-1707 | authMiddleware only | Any authenticated user edits price/availability/etc. (audit-logged) | owner/admin/manager + legacy-owner. **Open question (review):** `isAvailable` toggling may be a legitimate 86'ing operation for kitchen/manager — no existing evidence kitchen uses it; recommend keeping management-only until product confirms | **Confirmed** | Price edits by any staff role = direct revenue risk | Actor gate | High |
| POST `/menu/items/:id/image` | restaurant.ts:1709-1739 | authMiddleware only | Any authenticated user replaces item images (audit-logged) | owner/admin/manager + legacy-owner | **Confirmed** | Content integrity | Actor gate | High |
| DELETE `/menu/items/:id` | — | — | **Route does not exist.** Item deletion is not exposed | n/a | n/a | n/a | none | High |

### 1.4 Per-route evidence — tables

| Route | File:lines | Guards in handler | Current behavior | Expected rule | Classification | Impact | Smallest correction | Confidence |
|---|---|---|---|---|---|---|---|---|
| POST `/tables` | restaurant.ts:1847-1883 | authMiddleware + module-enabled check (`isBusinessModuleEnabled`, line 1848) | Any authenticated user creates tables | owner/admin/manager + legacy-owner | **Confirmed** | Floor-plan config writable by any staff | Actor gate | High |
| PATCH `/tables/:id/status` | restaurant.ts:1885-1905 | authMiddleware + module-enabled check | Any authenticated user changes table status | **Different rule:** this is an operational floor-state endpoint — `FloorView.tsx:98` (floor/waiter surface) calls `updateTableStatus`. Closest existing convention: bookings allow `canUseQ(actor) \|\| waiter` (lines 1771/1825). Expected: owner/admin/manager/legacy-owner **+ waiter** | **Confirmed (missing check), role set = management + waiter** | Without any check, kitchen/cashier can also flip floor state | Actor gate with management+waiter set | High |
| DELETE `/tables/:id` | — | — | **Route does not exist.** | n/a | n/a | n/a | none | High |

**Reads preserved:** GET `/menu` (1506), GET `/tables` (1741) stay open to all authenticated tenant roles —
proven product rule: `verify_restaurant_core.ts:235-237` reads menu/tables as `waiter`; POS/KDS depend on this.

**Legacy-owner compatibility:** all gates must reuse the existing pattern
(`restaurantActorFor` + `isLegacyRestaurantOwnerCompatible`, i.e. the `canUseQ` role semantics at
restaurant.ts:844-846) so pre-ownership-model creator accounts keep working (protected rule).

---

## 2. Quotes

### 2.1 Full endpoint enumeration (quotes.ts, 363 lines, entire file read)

| Route | File:lines | Type | Guards | Current behavior |
|---|---|---|---|---|
| GET `/` | quotes.ts:187-194 | read | authMiddleware (router, line 12) | Any authenticated tenant user lists quotes |
| GET `/:id` | quotes.ts:197-207 | read | authMiddleware | Any authenticated tenant user reads a quote + items |
| POST `/` | quotes.ts:210-268 | mutation | authMiddleware | **Any authenticated tenant user creates quotes** (audit-logged) |
| PATCH `/:id` | quotes.ts:271-361 | mutation | authMiddleware | **Any authenticated tenant user updates draft quotes** (audit-logged) |
| DELETE | — | — | does not exist | — |

Tenant isolation itself is correct: every query is `businessId`-scoped (lines 191, 200, 286, 328, 343).
The gap is purely role authorization. Zero role references in the file (grep-verified).

### 2.2 Nearest Commerce conventions (existing behavior, not new policy)

| Module | Write rule | Source |
|---|---|---|
| **customers.ts** (same shared customers/quotes feature area) | POST, PATCH: `requireRole(['owner','admin','manager'])` | customers.ts:59, 98 |
| orders.ts | POST: `['owner','admin','manager','staff']` | orders.ts:42 |
| inventory.ts | mutations: `['user','owner','admin','manager']` | inventory.ts:36, 85, 175 |
| suppliers.ts | mutations: `['user','owner','admin','manager']` | suppliers.ts:16, 34, 62, 82 |
| purchasesExpenses.ts | router-wide `['owner','admin']` | purchasesExpenses.ts:13 |
| Existing quote tests | run as `role: 'owner'` only | verify_quotes.ts:52 |

**Determination:** quotes are customer-linked sales documents in the same shared module as customers;
the exact allowed set from the closest existing convention is **`['owner','admin','manager']`**
(customers.ts). Reads stay open to any authenticated tenant role (current product behavior; no
evidence reads need restriction, and the plan requires preserving read/write separation).

| Finding | Classification | Confidence |
|---|---|---|
| Quote mutations lack role checks | **Confirmed** (POST `/` 210-268, PATCH `/:id` 271-361) | High |

**Smallest correction:** route-level `requireRole(['owner','admin','manager'])` on the two mutations
(same pattern as customers.ts:59,98). No new vocabulary. Reads untouched.

---

## 3. Admin user update — PATCH `/admin/users/:id` (admin.ts:227-248)

Router guards: `authMiddleware` + `requireRole(['admin'])` (admin.ts:15-16). Not an auth gap — an
over-posting gap within the platform-admin role.

### 3.1 Exact field flow

```ts
const body = await c.req.json();                       // line 230 — unvalidated, untyped
await db.update(users).set(body).where(eq(users.id, id)); // line 232 — RAW BODY into .set()
```

Every key in the request body that matches a `users` column is written. The `users` columns
(schema.ts:14-43): `id, email, name, role, status, isLocked, userType, segment, businessName,
country, currency, onboardingCompleted, businessId, primaryWorkspace, moduleAccess, createdAt`.
(No password column exists — OTP-only; secrets live in `otpCodes.codeHash`, not reachable here.)

| Field | Writable today via raw body | Intentional? | Proposed allowlist |
|---|---|---|---|
| `name` | yes | yes | ✅ allow |
| `role` | yes (incl. `admin`/`owner`) | yes, admin function | ✅ allow, but validate against known role set |
| `status` | yes | yes (activate/deactivate exist) | ✅ allow (`active`/`inactive`) |
| `isLocked` | yes | yes (lock/unlock exist) | ✅ allow (boolean) |
| `primaryWorkspace` | yes | navigation metadata | ✅ allow (validated string) |
| `moduleAccess` | yes | yes (staff module grants) | ✅ allow (string[]) |
| `id` | yes | **no** — primary key overwrite attempt | ❌ reject/ignore |
| `email` | yes | **no** — OTP login identity; changing it hijacks the account | ❌ reject/ignore |
| `businessId` | yes | **no** — tenant identity; arbitrary cross-tenant move | ❌ reject/ignore |
| `userType`, `segment`, `businessName`, `country`, `currency`, `onboardingCompleted` | yes | owned by onboarding/profile flows | ❌ reject/ignore (defensive; revisit if product needs) |
| `createdAt` | yes | **no** — audit integrity | ❌ reject/ignore |
| unknown keys | drizzle drops/errors | — | ❌ ignore |

Additional observations:
- The `where` clause is `eq(users.id, id)` only — not `businessId`-scoped. Platform admins are
  cross-tenant by design here; noted, not changed in this task.
- **No frontend caller exists** for `adminApi.updateUser` (grep: only the API wrapper at
  admin.api.ts:124; no view calls it). Tightening this route carries near-zero UI regression risk.
- Audit log entry stores the full raw body (line 241) — after the fix it should record the allowlisted
  update instead (keeps audit honest).

| Finding | Classification | Confidence |
|---|---|---|
| Raw-body mass assignment in admin user update | **Confirmed** | High |

---

## 4. Admin user creation — POST `/admin/users` (admin.ts:188-224)

### 4.1 Exact trace

```ts
const { email, name, role, businessId } = body;          // line 191 — businessId accepted
const newUser: NewUser = {
    id: uuidv4(),
    email, name, role,
    primaryWorkspace: businessId || 'biz_main',          // line 202 — businessId → WRONG COLUMN
    status: 'active', isLocked: false, onboardingCompleted: false,
};                                                        // users.businessId NEVER SET → NULL
```

Source → destination of tenant identity:

| Value | Source | Destination | Correct? |
|---|---|---|---|
| `businessId` | request body | `primaryWorkspace` column (navigation metadata) | ❌ wrong column |
| `users.businessId` (tenant DB identity) | — | `NULL` (schema.ts:39, nullable, no default) | ❌ never set |
| `primaryWorkspace` | `businessId \|\| 'biz_main'` | metadata column holding a tenant id string or `'biz_main'` | ❌ semantic corruption both ways |

### 4.2 Comparison with every other user-creation flow

| Flow | businessId source | Evidence |
|---|---|---|
| OTP self-signup (new user, no invitation) | Fresh `biz_${randomUUID()}` + `ensureBusinessRecord` creates the business, role `owner` | auth.ts:162-164 |
| Staff invitation acceptance | Existing `invitation.businessId` (created by owner via staff invite) | auth.ts:163, 189 |
| Seed | Explicit `'biz_main'` fixture | seed.ts:36 |
| **Admin create** | **Caller-supplied existing business ID — provable intent:** the handler destructures `businessId` from the body (line 191) and the frontend form state carries `businessId` (UsersPage.tsx:11). The bug is purely that it lands in `primaryWorkspace` instead of `businessId`. | admin.ts:191,202 |

**Intended source: proven** — caller supplies an existing business ID. No speculation needed.

### 4.3 Compounding frontend fact

`UsersPage.tsx:11` initializes the create form with `businessId: 'biz_main'` and the modal renders
**no input for it** (only email, name, role — lines 81-103). So today every admin-created user gets
`primaryWorkspace='biz_main'`, `businessId=NULL`, and — via §5 site #1 — silently joins the shared
demo tenant at first login. The frontend default must change in M3 (minimal: send no businessId, or a
real selector); backend must not silently accept the missing identity regardless.

| Finding | Classification | Confidence |
|---|---|---|
| Admin-created users get `primaryWorkspace` but no stable `businessId` | **Confirmed** | High |

---

## 5. `biz_main` — complete classification (39 occurrences, 5 files)

| # | Site | Occurrences | Classification | Details |
|---|---|---|---|---|
| 1 | `db/schema.ts:68…284` (14 tenant-scoped tables) | 14 | **Schema default** | `businessId` column default on data tables (not `users`). In practice all route inserts set `businessId` explicitly; the default only fires for direct inserts that omit it. Legacy; do not touch in this task (schema protected rule). |
| 2 | `db/seed.ts:24…162` | 22 | **Seed/fixture** | Demo tenant `biz_main` + demo data. Legitimate dev fixture. |
| 3 | `scripts/verify_phase2_5.ts` | 1 | **Verification-only** | Legacy manual script (also hangs by design; see M0). |
| 4 | `utils/tenant.ts:5` | 1 | **Constant definition** | Source of truth for the fallback id. |
| 5 | `utils/tenant.ts:16` — `resolveJwtBusinessId` | 1 | **Production runtime fallback** | See 5.1 below. |
| 6 | `utils/tenant.ts:44` — `ensureUserBusiness` | 1 | **Production runtime fallback** | Business-setup flow (`routes/user.ts:101`): user with NULL/workspace-route businessId completing business setup lands in `biz_main` and `ensureBusinessRecord` renames/updates the shared tenant record with the user's business name/type. Reachable by any admin-created user who visits profile setup. Cross-tenant placement: yes. |
| 7 | `middleware/auth.ts:46` | 1 | **Legacy compatibility** (production-reachable) | Token without `businessId` claim → `biz_main`. All current issuance paths include the claim, so only pre-businessId legacy tokens reach it. Fail-open by design comment. Part of the same pattern; assess in M3-E but lower priority than #5/#6. |
| 8 | `routes/admin.ts:202` | 1 | **Production runtime fallback** | `primaryWorkspace: businessId \|\| 'biz_main'` — see §4. Removed as part of fix D. |

### 5.1 Site #5 — the primary production risk (full trace)

- **Caller:** `POST /auth/verify` — `auth.ts:204-211` (existing-user branch) and token issuance at 215/224.
- **Trigger condition:** authenticated OTP user whose `users.businessId` is `NULL` or a workspace route.
- **Who reaches it:** any admin-created user (§4: `businessId=NULL`, `status='active'`). OTP login
  (`/auth/login`) only blocks locked/inactive accounts — admin-created users pass.
- **Resulting behavior:** line 205 `resolveJwtBusinessId` → `'biz_main'`; line 206
  `ensureBusinessRecord('biz_main', …)`; lines 207-210 **persist `users.businessId='biz_main'`**;
  line 224 issues a JWT with `businessId: 'biz_main'`. Session restore (`/auth/session`,
  `authMiddleware`) then treats the user as a member of the shared demo tenant.
- **Cross-tenant placement:** **Yes — proven reachable by a real user through the normal OTP flow.**
  The user sees and can mutate `biz_main` data (and with finding 1/2 unfixed, can mutate its menu,
  tables, and quotes regardless of role).

| Finding | Classification | Confidence |
|---|---|---|
| `biz_main` fallback remains reachable for newly created/authenticated users | **Confirmed** | High |

**Fail-safe correction direction (M3-E, narrow):** in the `auth.ts:204-211` branch, distinguish
*legacy workspace-route* businessId (keep migration behavior — legacy compatibility, protected rule)
from *NULL* businessId (no tenant identity at all → reject authentication with a clear error instead
of issuing a `biz_main` token). Do not remove `DEFAULT_BUSINESS_ID` globally; seed, schema defaults,
and legacy-token compatibility remain.

---

## 6. Negative test design (requirement 8) — "admin-created user cannot authenticate into `biz_main`"

Script: new `backend/src/scripts/verify_admin_user_tenant_identity.ts`, following the
`verify_tenant_identity.ts` pattern (in-process Hono, real staging DB, crafted HS256 tokens,
`closeDatabase()` at the end).

**Setup**
1. Create business `biz_m2_neg_<ts>` (so a valid-tenant control exists).
2. Insert user `usr_m2_neg_<ts>` exactly as admin creation does today: `email`, `role:'user'`,
   `status:'active'`, `businessId: NULL`, `primaryWorkspace:'biz_main'`, `onboardingCompleted:false`.
3. Control user `usr_m2_ok_<ts>`: identical but `businessId: biz_m2_neg_<ts>`.

**Request**
- `POST /api/auth/login` { email } in dev-OTP mode (capture code from console, as
  `verify_tenant_identity.ts:57-65` does), then `POST /api/auth/verify` { email, code } — for both users.

**Expected (after fix)**
- Negative user: HTTP **400** (or 422 — M3 picks one and documents it) with body
  `{ error: 'Account is missing tenant identity' }` *(exact string decided in M3 and asserted verbatim)*.
  **No token in response.** `users.businessId` still `NULL` afterwards (proves no silent persist).
- Control user: HTTP **200** with a token whose payload `businessId === biz_m2_neg_<ts>`.

**Proof the failure is tenant-identity, not generic auth failure**
- Same OTP machinery succeeds for the control user in the same run (OTP mechanics exonerated).
- The asserted error string is emitted only by the missing-tenant-identity branch.
- A second negative case — user with legacy workspace-route `businessId='/app/restaurant'` — must
  still authenticate (legacy migration preserved), proving the rejection is specific to *missing*
  identity, not to any nonstandard `businessId`.

---

## 7. Findings summary

| # | Finding | Classification |
|---|---|---|
| 1 | Restaurant menu category mutations (3 routes) lack role checks | **Confirmed** |
| 1 | Restaurant menu item mutations (3 routes) lack role checks | **Confirmed** |
| 1 | Restaurant table creation lacks role check | **Confirmed** |
| 1 | Restaurant table-status mutation lacks role check (expected set: management + waiter, per FloorView usage) | **Confirmed** |
| 1 | Item/table DELETE routes | n/a — do not exist |
| 2 | Quote mutations (POST, PATCH) lack role checks | **Confirmed** |
| 3 | Admin user update raw-body mass assignment | **Confirmed** |
| 4 | Admin-created users: `businessId` never set, intended source proven (caller-supplied existing business) | **Confirmed** |
| 5 | `biz_main` fallback reachable in production auth (OTP verify + business setup) | **Confirmed** |
| — | Restaurant router-wide authN, tenant scoping on all queries, audit logging, legacy-owner upgrade | Protected elsewhere — working as designed |

## 8. Proposed M3 scope (confirmed findings only)

| Fix | Change | Files touched |
|---|---|---|
| **A. Restaurant authorization** | Add `restaurantActorFor` + role gate to 8 handlers: menu categories POST/PATCH/DELETE, menu items POST/PATCH/image, tables POST → owner/admin/manager + legacy-owner-compatible (`canUseQ` role set); tables PATCH `/status` → same + `waiter`. 403 via existing `forbid`. No new helpers beyond (at most) a clearly-named `canManageRestaurantConfig` alias reusing the exact `canUseQ` semantics. | `routes/restaurant.ts` only |
| **B. Quote authorization** | `requireRole(['owner','admin','manager'])` on POST `/` and PATCH `/:id` (customers.ts pattern). Reads untouched. | `routes/quotes.ts` only |
| **C. Admin mass assignment** | Replace `.set(body)` with explicit allowlist `{name, role, status, isLocked, primaryWorkspace, moduleAccess}` + type/enum validation; audit-log the applied subset. Preserve `{ message: 'User updated' }` response. | `routes/admin.ts` only |
| **D. Admin-created tenant identity** | POST `/admin/users`: require `businessId` referencing an **existing** `businesses` row (400 `'businessId must reference an existing business'` otherwise); write it to `users.businessId`; set `primaryWorkspace` from segment/workspace or NULL — never `'biz_main'`. Frontend: remove the hidden `businessId:'biz_main'` default in UsersPage.tsx (smallest change preserving the create flow). | `routes/admin.ts`, `src/views/admin/UsersPage.tsx` (one line) |
| **E. `biz_main` fail-safe** | `auth.ts:204-211`: NULL `businessId` → 400 `'Account is missing tenant identity'`, no token, no persist; legacy workspace-route values keep migrating. `user.ts:101` (`ensureUserBusiness`): same guard for NULL identity. Do not touch `DEFAULT_BUSINESS_ID`, seed, schema defaults, or `middleware/auth.ts:46` legacy-token path in this task (documented residual). | `routes/auth.ts`, `utils/tenant.ts` |

Explicitly **out of M3**: schema default cleanup, `middleware/auth.ts:46` legacy fallback removal,
`verify_phase2_5.ts` retirement, admin PATCH cross-tenant scoping, item/table DELETE endpoints,
indexes/migrations/CI/pagination/refactors.

## 9. Proposed M4 verification additions

Extend/add `verify_*` scripts for plan items 1-10, including: waiter & kitchen 403 on all menu
config mutations; waiter 200 on PATCH table status but 403 on POST /tables; owner/admin still succeed
(positive controls on every route); staff-role 403 on quote POST/PATCH with owner/manager 200;
admin PATCH cannot write `email`/`businessId`/`role escalation beyond set`/`createdAt` (attempted
over-post returns 200 with fields unchanged, or 400 — M3 picks and documents); admin create without
valid `businessId` → 400; the §6 negative tenant test with control cases; legacy workspace-route
user still authenticates. Then full M0 suite re-run + typecheck.

---

**STOP POINT — architectural review requested before any code changes.**
