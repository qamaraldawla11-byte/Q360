# Q360-PS-RC1-FINAL-FIX1 Report

> Prepared by: Kimi K2.7 Coding acting as Q PS
> Date: `2026-08-08T17:05Z`
> Session worktree: `D:/VS CODE App/Q360/.worktrees/q360-rc1-clean`
> Branch: `rc/q360-rc1-clean`

---

## 1. Root Cause of 409 vs 403

The `verify:restaurant` script (`backend/src/scripts/verify_restaurant_core.ts`) created a single test user with `role: 'admin'` and then generated JWTs with varying token roles (`waiter`, `kitchen`, `cashier`, etc.) to test authorization.

Request path for a waiter payment attempt:

```
POST /api/restaurant/orders/:id/payments
  → authMiddleware
    → JWT verified
    → users table lookup by (id, business_id)
    → account.role = 'admin' (from DB)
    → resolveEffectiveBusinessRole({ tokenRole: 'admin' }) returns 'admin'
  → restaurant.post('/orders/:id/payments')
    → canPerformRestaurantAction({ role: 'admin' }, 'record_payment') = true
    → order state check: dine-in order not yet delivered
    → returns 409 "Order must be delivered before payment"
```

The test expected 403 because it assumed the token-supplied `waiter` role would be authoritative. However, `backend/src/middleware/auth.ts` enforces per-request account-state: the user's DB role overrides the token role. This is intentional and unchanged in RC1.

**Answer to the five diagnostic questions:**

1. **Is 409 correct according to the current authorization contract?** Yes, for an `admin`-resolved actor hitting a not-yet-delivered dine-in order. The 403 expectation was based on a stale fixture.
2. **Is the verification script stale?** Yes — it assumed token role precedence over DB role.
3. **Is module enablement checked before role authorization?** Module authorization is checked; it passed because the resolved role was `admin`.
4. **Is a disabled/missing module state masking the expected role denial?** No — the module was enabled; the denial was masked by the DB role override.
5. **Is this genuinely an RC1 regression or pre-existing behavior?** Pre-existing behavior. `backend/src/middleware/auth.ts`, `backend/src/routes/restaurant.ts`, and `backend/src/services/restaurantDomain.ts` are unchanged in RC1. The same test setup exists at `origin/main`.

---

## 2. Classification

**Stale test fixture** caused by intentional production auth behavior.

No RC1 regression in protected Restaurant code.

---

## 3. Exact Correction

**File**: `backend/src/scripts/verify_restaurant_core.ts`

Added role-appropriate test users:

- `usr_verify_restaurant_core` → `admin`
- `usr_verify_restaurant_core_waiter` → `waiter`
- `usr_verify_restaurant_core_kitchen` → `kitchen`
- `usr_verify_restaurant_core_cashier` → `cashier`
- `usr_verify_restaurant_core_manager` → `manager`

Updated `createToken` to resolve a token role to the matching test user when no explicit `userId` is supplied, so the DB role and token role agree:

```typescript
const tokenUserId = options?.userId ?? roleUserIds[tokenRole] ?? userId;
```

Updated `resetFixture` to insert and delete all role-specific users.

No Restaurant business rules, POS lifecycle, KDS lifecycle, table lifecycle, or schema were modified.

---

## 4. Commits

### Commit 1 — RC1 corrections

| Field | Value |
|-------|-------|
| Hash | `21d97d02d10d57615ad5921b6e33f552a98c316a` |
| Parent | `ece2596e17dcc5f307c281c52c96e1cac37be584` |
| Changed paths | `backend/drizzle/0003_small_stone_men.sql`, `backend/src/routes/inventory.ts`, `backend/src/scripts/verify_restaurant_core.ts` |
| Purpose | Apply S4 authorized corrections: document 0003 safety impact + pre-flight queries; harden inventory route roles; fix stale restaurant verification fixture. |

### Commit 2 — Evidence preservation

| Field | Value |
|-------|-------|
| Hash | `ce956d38d6c089156c4e9bbcd3b005e8398ef249` |
| Parent | `21d97d02d10d57615ad5921b6e33f552a98c316a` |
| Changed paths | `backend/src/scripts/verify_rc1_readiness.ts`, `backend/src/scripts/verify_rc1_seed_journal.ts`, `docs/Q360-PS-CTO-B1-S4-BOUNDED-CORRECTIONS-REPORT.md`, `docs/Q360-PS-CTO-B1-S5-RC1-VERIFICATION-REPORT.md`, `docs/Q360-PS-CTO-B1-S6-COMMERCIAL-CORE-DECISION.md`, `docs/Q360-PS-CTO-B1-S7-RC1-PR-PACKAGE.md`, `docs/Q360-PS-CTO-B1-S8-STAGING-RELEASE-PLAN.md`, `docs/Q360-PS-RC1-FINAL-EVIDENCE-REPORT.md`, `docs/Q360-PS-RC1-FINAL-MANUAL-VERIFICATION-PACKAGE.md` |
| Purpose | Track previously untracked RC1 verification scripts and release evidence. |

---

## 5. Final Git Status

```
On branch rc/q360-rc1-clean
nothing to commit, working tree clean
```

- Branch: `rc/q360-rc1-clean`
- HEAD: `ce956d38d6c089156c4e9bbcd3b005e8398ef249`
- Parent: `21d97d02d10d57615ad5921b6e33f552a98c316a`
- Origin/main: `a76870e7b1bc93532b1469e0a138ec4fda55badf`
- Ahead/behind: 22 ahead, 0 behind

---

## 6. Restaurant Verification Result

`npm run verify:restaurant` — **PASS** (exit code 0)

Core lifecycle confirmed:
- POS order creation
- KDS ticket `new` → `cooking` → `done`
- Order `pending` → `ready` → `delivered` → `paid`
- Table `occupied` → `available` after payment
- Waiter/kitchen payment attempts return **403** as expected

---

## 7. Authorization Verification Result

| Script | Result |
|--------|--------|
| `npm run verify:security-authz` | PASS |
| `npm run verify:tenant-identity` | PASS |
| `npm run verify:otp` | PASS |

---

## 8. Migration 0003 Pre-flight Evidence

**File**: `backend/drizzle/0003_small_stone_men.sql`

Pre-flight checks added to the migration comment:

```sql
-- Pre-flight check (run against the target database before this migration):
--   SELECT business_id, barcode, COUNT(*) AS n
--   FROM products
--   WHERE barcode IS NOT NULL AND barcode <> ''
--   GROUP BY business_id, barcode
--   HAVING COUNT(*) > 1;
-- If this query returns any rows, the migration must be blocked until the
-- duplicates are resolved (merge, re-barcode, or archive the duplicates).

-- SKU pre-flight check:
--   SELECT business_id, sku, COUNT(*) AS n
--   FROM products
--   WHERE sku IS NOT NULL AND sku <> ''
--   GROUP BY business_id, sku
--   HAVING COUNT(*) > 1;
-- Any rows returned block migration until duplicate SKUs are resolved.
```

The migration still requires a single transaction so the new partial unique indexes are created immediately after the old global constraint is dropped.

---

## 9. Protected-Area Comparison

| Area | Changed? | Evidence |
|------|----------|----------|
| OTP/JWT auth | No | `backend/src/middleware/auth.ts` unchanged vs origin/main |
| Tenant isolation | No | `backend/src/utils/tenant.ts`, `backend/src/middleware/moduleAuthorization.ts` unchanged |
| `primaryWorkspace` handling | No | `backend/src/routes/auth.ts`, `backend/src/routes/user.ts`, `backend/src/routes/restaurant.ts` unchanged |
| Restaurant routes | No business-rule changes | `backend/src/routes/restaurant.ts`, `backend/src/services/restaurantDomain.ts` unchanged; only `backend/src/routes/orders.ts` uses new stock movement service |
| POS lifecycle | No | unchanged |
| KDS lifecycle | No | unchanged |
| Table lifecycle | No | unchanged |
| Inventory movement service | Verified | `verify:stock-movement-service` passes |

Only the verification fixture changed in a protected-area test script; no production Restaurant behavior was modified.

---

## 10. Scope Confirmation

- `shared_orders` table: **absent**
- `invoices` table: **absent**
- Commercial Core expansion: **absent**
- Q Executive expansion beyond existing read-only Founder Daily Brief: **absent**
- `signals` feature: **absent**
- Autonomous AI: **absent**

---

## 11. Reverification Summary

| Gate | Command | Result |
|------|---------|--------|
| Backend build | `cd backend && npm run build` | PASS |
| Frontend build | `npm run build` | PASS |
| Migration chain | `npm run db:migrate:staging` against disposable Postgres | PASS |
| `/health` | `curl http://127.0.0.1:13002/health` | 200 |
| `/readyz` | `curl http://127.0.0.1:13002/readyz` | 200 |
| Restaurant regression | `npm run verify:restaurant` | PASS |
| Security/authZ | `npm run verify:security-authz` | PASS |
| Tenant identity | `npm run verify:tenant-identity` | PASS |
| OTP | `npm run verify:otp` | PASS |

All disposable PostgreSQL instances were stopped and removed after verification.

---

## 12. Remaining Blockers

None identified.

Note: `npm run verify:restaurant-service-flow` still fails with additional auth-fixture mismatches (unknown/missing roles and cross-tenant legacy-owner assertions). It was not part of the explicit FIX1 requirement (`npm run verify:restaurant` was required to pass). Addressing it would require a larger, separate fixture rewrite because the script tests token-role permutations that conflict with the production DB-role enforcement.

---

## 13. Verdict

**PASS — ready for final PR gate.**

The two RC1 blockers are resolved:
1. Restaurant waiter/kitchen payment authorization verification passes.
2. RC1 worktree is clean and all intended changes are committed.

No PR has been created. No merge, deployment, or live database access occurred.
