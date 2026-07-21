# Security Remediation — M0 Baseline & M1 Authorization Map

Date: 2026-07-18
Branch: `security/authz-evidence-baseline` (created from `main` @ `faa59e2`)
Scope: evidence only. **No source files were modified.**

---

## M0 — Baseline

### Typecheck

| Check | Command | Result |
|---|---|---|
| Backend typecheck | `backend: ./node_modules/.bin/tsc --noEmit` | ✅ PASS (exit 0, zero errors) |

Note: `npm`/`npx` are not on this machine's PATH; use the local binaries directly
(`./node_modules/.bin/tsc`, `./node_modules/.bin/tsx` from `backend/`).

### Verification suite results (21/21 maintained scripts PASS)

| Script | Result |
|---|---|
| verify_tenant_identity | ✅ PASS |
| verify_restaurant_core | ✅ PASS |
| verify_restaurant_service_flow | ✅ PASS |
| verify_restaurant_delivery | ✅ PASS |
| verify_restaurant_setup_foundation | ✅ PASS |
| verify_business_pulse_snapshot | ✅ PASS |
| verify_bookings_q_foundation | ✅ PASS |
| verify_q_provider_config | ✅ PASS |
| verify_q_production_readiness | ✅ PASS |
| verify_public_q_concierge | ✅ PASS |
| verify_public_identity | ✅ PASS |
| verify_business_settings | ✅ PASS |
| verify_business_ownership | ✅ PASS |
| verify_business_modules | ✅ PASS |
| verify_inventory_procurement | ✅ PASS |
| verify_staff_hr | ✅ PASS |
| verify_purchases_expenses | ✅ PASS |
| verify_customers | ✅ PASS |
| verify_quotes | ✅ PASS |
| verify_jwt_init | ✅ PASS |
| verify_otp | ✅ PASS |

Raw logs: `tmp/m0_baseline/<script>.log` (untracked).

### Excluded scripts (with reasons)

| Script | Reason |
|---|---|
| `verify:resend-live` | Requires `dist/` build + live Resend API key; excluded from baseline. |
| `verify_phase2_5.ts` | Legacy manual script (not in `package.json`). Prints "Manual API checks…" then hangs on an open DB handle (never closes connection). Killed after timeout. Side effect: upserts fixture rows `usr_comp_001` / `biz_competitor`. Not part of the maintained suite. |
| `scripts/verify_supermarket_loop.ts` | Root-level frontend-loop script, outside the backend suite. |

### Baseline environment

- Verify scripts require `Q360_DATABASE_ENV=staging`, `Q360_DATABASE_NAME=q360-staging`,
  and a valid `DATABASE_URL` (guard: `backend/src/utils/env.ts`). All present in `backend/.env`.
- Scripts run in-process against the staging Postgres (no server needed); ~10–15 s each.
- Pre-existing working-tree state preserved: `src/modules/public/GuestQConcierge.tsx`
  (modified, unrelated) and untracked files were left untouched.

---

## M1 — Authorization Architecture Map

### Role vocabulary

Two distinct role domains exist — do not conflate them:

1. **User/business roles** (`users.role`, carried in JWT, resolved into `userRole` context):
   `owner`, `admin`, `manager`, `staff`, `user` (base/default).
   Observed hierarchy comment in `requireRole`: Owner > Admin > Manager > Staff > Viewer,
   but `requireRole` is an **explicit allowlist — there is no implicit hierarchy**
   (`middleware/auth.ts:75-90`).
2. **Staff-member operational roles** (`staffMembers.role`, per-tenant):
   `manager`, `waiter`, `cashier`, `kitchen`, `staff` (`routes/staff.ts:11`).
   On OTP login with a staff invitation, `users.role` is set from the invitation role
   (`routes/auth.ts:170,189`), so operational roles (e.g. `waiter`) do reach `userRole`.

### The three enforcement primitives

| Primitive | Location | Behavior |
|---|---|---|
| `authMiddleware` | `middleware/auth.ts:27-58` | Verifies HS256 JWT. Rejects tokens whose `businessId` is a workspace route (`/app/…`) with 401. Sets `userId`, `userEmail`, `businessId`, and `userRole` (via `resolveEffectiveBusinessRole`) on context. **Authentication only — no authorization.** |
| `requireRole(roles[])` | `middleware/auth.ts:75-90` | Explicit allowlist on `userRole`; 403 otherwise. No implicit owner/admin escalation. |
| `resolveEffectiveBusinessRole` | `services/businessOwnership.ts:21-50` | Re-resolves role from DB for token-role `user`. Upgrades legacy restaurant creator accounts to `owner` (claims unowned business, blocked if a staff membership exists). Returns token role unchanged for non-`user` roles. |

### Where guards are applied (router level)

| Router | AuthN | AuthZ |
|---|---|---|
| `restaurant.ts` (3224 lines) | `use('/*', authMiddleware)` (line 205) | **No `requireRole` import.** Inline `actor` pattern instead (below). |
| `quotes.ts` (363 lines) | `use('/*', authMiddleware)` (line 12) | **None. Zero role references in the entire file.** Any authenticated tenant user can read/write quotes. |
| `admin.ts` (612 lines) | `use('*', authMiddleware)` (line 15) | `use('*', requireRole(['admin']))` (line 16) — router-wide, admin-only. |
| `customers.ts` | router-wide authMiddleware | Route-level `requireRole(['owner','admin','manager'])` on POST/PATCH (lines 59, 98) |
| `orders.ts` | router-wide authMiddleware | `requireRole(['owner','admin','manager','staff'])` on POST /orders (line 42) |
| `inventory.ts` | router-wide authMiddleware | `requireRole(['user','owner','admin','manager'])` on mutations (lines 36, 85, 175) |
| `suppliers.ts` | router-wide authMiddleware | `requireRole(['user','owner','admin','manager'])` on mutations |
| `purchasesExpenses.ts` | router-wide authMiddleware | `use('*', requireRole(['owner','admin']))` — router-wide |
| `staff.ts` | router-wide authMiddleware | `requireRole(['user','owner','admin','manager'])` on read + invite + patch |
| `business.ts`, `user.ts` (`/profile`) | authMiddleware only | n/a |

### Restaurant's inline authorization convention

`restaurant.ts` does not use `requireRole`; it has its own actor pattern:

- `restaurantActorFor(c)` (lines 258-282): builds `{ userId, businessId, role, legacyOwnerUser }`;
  for role `user`, loads the user row to test legacy-owner compatibility.
- `forbid(c, message)` (line 256): 403 helper.
- `canUseQ(actor)` (lines 844-846): `owner | admin | manager | isLegacyRestaurantOwnerCompatible`.
- `canReviewQDraft(actor)` (lines 848-850): `owner | admin | isLegacyRestaurantOwnerCompatible`.
- Bookings already use role gates: create/update allow `canUseQ(actor) || actor.role === 'waiter'`
  (lines 1771, 1825) — evidence that per-route inline role checks are the established
  restaurant convention.

**M2 must enumerate which menu category / menu item / table mutation routes apply (or fail
to apply) an actor-role gate.** The convention to follow is `canUseQ`-style checks or
`requireRole`, not a new system.

### `biz_main` fallback inventory (production-relevant)

| # | Site | Behavior | Preliminary classification |
|---|---|---|---|
| 1 | `utils/tenant.ts:16` `resolveJwtBusinessId` | JWT issuance: missing/workspace-route `users.businessId` → token gets `biz_main`. Called from `routes/auth.ts:205, 215, 224` (OTP verify + session). | **Production risk candidate** — M2 must determine if a newly created user with no businessId can reach OTP verify and land in `biz_main`. |
| 2 | `middleware/auth.ts:46` | Token without `businessId` claim → `biz_main` (comment: "missing legacy tokens"). | Legacy compatibility — kept deliberately; assess in M2/M3-E. |
| 3 | `utils/tenant.ts:44` `ensureUserBusiness` | Business-setup flow: missing tenant id → `biz_main`; called from `routes/user.ts:101`. | Legacy/dev compatibility candidate. |
| 4 | `db/seed.ts`, `db/schema.ts` (default) | Seeded demo tenant / column default. | Legitimate fixture (expected). |
| 5 | `routes/admin.ts` (1 occurrence) | TBD — inspect in M2 alongside admin user creation. | TBD |

### Mass-assignment exposure (preliminary)

`admin.ts` is admin-only at the router level, so finding 3 is **not** an
authentication/authorization gap — it is an over-posting risk *within* the admin role
(e.g. flipping `role`, `businessId`, or another tenant's fields via raw body spread).
M2 must read the admin user create/update handlers and list exactly which fields are writable.

---

## Implications for M2 (per-route evidence table)

1. **Finding 1 (restaurant menu/table mutations)** — partially confirmed at the map level:
   the file has an inline role-gate convention and uses it for bookings, but menu/table
   mutations are unverified. Enumerate every POST/PATCH/DELETE under menu categories,
   menu items, tables.
2. **Finding 2 (quote mutations)** — strongly indicated: zero role checks in `quotes.ts`.
   Confirm per-route and pick the closest existing Commerce write rule
   (`customers.ts` uses `['owner','admin','manager']` on writes — the likely model).
3. **Finding 3 (admin mass assignment)** — inspect handlers; classify writable fields.
4. **Finding 4 (admin-created user businessId)** — inspect admin create-user handler and
   trace whether its output feeds `resolveJwtBusinessId` fallback #1.
5. **Finding 5 (`biz_main` reachability)** — map complete above; M2 confirms reachability
   of site #1 from real auth flows (OTP verify, session restore, admin-created users).

## Commands to reproduce baseline

```bash
cd backend
./node_modules/.bin/tsc --noEmit
for s in verify_tenant_identity verify_restaurant_core verify_restaurant_service_flow \
  verify_restaurant_delivery verify_restaurant_setup_foundation verify_business_pulse_snapshot \
  verify_bookings_q_foundation verify_q_provider_config verify_q_production_readiness \
  verify_public_q_concierge verify_public_identity verify_business_settings \
  verify_business_ownership verify_business_modules verify_inventory_procurement \
  verify_staff_hr verify_purchases_expenses verify_customers verify_quotes \
  verify_jwt_init verify_otp; do
  ./node_modules/.bin/tsx src/scripts/$s.ts || echo "FAIL: $s"
done
```
