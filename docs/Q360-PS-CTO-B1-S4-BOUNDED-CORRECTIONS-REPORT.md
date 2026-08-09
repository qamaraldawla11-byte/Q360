# Q360-PS-CTO-B1-S4 — Bounded Corrections Report

**Scope:** Apply only the verified RC1 blockers identified in `docs/Q360-PS-CTO-B1-S3-SECURITY-ARCHITECTURE-REVIEW.md`.  
**Worktree:** `D:/VS CODE App/Q360/.worktrees/q360-rc1-clean`  
**Branch:** `rc/q360-rc1-clean`  
**Parent baseline:** `ece2596e17dcc5f307c281c52c96e1cac37be584` (`Q360-CORE-INVENTORY-M2: harden shared inventory movement foundation`)  
**Writer:** single worktree, single branch.  
**Excluded:** Commercial Core integration, Q Executive implementation, Q Brain changes, broad refactoring.

---

## 1. Before State

The previous security review identified these RC1 blockers:

1. **Readiness/journal mismatch:** `backend/drizzle/meta/_journal.json`, `backend/src/services/readiness.ts`, `backend/src/index.ts`, and `backend/src/services/restaurantModulePolicies.ts` in the dirty `a99a43d` checkout already anticipated Commercial Core migrations (`0005`/`0006`/`0007`) that are excluded from RC1.
2. **Destructive SQL in migration 0003:** `backend/drizzle/0003_small_stone_men.sql` drops the global `products_barcode_unique` constraint without co-located documentation.
3. **Worktree divergence:** `D:/VS CODE App/Q360` and `D:/VS CODE App/Q360/.worktrees/q360-core-m1-r5` shared commit `a99a43d` but carried different dirty files.
4. **Inventory authorization inconsistency:** `backend/src/routes/inventory.ts` allowed the generic `'user'` role for inventory writes, while Customers, Quotes, and Products restricted writes to `owner`/`admin`/`manager`.

---

## 2. Baseline Selection

A new worktree was created from commit `ece2596e17dcc5f307c281c52c96e1cac37be584` on branch `rc/q360-rc1-clean`.

**Why this baseline:**

- It contains all RC1 Shared Core routes: Customers, Quotes, Products, Inventory.
- It contains the latest Inventory hardening (`Q360-CORE-INVENTORY-M2`).
- It contains deployment decoupling (`Q360-PS-M6-S3N-R3` parent `d952560`).
- It does **not** contain Commercial Core migrations, routes, services, or readiness anticipations.
- It does **not** contain the expanded Founder Panel shell (only the committed Daily Brief backend).

Command used:

```bash
git worktree add -b rc/q360-rc1-clean ".worktrees/q360-rc1-clean" ece2596e17dcc5f307c281c52c96e1cac37be584
```

---

## 3. Changes Made

### 3.1 Readiness alignment

**Status:** No code change required. The baseline `ece2596` already has readiness aligned to RC1 migrations only.

Verification performed:

- `backend/drizzle/meta/_journal.json` references only migrations `0000`–`0004`.
- `backend/src/services/readiness.ts` checks only `journal_hash_0000` and `journal_version_0001`.
- `backend/src/index.ts` does **not** mount `/api/invoices` or `/api/commercial/payments`.
- `backend/src/services/restaurantModulePolicies.ts` `sharedModulePolicies` contains only `customers`, `quotes`, `products`.
- Journal consistency check confirmed all referenced SQL files exist:
  - `0000_wave0_initial.sql` ✅
  - `0001_restaurant_partial_index_adoption.sql` ✅
  - `0002_sudden_lionheart.sql` ✅
  - `0003_small_stone_men.sql` ✅
  - `0004_inventory_core_m2.sql` ✅

### 3.2 Migration 0003 documentation

**File:** `backend/drizzle/0003_small_stone_men.sql`

Added a SQL comment header explaining the constraint removal, the architectural reason (tenant-scoped partial-unique indexes), and the safety impact.

```sql
-- Q360-PS-CTO-B1-S4 NOTE:
-- This migration intentionally drops the global "products_barcode_unique" constraint
-- because barcode uniqueness is being redefined as tenant-scoped via the partial
-- unique indexes "products_business_barcode_idx" and "products_business_sku_idx"
-- below. The barcode column is also made nullable so that products without a
-- barcode do not participate in the uniqueness rule.
--
-- Safety impact: removes a global uniqueness guarantee. Deployment must ensure
-- no duplicate barcodes exist across the same business before applying this
-- migration, and the migration should be run in a single transaction so the new
-- partial-unique index is created immediately after the old constraint is dropped.
```

**Why not rewrite the migration:** Rewriting committed migration history would break existing deployed databases and journal hashes. Documentation is the correct bounded correction.

### 3.3 Worktree integrity

**Status:** Verified clean.

The new worktree contains:

- No Commercial Core untracked files (`0005`/`0006`/`0007` migrations, `backend/src/routes/commercial/`, `backend/src/services/commercial/`, `verify_invoices.ts`, `verify_payment_status.ts`).
- No Q Executive untracked files (`src/modules/founder/FounderPanelView.tsx`, `FounderOverviewView.tsx`, `FounderNavigator.tsx`, `FounderSectionCard.tsx`, `cards/`, `views/`).
- No unrelated changes from the main worktree (`src/App.tsx`, `src/api/quotes.api.ts`, `src/layouts/Sidebar.tsx`, etc.).

### 3.4 Inventory authorization alignment

**File:** `backend/src/routes/inventory.ts`

Aligned inventory write routes with the authorization model used by Customers, Quotes, and Products.

**Before:**

```ts
inventory.patch('/:id/stock', requireRole(['user', 'owner', 'admin', 'manager']), ...);
inventory.post('/', requireRole(['user', 'owner', 'admin', 'manager']), ...);
inventory.patch('/:id', requireRole(['user', 'owner', 'admin', 'manager']), ...);
requiredRoles: ['user', 'owner', 'admin', 'manager'],
```

**After:**

```ts
inventory.patch('/:id/stock', requireRole(['owner', 'admin', 'manager']), ...);
inventory.post('/', requireRole(['owner', 'admin', 'manager']), ...);
inventory.patch('/:id', requireRole(['owner', 'admin', 'manager']), ...);
requiredRoles: ['owner', 'admin', 'manager'],
```

**Rationale:** Inventory mutations (create item, update item, stock adjustment) are business-critical and should match the shared-module write boundary. Read access remains open to all authenticated users via `authMiddleware` + `requireModule('inventory')`.

---

## 4. Files Changed

| File | Change | Reason |
|------|--------|--------|
| `backend/drizzle/0003_small_stone_men.sql` | Added SQL comment header documenting constraint drop | Migration safety transparency |
| `backend/src/routes/inventory.ts` | Changed inventory write role checks from `['user', 'owner', 'admin', 'manager']` to `['owner', 'admin', 'manager']` | Authorization consistency with other shared modules |

---

## 5. Tests and Verification

### 5.1 Builds

| Build | Command | Result |
|-------|---------|--------|
| Backend TypeScript | `cd backend && npm run build` | ✅ Passed (`tsc` compiled with no errors) |
| Frontend Vite | `npm run build` | ✅ Passed (`tsc -b && vite build` succeeded) |

### 5.2 Migration checks

| Check | Command / Script | Result |
|-------|------------------|--------|
| Journal ↔ SQL file consistency | Custom Node check against `backend/drizzle/meta/_journal.json` | ✅ All 5 referenced SQL files exist |
| Destructive statement scan | `scanSqlForDestructiveStatements` from `baseline_catalog.js` on `0000`–`0004` | ✅ All flagged as non-destructive by the scanner (note: scanner does not flag `DROP CONSTRAINT`) |
| Commercial Core route mount check | `grep` for `/api/invoices`, `/api/commercial` in `backend/src/index.ts` | ✅ No matches |
| Readiness Commercial Core reference check | `grep` for `invoices`, `invoice_`, `payment_status`, `journal_hash_0006`, `migration0006` in `backend/src/services/readiness.ts` | ✅ No matches |

### 5.3 Runtime verification

| Check | Status | Reason |
|-------|--------|--------|
| Readiness endpoint | Not run | `DATABASE_URL` is not configured in this environment |
| Verification scripts (`verify:customers`, `verify:quotes`, `verify:products`, `verify:inventory-procurement`, `verify:stock-movement-service`) | Not run | Require a running Postgres database |

---

## 6. Remaining Risks

| # | Risk | Severity | Mitigation / Next Step |
|---|------|----------|------------------------|
| 1 | `scanSqlForDestructiveStatements` does not flag `DROP CONSTRAINT` | Medium | The migration is now documented; add `DROP CONSTRAINT` / `ALTER COLUMN ... DROP NOT NULL` to the scanner in a future safety improvement. |
| 2 | No automated CI runs the builds or migration checks | Medium | Create `.github/workflows/ci.yml` before RC1 tag. |
| 3 | Readiness endpoint not exercised in this environment | Medium | Run `verify:customers`, `verify:quotes`, `verify:products`, `verify:stock-movement-service` against a staging database after CI is added. |
| 4 | The old dirty worktrees (`q360-core-m1-r5`, main `D:/VS CODE App/Q360`) still exist with Commercial Core / Founder Panel changes | Low | They are not part of the RC1 candidate; this worktree is the single writer. They should be cleaned up separately after RC1 is tagged. |
| 5 | `backend/src/services/inventoryMovement.service.ts` still defaults `requiredRoles` to `['owner', 'admin', 'manager', 'staff']` | Low | The route now overrides this to `['owner', 'admin', 'manager']`. Other callers of `applyStockMovement` (e.g., suppliers/orders) pass their own `requiredRoles`. Consider aligning the service default in a future refactor. |

---

## 7. RC1 Candidate Status

**The `rc/q360-rc1-clean` branch is now a viable RC1 candidate** with the following properties:

- Clean worktree (only 2 intended modifications).
- Readiness checks aligned to RC1 migrations (`0000`–`0004`).
- No Commercial Core or Q Executive code included.
- Consistent authorization model across shared modules.
- Backend and frontend builds pass.

**Recommended next step:** Add CI, run verification scripts against staging, then tag this branch as `release/q360-rc1`.

---

**End of report.**
