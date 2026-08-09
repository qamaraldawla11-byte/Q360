# Q360-PS-RC1-FINAL Evidence Report

> Prepared by: Kimi K2.7 Coding acting as Q PS
> Date: `2026-08-08T16:19Z`
> Session worktree: `D:/VS CODE App/Q360/.worktrees/q360-rc1-clean`

---

## 1. Founder Brief

RC1 is intended to deliver the Wave 0 migration foundation, `/health`, `/readyz`, Shared Customers, Shared Quotes, Shared Products, Shared Inventory, authorization, tenant isolation, audit controls, and migration safety — without Commercial Core (orders/invoices/payment status) or Q Executive expansion (founder panel additions/evidence layer/signals).

Evidence was gathered directly from the repository and a disposable local PostgreSQL instance. No previous reports were assumed correct.

**Verdict: PARTIAL/FAIL**

The release candidate builds, applies migrations deterministically, and passes all shared-module verification gates. However, two blocking items prevent a clean PASS:
1. The restaurant regression authorization check fails (waiter/kitchen payment attempts return 409 instead of 403).
2. The worktree is dirty with uncommitted changes to a migration file and a route file, plus several untracked files.

A merge-ready PR must not be created until these items are resolved.

---

## 2. Verdict

**PARTIAL/FAIL**

- PASS: repository baseline identity, exact scope proof, protected-area review, migration applicability, shared-module verification, auth/tenant/audit verification, core restaurant flow.
- FAIL: restaurant role-authorization regression verification, worktree cleanliness.

---

## 3. Repository Baseline

| Item | Value |
|------|-------|
| Current path | `D:/VS CODE App/Q360/.worktrees/q360-rc1-clean` |
| Branch | `rc/q360-rc1-clean` |
| HEAD commit | `ece2596e17dcc5f307c281c52c96e1cac37be584` |
| HEAD message | `Q360-CORE-INVENTORY-M2: harden shared inventory movement foundation` |
| Parent commit | `d952560260c4cbb319574efa1c5a9f4453df0134` |
| origin/main (fetched) | `a76870e7b1bc93532b1469e0a138ec4fda55badf` |
| Ahead/behind | 20 ahead, 0 behind |
| Git status | Dirty — see Section 10 |
| Git locks | None |
| Merge/rebase state | None |
| Competing writers | None on `rc/q360-rc1-clean`; `audit/q360-core-inventory-m2-s0` worktree shares same commit but different branch |

---

## 4. Changed-File Scope

Diff `origin/main..HEAD` contains **76 files**.

### Classification summary

| Category | Count | Representative purpose |
|----------|-------|------------------------|
| migration | 11 | Wave 0 migrations 0000–0004, snapshots, journal |
| backend | 35 | Shared Customers/Quotes/Products/Inventory routes & services, `/readyz`, verification scripts |
| frontend | 12 | Shared Products views, Founder Daily Brief view, routing |
| docs | 14 | Evidence reports, runbooks, contracts |
| configuration | 4 | `.gitignore`, `DEPLOYMENT.md`, `backend/.env.example`, `backend/package.json`, `railway.json` |
| tests | 4 | readiness tests, baseline catalog tests |

### Excluded-content absence proof

| Excluded item | Evidence |
|---------------|----------|
| `shared_orders` table | `git grep "shared_orders" HEAD -- backend/src/ src/ backend/drizzle/` → NOT FOUND |
| `invoices` table | `git grep` for `table("invoices")` → NOT FOUND |
| Commercial `payment_status` standalone | `payment_status` exists only as a column on `restaurant_orders` (restaurant operations, already in origin/main) |
| `signals` feature | No standalone signals table/service; only UI labels in Founder Brief |
| Autonomous AI | No autonomous action code; Founder Brief is deterministic read-only |
| Q Executive founder panel expansion | Only read-only `FounderDailyBriefView` present; no panel cards/views/submodules added |

`payment_status`, `evidence_ids`, and `evidence_cards` columns exist in RC1 but **already exist in origin/main**; RC1 does not expand them.

---

## 5. Commit-Chain Assessment

Commit chain from HEAD back to origin/main:

```
ece2596 Q360-CORE-INVENTORY-M2: harden shared inventory movement foundation
 d952560 Q360-PS-M6-S3N-R3: decouple deployment from database mutation
 901b7cc Q360-QB-M4-S2B: align Founder Brief with unified customer lifecycle
 1570ec9 Q360-QB-M4-S2: Founder Daily Brief read-only vertical slice
 bd3abc0 Q360-CORE-INTEGRATION-BASE-S2: align shared-module verification
 ...
```

All commits are within the RC1 scope. No Commercial Core or Q Executive expansion commits are present. The chain is linear and reviewable.

---

## 6. Migration 0003 Safety Decision

**File**: `backend/drizzle/0003_small_stone_men.sql`

**Statements**:
- `ALTER TABLE "products" DROP CONSTRAINT "products_barcode_unique";` — removes global barcode uniqueness.
- `ALTER TABLE "products" ALTER COLUMN "barcode" DROP NOT NULL;` — allows barcode-less products.
- Additive columns: `description`, `sku`, `unit`, `default_price_amount_minor`, `currency` (DEFAULT 'USD' NOT NULL), `status` (DEFAULT 'active' NOT NULL), `created_by`, `created_at`, `updated_at`.
- Additive indexes: `products_business_id_idx`, `products_status_idx`, partial unique `products_business_sku_idx`, partial unique `products_business_barcode_idx`.

**Decision: CONDITIONAL PASS with operational guard**

| Criterion | Assessment |
|-----------|------------|
| Destructive? | Yes — drops a uniqueness constraint |
| Data loss? | No direct data loss |
| Row rewrite? | Yes — `NOT NULL DEFAULT` additions rewrite `products` |
| Staging compatibility | Requires duplicate-barcode cleanup per business before deploy |
| Determinism | Migration journal and schema fingerprints confirm deterministic application |
| Rollback | Manual only; no automated rollback script |

Recommendation: 0003 may proceed **only** after a pre-flight report confirms no duplicate `(business_id, barcode)` or `(business_id, sku)` pairs exist in staging.

---

## 7. Verification Table

| Gate | Method | Result |
|------|--------|--------|
| Backend build | `npm run build` in `backend/` | PASS |
| Frontend build | `npm run build` in root | PASS |
| Disposable DB migration | `npm run db:migrate:staging` against local Postgres | PASS |
| `/health` | `curl http://127.0.0.1:13001/health` | PASS (200) |
| `/readyz` | `curl http://127.0.0.1:13001/readyz` | PASS (200, 27 checks) |
| Customers verification | `npm run verify:customers` | PASS |
| Quotes verification | `npm run verify:quotes` | PASS |
| Products verification | `npm run verify:products` | PASS |
| Inventory/procurement verification | `npm run verify:inventory-procurement` | PASS |
| Stock movement service verification | `npm run verify:stock-movement-service` | PASS |
| Tenant identity verification | `npm run verify:tenant-identity` | PASS |
| Security/authorization verification | `npm run verify:security-authz` | PASS |
| OTP verification | `npm run verify:otp` | PASS |
| Founder Brief verification | `npm run verify:founder-brief` | PASS |
| Audit logging | DB query `COUNT(*) FROM audit_logs` returned rows after scripts | PASS |
| Migration determinism | Journal rows and fingerprints generated | PASS |

---

## 8. Restaurant Regression Result

| Step | Expected | Actual | Classification |
|------|----------|--------|----------------|
| Login | OTP + JWT session works | OTP verify and session confirmed | PASS |
| POS order creation | `POST /api/restaurant/orders` 201 | 201 | PASS |
| Kitchen/KDS transition | `new` → `cooking` → `done` | Confirmed | PASS |
| Ready state | Order becomes ready | Confirmed | PASS |
| Delivered | `POST .../deliver` 200 | 200 | PASS |
| Payment | Cashier payment 201, table available | 201, table available | PASS |
| Table release | Table status `available` after payment | Confirmed | PASS |
| **Waiter payment authorization** | **403 forbidden** | **409 "Order is already paid"** | **FAIL** |
| **Kitchen payment authorization** | **403 forbidden** | **409 "Order is already paid"** | **FAIL** |

**Overall: FAIL** due to authorization-status mismatch.

The core operational flow (POS → KDS → Ready → Delivered → Payment → Table release) works. The failing assertions are role-authorization checks: tokens with `waiter`/`kitchen` roles appear to resolve to an effective role that passes `record_payment` authorization, then hit the order-state gate. Because `backend/src/middleware/auth.ts`, `backend/src/routes/restaurant.ts`, and `backend/src/services/restaurantDomain.ts` are unchanged in RC1, this is likely a pre-existing test/auth interaction issue rather than an RC1 regression, but it is still a verification failure.

---

## 9. Protected-Area Confirmation

| Area | Changed in RC1? | Status |
|------|-----------------|--------|
| OTP authentication | No | Confirmed intact (`backend/src/routes/auth.ts` unchanged) |
| JWT `businessId` identity | No | Confirmed intact (`backend/src/middleware/auth.ts` unchanged) |
| Tenant isolation | No | Confirmed intact (`backend/src/utils/tenant.ts`, `moduleAuthorization.ts` unchanged) |
| `primaryWorkspace` authorization | No | Confirmed intact (auth/user/restaurant routes unchanged) |
| Restaurant routes | Partially (`orders.ts` uses new stock movement service) | Operational flow works; auth role check fails |
| Inventory movement service | New in RC1 | Verified by `verify:stock-movement-service` |
| Railway migration flow | No docs/config changes that alter flow | Confirmed |
| Supabase configuration | No | Confirmed |
| Existing verification scripts | No deletion | Confirmed |

---

## 10. Known Limitations

1. **Dirty worktree at test time**:
   - `M backend/drizzle/0003_small_stone_men.sql`
   - `M backend/src/routes/inventory.ts`
   - `?? backend/src/scripts/verify_rc1_readiness.ts`
   - `?? backend/src/scripts/verify_rc1_seed_journal.ts`
   - `?? docs/Q360-PS-CTO-B1-S4-BOUNDED-CORRECTIONS-REPORT.md`
   - `?? docs/Q360-PS-CTO-B1-S5-RC1-VERIFICATION-REPORT.md`
   - `?? docs/Q360-PS-CTO-B1-S6-COMMERCIAL-CORE-DECISION.md`
   - `?? docs/Q360-PS-CTO-B1-S7-RC1-PR-PACKAGE.md`
   - `?? docs/Q360-PS-CTO-B1-S8-STAGING-RELEASE-PLAN.md`

   These uncommitted changes are not reflected in HEAD `ece2596e`. A clean RC1 branch must not carry uncommitted changes.

2. **Stale migration manifest**: `backend/migration-manifests/Q360-PS-M6-S3F-final-manifest.json` references commit `253786c0` and covers only migrations 0000–0001. It does not cover 0002–0004.

3. **No restored-staging Track B rehearsal**: Verification used an empty disposable database only.

4. **No frontend runtime/E2E validation**: Only frontend build was verified.

5. **Restaurant authorization regression**: See Section 8.

---

## 11. PR Readiness

**PR must NOT be created.**

Blockers:
1. Restaurant regression gate FAIL.
2. Worktree is not clean.

Once resolved, the intended PR is:
- base: `main`
- head: `rc/q360-rc1-clean`

No PR number or URL is returned because the gate is not clear.

---

## 12. Remaining Blockers

| # | Blocker | Owner suggestion | Evidence |
|---|---------|------------------|----------|
| 1 | Fix or explain waiter/kitchen payment authorization failure | Engineering / Q PS | `npm run verify:restaurant` output, `backend/src/scripts/verify_restaurant_core.ts:412-413` |
| 2 | Commit or remove uncommitted changes | Engineering | `git status --short` |
| 3 | Refresh migration manifest to cover 0002–0004 | Engineering | Current manifest references commit `253786c0` |
| 4 | Run Track B rehearsal against restored staging backup (recommended) | Engineering / DevOps | Not performed |

---

## 13. CTO Recommendation

**Do not approve RC1 for merge.**

Reasoning:
- The shared-module foundation is solid and well verified.
- Migration 0003 is acceptable with a pre-flight duplicate-barcode report.
- The restaurant authorization regression is a blocking failure in an RC1-in-scope gate.
- The dirty worktree indicates the branch is not in a release-ready state.

Recommended path:
1. Resolve the waiter/kitchen payment authorization discrepancy (either fix the auth resolution or update the test to reflect intended behavior).
2. Clean the worktree — commit intentional changes or remove accidental ones.
3. Generate a fresh migration manifest covering 0000–0004 against the current HEAD.
4. Re-run this evidence gate.
5. Only then create the PR to `main`.

---

## 14. Confirmation: No Merge/Deployment/Live DB Action Occurred

- ✅ No merge performed.
- ✅ No deployment performed.
- ✅ No live staging or production database accessed or modified.
- ✅ `db:push` not executed.
- ✅ No secrets changed.
- ✅ No Commercial Core added.
- ✅ No Q Executive expansion added.
- ✅ No architecture changes made.
- ✅ No unrelated branches cleaned.
- ✅ No worktrees deleted.

All database work was performed against a disposable local PostgreSQL instance that was terminated and removed after verification.

---

## Appendix: Evidence Artifacts

- Manual verification package: `docs/Q360-PS-RC1-FINAL-MANUAL-VERIFICATION-PACKAGE.md`
- This report: `docs/Q360-PS-RC1-FINAL-EVIDENCE-REPORT.md`
