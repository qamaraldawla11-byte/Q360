# Q360 M5 Authority Alignment — Final Report

**Status:** OFFICIAL ARCHITECTURE RECORD
**Decision:** M5 closed — Approved with conditions (see M6 Entry Criteria)
**Branch:** `feature/design-system-ds3-operational`
**Key commits:** `a561509` (M5.1) · `0f5d22b` (M5.8) · `c0e209e` (M5.9)
**Date:** 2026-07-26
**Authority:** `docs/ADR-020-Q360-AUTHORITY-AUTHORIZATION-MODEL.md`

---

## 1. Executive Summary

Q360 entered M5 with authorization drift: frontend and backend disagreed on module identifiers, module enablement existed but was not enforced, `moduleAccess` was frontend-only, role checks were inconsistent, and a prior hardening report described code that did not exist. M5 closes with a five-layer backend enforcement model that is implemented, tested, and verified: tenant identity → effective role resolution → module activation → user module access → role authorization. No schema changes, no role semantics changes, no architectural expansion.

---

## 2. Historical Record Correction

```text
M4 Authorization Hardening Report
Status: Specification / Intended Design

Reason:
The reported middleware changes were not found in git history,
branches, stashes, or worktrees.
```

The file `Q360-M4-Authorization-Hardening-Report.md` describes `requireRestaurantModule()` / `requireUserModuleAccess()` middleware applied to inventory, staff, customers, and purchases/expenses routes. M5.6 and M5.7 established exhaustively that this code was never committed, never stashed, and exists in no worktree. The report is therefore treated as a **design specification**, not an as-built record. The enforcement layer that exists today was **reimplemented during M5.8 based on M4 intended design** — not migrated from M4.

---

## 3. Milestone Ledger

### M5.1 — Module Key Alignment

**Decision**
Backend policy keys are the single canonical module identifier set. Frontend navigation must never become an authorization source. URL paths are preserved.

**Implementation**
Manifest IDs aligned to policy keys: `kitchen → kds`, `floor → tables`, `billing → payments`, `reports → daily-report`. `RESTAURANT_MODULE_ACCESS` reduced to an identity map (self-declared removable). Route guard `accessKey` props updated; URL paths (`/kitchen`, `/floor`, `/billing`, `/reports`) unchanged.

**Evidence**
Commit `a561509`. Canonical keys verified against `backend/src/services/restaurantModulePolicies.ts` and `src/views/routes.tsx:240-252`.

### M5.2 — Booking Capability Decision

**Decision**
Bookings remains a Restaurant capability under the `tables` module key. No Booking Core extraction.

**Implementation**
None required. All four bookings call sites in `restaurant.ts` consistently use `isBusinessModuleEnabled(businessId, 'restaurant', 'tables')`.

**Evidence**
`docs/M5.2-BOOKING-CAPABILITY-DECISION-AUDIT.md`. Rationale: restaurant-specific schema, coupled with restaurant tables, no reuse evidence for other industries.

### M5.3 — Role Hierarchy Audit

**Decision**
`requireRole()` stays exact-match. Role hierarchy implementation deferred to M6. Legacy owner elevation must be preserved in any future change.

**Implementation**
None (audit only). Documented that `admin` is overloaded across platform and business domains, and that `resolveEffectiveBusinessRole()` elevates legacy restaurant creators (`role='user'` + sme/restaurant/onboarded/primaryWorkspace five-point check) to `owner` with DB write-back, with staff-membership precedence preventing ownership spoofing.

**Evidence**
`docs/M5.3-ROLE-HIERARCHY-DECISION-AUDIT.md`; `backend/src/middleware/auth.ts:118-133`; `backend/src/services/businessOwnership.ts`.

### M5.4 — Frontend Role Alignment

**Decision**
Normal users must not receive management UI access. Legacy owners remain supported through backend role resolution.

**Implementation**
Removed `'user'` from `BUSINESS_MANAGEMENT_ROLES` in `src/utils/restaurantAccess.ts`.

**Evidence**
M5.4 change verified against current tree; legacy owner path (`resolveEffectiveBusinessRole`) confirmed operational and unaffected.

### M5.5 — Route Role Audit

**Decision**
Catalog every `requireRole()` call site and role check; produce gap report; defer read-endpoint permission model to M6.

**Implementation**
None (read-only audit). Key findings: 9 distinct role arrays across 8 files; restaurant.ts GET endpoints (reports, dashboard, KDS, orders, menu, business-pulse snapshot) carry no role check; platform admin and business admin share the single `admin` role with no isolation; five different array flavors confirm hierarchy absence.

**Evidence**
`docs/M5.5-ROUTE-ROLE-GAP-REPORT.md`.

### M5.6 — Module Enforcement Coverage Audit

**Decision**
Treat the M4 hardening report as specification, not as-built history. Do not close M5 on a false baseline.

**Implementation**
None (read-only audit). Established that only `tables` had (partial) activation enforcement; no route anywhere enforced `users.moduleAccess`; inventory/staff/customers GETs were role-open; the staff invitation module allowlist lacked `finance` and `customers`.

**Evidence**
M5.6 audit (chat-delivered): `isBusinessModuleEnabled` call sites confined to `business.ts` and `restaurant.ts`; zero `requireRestaurantModule`/`requireUserModuleAccess` hits.

### M5.7 — Authorization Baseline and Branch Reconciliation

**Decision**
Reimplement cleanly. Nothing exists to review, reuse, or cherry-pick. Baseline is the current branch HEAD, which contains the complete committed authorization chain (`0ad0a05` → `c693b93` → `e7e560e` → `e1d3e28` → `1a934ab` → `baec506` → `38dc0ef` → `a561509`).

**Implementation**
None (read-only Git investigation). Exhaustive search across all branches, 5 worktrees, 6 stashes, and full history proved the M4 middleware exists nowhere. Disambiguated the `fix/m4.18`/`fix/m4.20` branches (Q-milestone Kimi timeout fixes, unrelated numbering).

**Evidence**
M5.7 report (chat-delivered): `git grep` across every ref and stash returned zero hits for both middleware names.

### M5.8 — Module Enforcement Reimplementation

**Decision**
Restore the backend authorization boundary using a single reusable factory and a pure, testable decision function. Preserve the compatibility contract exactly.

**Implementation**
Added:

- `backend/src/services/moduleAccessControl.ts` — pure decision logic (no DB/Hono)
- `backend/src/middleware/moduleAuthorization.ts` — `requireModule(moduleKey)` Hono middleware factory
- `backend/src/services/moduleAccessControl.test.ts` — 13 unit tests

Applied to:

- `inventory.ts` — `use('/*', requireModule('inventory'))`
- `staff.ts` — `use('*', requireModule('staff'))`; invitation allowlist extended with `finance`, `customers`
- `customers.ts` — `use('/*', requireModule('customers'))`
- `purchasesExpenses.ts` — `use('*', requireModule('finance'))` (activation; role gate unchanged)
- `restaurant.ts` — GET /tables activation gap closed (POST /tables check already existed from `0ad0a05`)
- `src/utils/restaurantAccess.ts` — frontend null/undefined moduleAccess semantics aligned to the backend contract

**Evidence**
Commit `0f5d22b` (9 files, +205/−1). 19/19 runtime verification matrix (activation ×5 modules enabled/disabled, moduleAccess null/`[]`/match/miss/disabled-override, middleware ordering ×3). 13/13 unit tests. Backend and frontend `tsc --noEmit` clean for all touched files. POST /tables pre-existing check confirmed (not duplicated).

### M5.9 — Verification Fixture Repair

**Decision**
Repair stale verification fixtures; do not touch authorization code, assertions, or expected statuses.

**Implementation**
Inserted missing `users` rows for every signed JWT fixture (authMiddleware enforces account existence per request since `baec506`): 6 role fixtures in `verify_security_authz.ts`, 2 owners in `verify_customers.ts`, 1 manager in `verify_purchases_expenses.ts`, 3 directory-role users in `verify_staff_hr.ts`. Cleanup deletion lists extended. Intentional invalid-token tests (forged signature, workspace-route claim) preserved.

**Evidence**
Commit `c0e209e` (4 files, +32/−6). Final verification: `verify_security_authz` 66 PASS / 0 FAIL; `verify_business_modules`, `verify_inventory_procurement`, `verify_customers`, `verify_purchases_expenses`, `verify_staff_hr` all PASS.

---

## 4. Final Authority Model

```text
Authority allocation:

Frontend:   Presentation authority only
Backend:    Security authority
Database:   Tenant and permission state authority
Q:          Must pass through existing authorization boundaries
```

Enforcement pipeline (every authenticated request):

```text
Request
 ↓
[1] Tenant identity — authMiddleware
    JWT verification; workspace-route claims rejected; per-request
    account-state enforcement (lock/deactivation/role change effective
    immediately); legacy tokens resolve tenant only via verified user record
 ↓
[2] Effective role — resolveEffectiveBusinessRole
    legacy restaurant creators elevated to owner (DB write-back);
    staff membership takes precedence (anti-spoofing)
 ↓
[3] Module activation — isBusinessModuleEnabled (M5.8 requireModule)
    policy file is sole source of truth; unknown keys fail closed;
    disabled module → 409
 ↓
[4] User module access — moduleAccessControl (M5.8)
    owner/admin/manager bypass; null/undefined = legacy allow;
    [] = explicit deny; array = allowlist; violation → 403
 ↓
[5] Role authorization — requireRole (exact match)
    + restaurant domain action matrix (canUseQ / canPerformRestaurantAction)
 ↓
Route handler — all queries tenant-scoped by businessId
```

**moduleAccess contract (frozen):**

| Value | Meaning |
|---|---|
| `null` / `undefined` | Legacy unrestricted access |
| `[]` | Explicit deny-all |
| `['inventory', ...]` | Allow only listed modules |

Runtime enforcement target: `users.moduleAccess`. Management roles (`owner`, `admin`, `manager`) bypass this layer entirely.

**Module inventory:** five configurable modules (`tables`, `inventory`, `staff`, `finance`, `customers`) — toggleable per business, enforced end-to-end; six protected modules (`dashboard`, `pos`, `kds`, `menu`, `payments`, `daily-report`) — cannot be disabled.

---

## 5. Frozen Decisions Register

| # | Decision | Basis |
|---|---|---|
| F1 | Backend policy keys are the only canonical module identifiers | M5.1 |
| F2 | Bookings lives under the `tables` key; no Booking Core | M5.2 |
| F3 | `requireRole()` remains exact-match; hierarchy arrives only as a new `requireHierarchyRole()` in M6 | M5.3 / ADR-020 |
| F4 | Legacy owner elevation path and its five-point check are preserved verbatim | M5.3 / M5.5 |
| F5 | moduleAccess contract: null = legacy allow, `[]` = explicit deny | M5.8 (test-locked) |
| F6 | Disabled module → 409; module access denial → 403; activation layer precedes role layer | M5.8 |
| F7 | URL paths unchanged (`/kitchen`, `/floor`, `/billing`, `/reports`) | M5.1 |
| F8 | Frontend registry/navigation is presentation-only, never an authorization source | M5.1 / M5.4 |
| F9 | M4 report classified as specification, not as-built | M5.6 / M5.7 |
| F10 | No new tables, no migrations, no subscription logic — M5 boundary | ADR-020 |

---

## 6. M5 Scope Boundaries

**What M5 intentionally did not solve:**

Not implemented:

- platform_admin separation
- RBAC hierarchy
- fine-grained ACL framework
- subscription enforcement
- generic capability extraction
- microservices
- database permission redesign

Reason: deferred because evidence does not yet justify architectural expansion. Each item has a designated M6 home (see §8).

---

## 7. Risk Register

### Accepted risks remaining after M5

| Risk | Severity | Notes |
|---|---|---|
| restaurant.ts GET endpoints (reports, dashboard, KDS, orders, menu, business-pulse snapshot) have no role check | Medium | Recorded in M5.5; financial data readable by operational roles |
| `staff_members.moduleAccess` diverges from `users.moduleAccess` on PATCH | Medium | Enforcement targets `users` (correct behavior); data drifts |
| Playwright e2e not executed in the M5.8 environment | Low | Compile- and script-level verification complete; gate at M6 entry |
| bookings/tables key coupling | Low | 4 call sites to migrate if ever split |
| bookings read/write role asymmetry | Low | Module layer consistent; role layer read-open |

### Deferred to M6

| Item | Notes |
|---|---|
| platform_admin separation | Highest priority; `admin.ts` is the only file keying on bare `admin` — smallest blast radius |
| Role hierarchy (`requireHierarchyRole()`) | Migrate route-by-route; restaurantDomain role arrays are the seed matrix; 11 call sites containing `'user'` need explicit decisions first |
| Read-endpoint permission tiering | reports/dashboard/pulse-snapshot to management-readable |
| quotes ownership | Orphan capability: no module key, no frontend guard — needs ADR (fold into finance? new key? core?) |
| suppliers/procurement ownership | Nominally under `inventory`; no enforcement — confirm or split |
| users/staff_members moduleAccess sync | Fix the write path after confirming the single enforcement column |

---

## 8. Verification Evidence Summary

| Layer | Evidence | Result |
|---|---|---|
| Unit tests | `moduleAccessControl.test.ts` | 13/13 PASS |
| Runtime matrix | Activation ×5 modules (enabled 200 / disabled 409), moduleAccess (null allow / `[]` 403 / match 200 / miss 403 / disabled-override 409), ordering ×3 (401 auth-first / 409 module-before-role / 403 module-layer denial) | 19/19 PASS |
| Regression scripts | verify_security_authz | 66 PASS / 0 FAIL |
| | verify_business_modules, verify_inventory_procurement, verify_customers, verify_purchases_expenses, verify_staff_hr | All PASS |
| Compilation | backend `tsc --noEmit`, frontend `tsc -p tsconfig.app.json` | 0 errors in touched files |
| e2e | Playwright | NOT RUN (see M6 Entry Criteria) |

---

## 9. M6 Entry Criteria

Before M6 implementation begins:

Required:

- ☐ Rename M4 report status to specification
- ☐ Run Playwright full regression
- ☐ Add verify scripts to CI

Then M6 order:

```text
M6.1 platform_admin separation

↓

M6.2 moduleAccess synchronization

↓

M6.3 hierarchy role model

↓

M6.4 read permission tiering

↓

M6.5 capability ownership ADRs
```

---

## Appendix A — Process Report Index

| Document | Role |
|---|---|
| `Q360-M4-Authorization-Hardening-Report.md` | **Specification / intended design** (see §2) — not as-built |
| `Q360-M5-Authority-Alignment-Audit-Plan.md` | Original M5 planning document |
| `docs/M5-AUTHORITY-ALIGNMENT-CONSOLIDATION-PLAN.md` | Consolidated milestone plan |
| `docs/M5.1-module-key-alignment.md` | M5.1 record |
| `docs/M5.2-BOOKING-CAPABILITY-DECISION-AUDIT.md` | M5.2 record |
| `docs/M5.3-ROLE-HIERARCHY-DECISION-AUDIT.md` | M5.3 record |
| `docs/M5.5-ROUTE-ROLE-GAP-REPORT.md` | M5.5 route role gap report |
| M5.6 / M5.7 reports | Delivered in review conversation; content incorporated into §3 |

*This document is the official M5 architecture record. Supersedes prior milestone reports where they conflict.*
