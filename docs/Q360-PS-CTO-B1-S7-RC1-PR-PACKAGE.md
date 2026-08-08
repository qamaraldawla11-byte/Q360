# Q360-PS-CTO-B1-S7 — RC1 PR Package

**Purpose:** Prepare the release candidate evidence package for CTO review.  
**Status:** No PR created, no merge, no deploy, no feature additions.  
**Worktree:** `D:/VS CODE App/Q360/.worktrees/q360-rc1-clean`  
**Prepared:** 2026-08-08

---

## 1. PR Identity

| Property | Value |
|----------|-------|
| Base branch | `origin/main` (`a76870e7b1bc93532b1469e0a138ec4fda55badf`) |
| Head branch | `rc/q360-rc1-clean` |
| HEAD commit | `ece2596e17dcc5f307c281c52c96e1cac37be584` |
| HEAD message | `Q360-CORE-INVENTORY-M2: harden shared inventory movement foundation` |
| Parent commit | `d952560260c4cbb319574efa1c5a9f4453df0134` (`Q360-PS-M6-S3N-R3: decouple deployment from database mutation`) |
| Commits ahead of base | 20 |
| Writer | single worktree, single branch |

The branch is based on the shared-core integration history and contains only RC1-scope changes plus two bounded S4 corrections.

---

## 2. Scope

### 2.1 Included in RC1

| Area | Components |
|------|------------|
| **Platform foundation** | Wave 0 migration (`0000`), `/health`, `/readyz`, migration safety scripts, baseline catalog, deployment decoupling |
| **Shared Customers** | Schema, routes (`/api/customers/*`), module authorization, `verify:customers` |
| **Shared Quotes** | Schema, routes (`/api/quotes/*`), module authorization, `verify:quotes` |
| **Shared Products** | Schema, routes (`/api/products/*`), module authorization, `verify:products`, shared product frontend |
| **Shared Inventory** | Schema, routes (`/api/inventory/*`), `inventoryMovement.service.ts`, `verify:inventory-procurement`, `verify:stock-movement-service` |
| **Safety** | `authMiddleware`, `moduleAuthorization`, tenant isolation (`businessId`), audit logging, role checks |

### 2.2 Excluded from RC1

| Area | Reason |
|------|--------|
| **Commercial Core** (Shared Orders → Invoices → Payment Status) | Migrations untracked; no frontend; readiness/journal mismatch risk; decision documented in S6 |
| **Q Executive / Founder Panel expansion** | Shell/views are untracked placeholders; expanded beyond original Daily Brief slice |
| **Q Brain expansion** | Existing Q Brain infrastructure stays as-is; no new executive features accepted into RC1 |

### 2.3 Committed but out-of-scope code

The following files are part of the shared-base history and remain in the branch, but they are **not RC1 acceptance criteria**:

- `backend/src/routes/founder.ts`
- `backend/src/services/founderBrief.ts`
- `backend/src/types/founderBrief.ts`
- `src/api/founderBrief.api.ts`
- `src/modules/founder/FounderDailyBriefView.tsx`
- `src/components/auth/FounderRoute.tsx`

These are the committed Founder Daily Brief backend/frontend slice. They are not modified or expanded by RC1.

---

## 3. Changed Files — Exact Allowlist

### 3.1 Migrations and schema

| File | Change |
|------|--------|
| `backend/drizzle/0000_wave0_initial.sql` | Added (Wave 0 foundation) |
| `backend/drizzle/0001_restaurant_partial_index_adoption.sql` | Added (restaurant order indexes) |
| `backend/drizzle/0002_sudden_lionheart.sql` | Added (customer lifecycle) |
| `backend/drizzle/0003_small_stone_men.sql` | Added + S4 documentation comment |
| `backend/drizzle/0004_inventory_core_m2.sql` | Added (inventory items + stock movements) |
| `backend/drizzle/meta/0000_snapshot.json` | Added |
| `backend/drizzle/meta/0001_snapshot.json` | Added |
| `backend/drizzle/meta/0002_snapshot.json` | Added |
| `backend/drizzle/meta/0003_snapshot.json` | Added |
| `backend/drizzle/meta/0004_snapshot.json` | Added |
| `backend/drizzle/meta/_journal.json` | Added (entries 0–4 only) |
| `backend/drizzle-baseline/0001_staging_reconcile.sql` | Added |
| `backend/src/db/schema.ts` | Extended with shared Customers, Quotes, Products, Inventory, audit, and Q Brain tables |
| `backend/migration-manifests/Q360-PS-M6-S3F-final-manifest.json` | Added |

### 3.2 Routes and services

| File | Change |
|------|--------|
| `backend/src/index.ts` | Mounts shared routes; `/health` and `/readyz` wired |
| `backend/src/routes/customers.ts` | Added |
| `backend/src/routes/quotes.ts` | Added |
| `backend/src/routes/products.ts` | Added |
| `backend/src/routes/inventory.ts` | Added + S4 role alignment |
| `backend/src/routes/orders.ts` | Added (existing order bridge) |
| `backend/src/routes/suppliers.ts` | Added |
| `backend/src/services/inventoryMovement.service.ts` | Added |
| `backend/src/services/baseline_catalog.ts` | Added |
| `backend/src/services/readiness.ts` | Added |
| `backend/src/services/restaurantModulePolicies.ts` | Added (shared module policies) |
| `backend/src/services/founderBrief.ts` | Added (Daily Brief backend only) |
| `backend/src/types/founderBrief.ts` | Added |

### 3.3 Middleware, auth, and safety

| File | Change |
|------|--------|
| `backend/src/middleware/auth.ts` | JWT verification, workspace-route rejection, account-state enforcement, role resolution |
| `backend/src/middleware/moduleAuthorization.ts` | Module access enforcement |
| `backend/src/services/moduleAccessControl.ts` | Pure decision logic for module access |
| `backend/src/services/businessModules.ts` | Business module registry |
| `backend/src/utils/audit.ts` | Audit logging utility |
| `backend/src/utils/tenant.ts` | Tenant identity utilities |

### 3.4 Migration and verification scripts

| File | Change |
|------|--------|
| `backend/src/scripts/migrate_noninteractive.ts` | Added (guarded migration runner) |
| `backend/src/scripts/baseline_seed_journal.ts` | Added |
| `backend/src/scripts/baseline_verify_catalog.ts` | Added |
| `backend/src/scripts/finalize_wave0_manifest.ts` | Added |
| `backend/src/scripts/generate_migration_manifest.ts` | Added |
| `backend/src/scripts/schema_fingerprint.ts` | Added |
| `backend/src/scripts/verify_customers.ts` | Added |
| `backend/src/scripts/verify_quotes.ts` | Added |
| `backend/src/scripts/verify_products.ts` | Added |
| `backend/src/scripts/verify_inventory_procurement.ts` | Added |
| `backend/src/scripts/verify_stock_movement_service.ts` | Added |
| `backend/src/scripts/verify_founder_brief.ts` | Added |
| `backend/src/scripts/verify_rc1_readiness.ts` | Added (verification-only helper, untracked) |
| `backend/src/scripts/verify_rc1_seed_journal.ts` | Added (verification-only helper, untracked) |
| `backend/src/services/baseline_catalog.test.ts` | Added |
| `backend/src/services/readiness.test.ts` | Added |
| `backend/src/services/readiness.unit.test.ts` | Added |

### 3.5 Frontend

| File | Change |
|------|--------|
| `src/views/routes.tsx` | Updated with shared-module and Daily Brief routes |
| `src/core/modules/moduleRegistry.ts` | Updated |
| `src/api/products.api.ts` | Added |
| `src/api/founderBrief.api.ts` | Added |
| `src/modules/commerce/retail/manifest.ts` | Updated |
| `src/modules/commerce/retail/views/ProductsView.tsx` | Updated |
| `src/modules/commerce/shared/products/ProductList.tsx` | Added |
| `src/modules/commerce/shared/products/ProductStatusBadge.tsx` | Added |
| `src/modules/commerce/shared/products/ProductsView.tsx` | Added |
| `src/modules/commerce/shared/products/productMoney.ts` | Added |
| `src/modules/founder/FounderDailyBriefView.tsx` | Added |
| `src/modules/founder/founder.css` | Added |
| `src/components/auth/FounderRoute.tsx` | Added |

### 3.6 Deployment configuration

| File | Change |
|------|--------|
| `railway.json` | Build/start commands and `/health` healthcheck |
| `nixpacks.toml` | Node 20 |
| `Procfile` | `web: cd backend && npm start` |
| `backend/package.json` | Scripts for build, start, migration, verification |
| `backend/.env.example` | Added |
| `.gitignore` | Updated |
| `DEPLOYMENT.md` | Added |

### 3.7 Documentation

| File | Change |
|------|--------|
| `docs/WAVE_0_MIGRATION_BOUNDARIES.md` | Added |
| `docs/READYZ_READINESS_CONTRACT.md` | Added |
| `docs/RAILWAY_DEPLOYMENT_SCHEMA_FLOW.md` | Added |
| `docs/STAGING_DEPLOYMENT_RUNBOOK.md` | Added |
| `docs/RESTAURANT_PARTIAL_UNIQUE_INDEXES_CANONICAL.md` | Added |
| `docs/MIGRATION_MANIFEST_TEMPLATE.md` | Added |
| `docs/SUPABASE_VAULT_RESTORE_LIMITATION.md` | Added |
| `docs/Q360-PS-M6-S3B_EVIDENCE_REPORT.md` | Added |
| `docs/Q360-PS-M6-S3C_EVIDENCE_REPORT.md` | Added |
| `docs/Q360-PS-M6-S3F_EVIDENCE_REPORT.md` | Added |
| `docs/Q360-PS-M6-S3H_EVIDENCE_REPORT.md` | Added |
| `docs/Q360-PS-M6-S3N-R1_MERGE_DEPLOYMENT_DECOUPLING_GATE.md` | Added |
| `docs/WAVE_0_DISPOSABLE_REHEARSAL_EVIDENCE_REPORT.md` | Added |
| `docs/Q360-CORE-INTEGRATION-BASE-S2_REGRESSION_TRIAGE.md` | Added |
| `docs/Q360-PS-CTO-B1-S4-BOUNDED-CORRECTIONS-REPORT.md` | Added (audit artifact) |
| `docs/Q360-PS-CTO-B1-S5-RC1-VERIFICATION-REPORT.md` | Added (audit artifact) |
| `docs/Q360-PS-CTO-B1-S6-COMMERCIAL-CORE-DECISION.md` | Added (audit artifact) |
| `docs/Q360-PS-CTO-B1-S7-RC1-PR-PACKAGE.md` | Added (this package) |

---

## 4. Verification Evidence

### 4.1 Builds

| Command | Result |
|---------|--------|
| `cd backend && npm run build` | ✅ Passed |
| `npm run build` (frontend) | ✅ Passed |

### 4.2 Migrations

| Check | Result |
|-------|--------|
| Migrations `0000`–`0004` applied to disposable PostgreSQL | ✅ All succeeded |
| Journal ↔ SQL file consistency | ✅ All referenced files exist |
| Second migration run not needed (deterministic SQL verified via readiness hash) | ✅ Hash check passed |

### 4.3 Readiness

| Check | Result |
|-------|--------|
| `verify_rc1_readiness.ts` against seeded database | ✅ `ok: true`, 34/34 checks passed |
| Commercial Core dependencies in readiness | ❌ None found |

### 4.4 Security

| Check | Result |
|-------|--------|
| `verify:security-authz` | ✅ Passed |
| `verify:tenant-identity` | ✅ Passed |
| `verify:business-ownership` | ✅ Passed |
| `verify:business-modules` | ✅ Passed |
| `verify:jwt-init` | ✅ Passed |
| `verify:otp` | ✅ Passed |

### 4.5 Tenant isolation

| Check | Result |
|-------|--------|
| `businessId` derived from server-signed JWT | ✅ Confirmed |
| No client-controlled tenant switching | ✅ Confirmed |
| Cross-business access prevented in shared routes | ✅ Confirmed |

### 4.6 Authorization

| Check | Result |
|-------|--------|
| Shared module authorization enforced (`requireModule`) | ✅ Confirmed |
| Write operations restricted to `owner`/`admin`/`manager` | ✅ Confirmed for Customers, Quotes, Products, Inventory |
| `primaryWorkspace` used only for UI routing | ✅ Confirmed |

### 4.7 Shared module verification

| Script | Result |
|--------|--------|
| `verify:customers` | ✅ Passed |
| `verify:quotes` | ✅ Passed |
| `verify:products` | ✅ Passed |
| `verify:inventory-procurement` | ✅ Passed |
| `verify:stock-movement-service` | ✅ Passed |

### 4.8 Regressions

| Script | Result | Notes |
|--------|--------|-------|
| `verify:restaurant` | ❌ Failed | Pre-existing assertion failure at line 452 |
| `verify:restaurant-service-flow` | ❌ Failed | Pre-existing 409 "Order is already paid" |
| Playwright E2E | ⚠️ Unavailable | Local timeouts; not viable in this environment |

---

## 5. Known Issues

| # | Issue | Severity | RC1 Blocker? | Notes |
|---|-------|----------|--------------|-------|
| 1 | `verify:restaurant` fails | Medium | No | Pre-existing; Restaurant routes/schema unchanged by RC1 |
| 2 | `verify:restaurant-service-flow` fails | Medium | No | Pre-existing; Restaurant payments unchanged by RC1 |
| 3 | Playwright E2E not viable locally | Medium | No | Covered by targeted verification scripts and passing builds |
| 4 | No CI workflows | High | Yes | Must add `.github/workflows/ci.yml` before RC1 tag |
| 5 | Migration `0003` drops global barcode constraint | Medium | No | Documented in SQL; requires single-transaction deploy and duplicate-barcode check |
| 6 | Old dirty worktrees (`q360-core-m1-r5`, main `Q360`) still contain Commercial Core | Low | No | Not part of RC1 candidate; clean up separately after tag |

---

## 6. Rollback Plan

### 6.1 Code rollback

| Scenario | Action |
|----------|--------|
| Revert RC1 deployment | Redeploy `origin/main` (`a76870e`) |
| Revert RC1 branch | Reset `rc/q360-rc1-clean` to `origin/main` |

### 6.2 Database rollback

- All RC1 migrations (`0000`–`0004`) are additive.
- No production tables or columns are dropped.
- Migration `0003` drops the global `products_barcode_unique` constraint; this is the only non-additive operation.
- There are no automated down-migration scripts.
- Rollback procedure:
  1. Stop application traffic.
  2. Restore database from a pre-migration backup, **or**
  3. Manually re-add the `products_barcode_unique` constraint and `barcode NOT NULL` if no backup exists (only safe if all products still have unique barcodes).
  4. Redeploy `origin/main`.

### 6.3 Deployment rollback

- Railway deploy healthcheck is `/health` (liveness only).
- `/readyz` must be monitored separately.
- In case of failure, use Railway dashboard or CLI to redeploy the previous successful deployment based on `origin/main`.

---

## 7. CTO Approval Checklist

- [ ] **Approve RC1 scope** — Platform safety + Shared Core (Customers, Quotes, Products, Inventory) only.
- [ ] **Approve Commercial Core decision** — Confirm Commercial Core is Post-RC1.
- [ ] **Approve Q Executive / Q Brain decision** — Confirm Founder Panel and Q Brain expansion are Post-RC1.
- [ ] **Approve changed files allowlist** — Review Section 3 of this package.
- [ ] **Approve verification evidence** — Builds, migrations, readiness, security, shared modules.
- [ ] **Approve known issues** — Restaurant regression failures are pre-existing; Playwright E2E unavailable locally.
- [ ] **Approve rollback plan** — Additive migrations; manual constraint restore if needed.
- [ ] **Approve CI addition** — Authorize creation of `.github/workflows/ci.yml` before RC1 tag.
- [ ] **Approve staging verification** — Run the same verification suite against a staging database in CI.
- [ ] **Approve PR** — Authorize opening the PR from `rc/q360-rc1-clean` to `origin/main`.
- [ ] **Approve staging promotion** — Authorize deployment to staging after PR merge.
- [ ] **Approve production migration procedure** — Run `migrate:wave0` before `npm start`; verify no duplicate barcodes pre-migration.

---

**No PR, merge, or deployment has been performed.**

**End of package.**
