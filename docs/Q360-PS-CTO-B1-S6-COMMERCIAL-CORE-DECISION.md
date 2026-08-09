# Q360-PS-CTO-B1-S6 — Commercial Core Decision Review

**Scope:** Evaluate whether Commercial Core should be included in RC1 or postponed.  
**Status:** READ-ONLY decision document; no code, branches, commits, or migrations were modified.  
**Worktree:** `D:/VS CODE App/Q360/.worktrees/q360-rc1-clean`  
**Branch:** `rc/q360-rc1-clean`  
**Decision date:** 2026-08-08  
**References:**
- `docs/Q360-PS-CTO-B1-S1-REPOSITORY-TRUTH-AUDIT.md`
- `docs/Q360-PS-CTO-B1-S2-RC1-SCOPE-MANIFEST.md`
- `docs/Q360-PS-CTO-B1-S5-RC1-VERIFICATION-REPORT.md`

---

## 1. Executive Summary

**Decision: Commercial Core is Post-RC1.**

Commercial Core (Shared Orders → Invoices → Payment Status) physically exists in the repository, but it is **not committed, not integrated into the clean RC1 candidate, and not verified end-to-end**. The RC1 candidate `rc/q360-rc1-clean` already excludes Commercial Core and has passed build, migration, readiness, and shared-module verification. Including Commercial Core now would reintroduce the exact readiness/journal mismatch, uncommitted migrations, and scope expansion that the S4 cleanup removed.

RC1 must remain a controlled release of platform safety + shared business foundations (Customers, Quotes, Products, Inventory). Commercial Core should ship as a follow-on release after it is committed, has a frontend workspace, and passes its own verification scripts.

---

## 2. Current Commercial Core State

### 2.1 Where it exists

Commercial Core files are present only in the dirty worktrees that were excluded from the RC1 candidate:

| Worktree | Branch | HEAD | Status |
|----------|--------|------|--------|
| `D:/VS CODE App/Q360/.worktrees/q360-core-m1-r5` | `feature/q360-core-m3-invoices` | `a99a43d` | Dirty — contains Commercial Core additions |
| `D:/VS CODE App/Q360` | `integration/q360-core-m3-commercial-core` | `a99a43d` | Dirty — contains additional Commercial Core / Founder Panel changes |

### 2.2 Components found

| Component | Evidence in dirty worktrees | Status |
|-----------|-----------------------------|--------|
| Shared Orders schema | `orders` table extension in `backend/src/db/schema.ts` | Tracked modification |
| Invoices schema | `invoices`, `invoice_items` in `backend/src/db/schema.ts` | Tracked modification |
| Payment Status schema | `invoice_payments`, `payment_status_history` in `backend/src/db/schema.ts` | Tracked modification |
| Migrations `0005`/`0006`/`0007` | `backend/drizzle/0005_shared_commercial_orders.sql`, `0006_shared_commercial_invoices.sql`, `0007_payment_status.sql` | **Untracked** |
| Invoice routes | `backend/src/routes/commercial/invoices.ts` | **Untracked** |
| Payment routes | `backend/src/routes/commercial/payments.ts` | **Untracked** |
| Invoice service | `backend/src/services/commercial/invoice.service.ts` | **Untracked** |
| Payment Status service | `backend/src/services/commercial/paymentStatus.service.ts` | **Untracked** |
| Verification scripts | `backend/src/scripts/verify_invoices.ts`, `verify_payment_status.ts` | **Untracked** |
| Frontend workspace | No `src/modules/commercial/` or equivalent | **Absent** |

### 2.3 State in the RC1 candidate

The clean RC1 candidate (`rc/q360-rc1-clean`, HEAD `ece2596`) contains **none** of the above:

- `backend/drizzle/meta/_journal.json` references only migrations `0000`–`0004`.
- `backend/src/index.ts` does not mount `/api/invoices` or `/api/commercial/payments`.
- `backend/src/services/readiness.ts` checks only RC1 migration hashes.
- `backend/src/services/restaurantModulePolicies.ts` contains only `customers`, `quotes`, `products`.
- No `backend/src/services/commercial/` directory exists.
- No Commercial Core verification scripts exist.

---

## 3. Evidence

### 3.1 Commercial Core is materially present but not committed

The S1 audit recorded:

> "Commercial Core (shared orders, invoices, payments) physically exists in this checkout as uncommitted/untracked additions: new schema, migrations `0005`/`0006`/`0007`, routes `backend/src/routes/commercial/`, services `backend/src/services/commercial/`, and verification scripts."

This means the code is on disk but not sealed by Git history. A release candidate must be reproducible from Git; uncommitted files are not releasable.

### 3.2 Readiness/journal mismatch in dirty worktrees

The S2 manifest recorded:

> "The dirty worktree's `backend/drizzle/meta/_journal.json` includes entries for migrations `0005`, `0006`, and `0007`, and `backend/src/services/readiness.ts` checks for `journal_hash_0006`. These migrations are untracked and excluded from RC1. If the RC1 cleanup removes the Commercial Core files without also reverting the journal/readiness/index/policies, then `/readyz` will fail."

The S3 review classified this as **Critical**.

The S4 cleanup intentionally rebased the RC1 candidate onto `ece2596` (a commit before the Commercial Core anticipations) to avoid this mismatch entirely. Reintroducing Commercial Core would reintroduce the mismatch.

### 3.3 No frontend workspace

No dedicated Commercial Core frontend module was found in any audited worktree. RC1 cannot ship a backend-only billing flow.

### 3.4 RC1 candidate already verified without Commercial Core

The S5 verification report confirms:

- Backend build: ✅ pass
- Frontend build: ✅ pass
- Migrations `0000`–`0004`: ✅ apply cleanly
- Readiness checks: ✅ `ok: true`, 34/34 checks pass
- Shared Customers/Quotes/Products/Inventory verification: ✅ pass
- Security/tenant/auth verification: ✅ pass
- Commercial Core: absent from the candidate

The candidate is viable **because** Commercial Core is excluded.

### 3.5 Restaurant isolation

The S3 review confirmed:

> "Restaurant operational surface is insulated from RC1 changes."

Commercial Core is adjacent to Restaurant payments and order flows. Shipping it unverified would risk regressing the protected Restaurant/POS/KDS surface.

---

## 4. Risks

### Critical

| Risk | Impact |
|------|--------|
| Including Commercial Core would reintroduce the readiness/journal mismatch | `/readyz` fails on a clean database; RC1 deployment blocked |
| Uncommitted migrations cannot be reproduced or reviewed | Release candidate is not traceable to Git history |

### High

| Risk | Impact |
|------|--------|
| No Commercial Core frontend | Incomplete end-to-end feature; cannot be user-tested |
| Commercial Core verification scripts are untracked | Cannot prove the feature works in CI or staging |
| Reintroducing Commercial Core expands RC1 from a foundation release to a feature release | Increases regression risk for Customers, Quotes, Products, Inventory, and Restaurant |

### Medium

| Risk | Impact |
|------|--------|
| Commercial Core anticipations remain in `q360-core-m1-r5` / main worktree | Those worktrees remain dirty and cannot be used for RC1 tagging |
| Boundary documents (`docs/Q360-CORE-M3-*.md`) are untracked | Scope and design are not committed |

### Low

| Risk | Impact |
|------|--------|
| Future merge of Commercial Core branch may require migration renumbering | Manageable if planned as a dedicated RC2/follow-on release |

---

## 5. Decision

### Commercial Core: Post-RC1

Commercial Core (Shared Orders, Invoices, Payment Status, and any Commercial frontend) will **not** be included in RC1.

### Conditions that would change this decision

Commercial Core could be reconsidered for inclusion only if **all** of the following were true:

1. All migrations (`0005`/`0006`/`0007`) are committed and tracked.
2. The migration journal, readiness service, module policies, and `backend/src/index.ts` are cleanly aligned.
3. A frontend workspace for Commercial Core exists and builds.
4. `verify:invoices` and `verify:payment-status` pass against a staging database.
5. The changes are on a clean branch with no worktree divergence.
6. CI is in place and passes.

None of these conditions are met today.

---

## 6. Recommendation

### 6.1 RC1 scope

Proceed with `rc/q360-rc1-clean` as the RC1 candidate, containing only:

- Platform safety: Wave 0, `/health`, `/readyz`, migration safety.
- Shared Core: Customers, Quotes, Products, Inventory.
- Safety: authentication, tenant isolation, authorization, audit logging, deployment controls.

### 6.2 Commercial Core next milestone

Create a dedicated feature branch (e.g., `feature/q360-core-m3-commercial-core-clean`) from a clean baseline after RC1 is tagged. On that branch:

1. Commit migrations `0005`/`0006`/`0007` and update `backend/drizzle/meta/_journal.json`.
2. Commit `backend/src/routes/commercial/` routes.
3. Commit `backend/src/services/commercial/` services.
4. Commit `backend/src/scripts/verify_invoices.ts` and `verify_payment_status.ts`.
5. Create the Commercial Core frontend workspace (`src/modules/commercial/` or equivalent).
6. Update readiness to include Commercial Core checks only when that branch ships.
7. Run verification scripts and add targeted tests.
8. Target this work for **RC2 or a named follow-on release**, not RC1.

### 6.3 Immediate actions

1. Do **not** merge Commercial Core files into `rc/q360-rc1-clean`.
2. Do **not** tag RC1 from `a99a43d` or any dirty worktree containing Commercial Core.
3. Tag RC1 from the clean `rc/q360-rc1-clean` branch after adding CI and staging verification.
4. Keep Commercial Core development on its own branch, isolated from RC1 promotion.

---

**End of decision.**
