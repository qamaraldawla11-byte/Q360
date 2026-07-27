# Q360 M5 Authority Alignment Consolidation Plan

**Status:** Architecture roadmap — read-only  
**Date:** 2026-07-26  
**Scope:** Combine M5.0–M5.3 findings into a single implementation sequence  
**Authority:** M1, M2, M3 architecture audits approved; M4 hardening applied  

---

## 1. Current Authority Problems Summary

### 1.1 Module identifier drift (M5.0 / M5.1)

| Frontend Key | Backend Policy Key | Status |
|--------------|-------------------|--------|
| `kitchen` | `kds` | ✅ M5.1 aligned |
| `floor` | `tables` | ✅ M5.1 aligned |
| `billing` | `payments` | ✅ M5.1 aligned |
| `reports` | `daily-report` | ✅ M5.1 aligned |
| `dashboard` | `dashboard` | ✅ Already aligned |
| `pos` | `pos` | ✅ Already aligned |
| `menu` | `menu` | ✅ Already aligned |
| `inventory` | `inventory` | ✅ Already aligned |
| `staff` | `staff` | ✅ Already aligned |
| `finance` | `finance` | ✅ Already aligned |
| `customers` | `customers` | ✅ Already aligned |

**Remaining gap:** `bookings` — no standalone policy key exists. Bookings are subordinate to `tables` (M5.2 approved).

### 1.2 Booking ownership ambiguity (M5.2)
- `restaurantBookings` schema is `restaurant_` prefixed
- Booking routes gate on `isBusinessModuleEnabled('tables')`
- No `bookings` policy key in `restaurantModulePolicies.ts`
- Booking UI co-located in `FloorView.tsx`

**Verdict:** Booking remains Restaurant-specific, subordinate to `tables`. No extraction to Booking Core.

### 1.3 Role hierarchy absence (M5.3)
- `requireRole()` performs exact string matching only
- `admin` role conflates platform operator with workspace super-user
- `user` role incorrectly treated as management in frontend (`restaurantAccess.ts`)
- No canonical hierarchy utility exists
- Legacy owner runtime elevation from `user` → `owner` creates dual authorization paths

### 1.4 Frontend/backend authority drift
- Frontend `BUSINESS_MANAGEMENT_ROLES` includes `'user'`
- Backend `restaurantDomain.ts` uses domain-specific role lists
- Backend `requireRole()` is exact-match
- Mismatch means frontend may show modules the backend would reject

### 1.5 Multiple module registries
- `restaurantModulePolicies.ts` — backend canonical policy
- `moduleRegistry.ts` — frontend workspace/module definitions
- `restaurantAccess.ts` — frontend module access mapping
- `businessModules.ts` — database-backed enablement state

---

## 2. Decisions Already Accepted

### 2.1 From M3 / ADR-020
- **Backend is the final security authority.** Frontend controls presentation only.
- **Business identity comes from authenticated server context.**
- **Module activation belongs to business capability.**
- **User `moduleAccess` belongs to user permission.**
- **Role and `moduleAccess` are complementary.**
- **BusinessId remains tenant identity implementation.**
- **Workspace is not a security boundary.**

### 2.2 From M5.1 (Module Key Alignment)
- Canonical policy keys are the source of truth
- Frontend identifiers were aligned to backend keys
- URL paths remain unchanged (`/kitchen`, `/floor`, `/billing`, `/reports`)
- Only registry references, guard mappings, and layout checks were updated

### 2.3 From M5.2 (Booking Capability)
- Booking remains subordinate to `tables` module
- No standalone `bookings` policy key
- No Booking Core extraction
- Bookings are a natural extension of table assignment

### 2.4 From M5.3 (Role Hierarchy)
- Canonical hierarchy: `platform_admin > owner > admin > manager > {waiter, cashier, kitchen, staff}`
- `requireRole()` must remain exact-match until explicit hierarchy utility is created
- `admin` role conflation is a known risk requiring future separation
- `'user'` must be removed from `BUSINESS_MANAGEMENT_ROLES`

---

## 3. Frozen Architecture Rules

These rules are **protected** by ADR-020 and M5 findings. They must not be violated by any implementation.

| Rule | Source | Violation Risk |
|------|--------|----------------|
| Backend is the final security authority | ADR-020 §3 | Frontend bypassing backend checks |
| No shared capability extraction without reuse evidence | ADR-020 §4 | Extracting Booking Core prematurely |
| Module activation = business capability; moduleAccess = user permission | ADR-020 §3 | Mixing the two concepts |
| `businessId` remains tenant identity | ADR-020 §4 | Introducing workspace as security boundary |
| URL paths are stable | M5.1 requirement | Changing `/kitchen`, `/floor`, etc. |
| Schema must not change for M5 | M5 boundary | Adding tables, columns, or enum constraints |
| No new permission framework for M5 | M5 boundary | Creating RBAC tables or middleware |
| `requireRole()` stays exact-match until M6+ | M5.3 recommendation | Silently adding hierarchy to existing routes |
| No `bookings` policy key until reuse evidence | M5.2 recommendation | Creating standalone booking module |

---

## 4. Remaining Implementation Milestones

### M5.4 — Frontend role alignment (hardening)
- Remove `'user'` from `BUSINESS_MANAGEMENT_ROLES` in `restaurantAccess.ts`
- Verify no frontend views break
- Document the change

### M5.5 — Route role audit
- Catalog every `requireRole()` call
- Identify routes that incorrectly allow `'user'`
- Identify routes that should allow operational roles (`waiter`, `cashier`, `kitchen`)
- Produce gap report (no code changes)

### M5.6 — Module access enforcement completion
- Ensure all configurable modules (`tables`, `inventory`, `staff`, `finance`, `customers`) have backend `isBusinessModuleEnabled()` checks
- Verify `moduleAccess` fields are consulted where applicable
- Document any remaining gaps

### M6 — Role hierarchy utility (future)
- Create `requireHierarchyRole()` middleware
- Implement canonical role ranking
- Migrate `restaurantDomain.ts` role lists to hierarchy
- Separate `platform_admin` from workspace `admin`

### M7 — Authority model v2 (future)
- Evaluate subscription/plan enforcement
- Evaluate workspace as opt-in security boundary
- Evaluate Booking Core extraction if Services workspace activates

---

## 5. Dependency Order

```
M5.4 (Frontend role alignment)
    │
    ├── Depends on: M5.3 findings accepted
    ├── Risk: Low — single file change, backward compatible
    └── Deliverable: Fixed restaurantAccess.ts + verification

M5.5 (Route role audit)
    │
    ├── Depends on: M5.3 findings accepted
    ├── Risk: None — read-only
    └── Deliverable: Gap report document

M5.6 (Module access enforcement)
    │
    ├── Depends on: M5.1 alignment complete, M4 hardening baseline
    ├── Risk: Medium — touches restaurant.ts routes
    └── Deliverable: Verified backend enforcement + test report

M6 (Role hierarchy utility)
    │
    ├── Depends on: M5.4, M5.5, M5.6 complete
    ├── Risk: High — changes authorization behavior across all routes
    └── Deliverable: requireHierarchyRole() + migration guide

M7 (Authority model v2)
    │
    ├── Depends on: M6 complete, new workspace requirements
    ├── Risk: High — architectural change
    └── Deliverable: ADR update + implementation
```

---

## 6. Risk Assessment

| Milestone | Risk Level | Primary Risk | Mitigation |
|-----------|-----------|--------------|------------|
| M5.4 | 🟡 Low | Frontend may hide modules from legacy `user` accounts | Test with legacy owner elevation path |
| M5.5 | 🟢 None | Read-only audit | No runtime impact |
| M5.6 | 🟡 Medium | Missing enforcement on existing routes | Add checks incrementally; verify each |
| M6 | 🔴 High | Hierarchy may grant unintended access | Comprehensive test matrix per role |
| M7 | 🔴 High | Subscription/plan changes affect all tenants | Phased rollout with feature flags |

### Cross-cutting risks

| Risk | Likelihood | Impact | Owner |
|------|-----------|--------|-------|
| `admin` conflation causes platform admin to access workspace data | Medium | Critical | M6 owner |
| Frontend/backend role assumptions diverge after M5.4 | Low | Medium | M5.4 verifier |
| Legacy owner (`user` in DB) blocked by M5.4 fix | Low | High | Test with `resolveEffectiveBusinessRole()` |
| Module key alignment regresses | Low | Medium | M5.1 test suite |

---

## 7. What Must NOT Be Changed

### 7.1 Schema freeze
- No new tables
- No column additions
- No enum changes
- No migrations

### 7.2 Architecture freeze
- No new permission framework
- No microservice extraction
- No workspace manifest creation
- No Booking Core
- No subscription enforcement

### 7.3 Behavioral freeze
- `requireRole()` must not gain hierarchy logic
- `isBusinessModuleEnabled()` contract must not change
- Legacy owner elevation must remain operational
- URL paths must not change

### 7.4 Process freeze
- No commits without verification
- No deployment from M5 branch
- No merging to main without review

---

## 8. Recommended M5.4+ Implementation Sequence

### Phase 1: Hardening (M5.4 — M5.6)
Goal: Fix known inconsistencies without changing architecture.

**M5.4 — Frontend role alignment**
```
Target: src/utils/restaurantAccess.ts
Change: Remove 'user' from BUSINESS_MANAGEMENT_ROLES
Verification: TypeScript compile, manual test with legacy owner
Risk window: Low
Timeline: 1 session
```

**M5.5 — Route role audit**
```
Target: All requireRole() calls across backend routes
Output: docs/M5.5-ROUTE-ROLE-GAP-REPORT.md
Contents: Per-route allowed roles, recommended hierarchy mapping, gaps
Risk window: None (read-only)
Timeline: 1 session
```

**M5.6 — Module access enforcement verification**
```
Target: backend/src/routes/restaurant.ts + other route files
Change: Add isBusinessModuleEnabled() where missing for configurable modules
Verification: TypeScript compile, existing tests, manual route test
Risk window: Medium (touches production routes)
Timeline: 2 sessions
```

### Phase 2: Role hierarchy (M6)
Goal: Implement canonical role hierarchy utility.

**M6.1 — Hierarchy utility**
```
Target: backend/src/middleware/auth.ts
Change: Add requireHierarchyRole( minimumRole ) alongside requireRole()
Verification: Unit tests for every role combination
Risk window: High
Timeline: 3 sessions
```

**M6.2 — Domain migration**
```
Target: backend/src/services/restaurantDomain.ts
Change: Migrate role lists to hierarchy utility
Verification: Restaurant action test matrix
Risk window: High
Timeline: 2 sessions
```

**M6.3 — Admin separation**
```
Target: Platform vs workspace admin distinction
Change: Introduce platform_admin concept or scope admin checks
Verification: Platform console isolation test
Risk window: Critical
Timeline: 2 sessions
```

### Phase 3: Authority v2 (M7)
Goal: Future architecture — only when evidence requires it.

**M7.1 — Subscription enforcement**
```
Trigger: Business plan/subscription feature activated
Scope: Add plan-aware gating to module activation
```

**M7.2 — Booking Core evaluation**
```
Trigger: Services or Salon workspace requires bookings
Scope: Evaluate extraction of restaurantBookings to generic schema
```

**M7.3 — Workspace security boundary**
```
Trigger: Multi-workspace tenant requires isolation
Scope: Evaluate workspace as opt-in security boundary
```

---

## 9. Success Criteria

M5 is complete when:
- [x] M5.0 Module Key Evidence Audit complete
- [x] M5.1 Atomic Module Key Alignment implemented and verified
- [x] M5.2 Booking Capability Decision Audit complete
- [x] M5.3 Role Hierarchy Decision Audit complete
- [ ] M5.4 Frontend role alignment applied
- [ ] M5.5 Route role gap report produced
- [ ] M5.6 Module access enforcement verified
- [ ] All M5 documents reviewed and accepted
- [ ] TypeScript compilation passes
- [ ] Existing test suite passes
- [ ] No schema changes
- [ ] No new tables
- [ ] No new permission framework

---

## 10. Document Index

| Document | Status | Path |
|----------|--------|------|
| M5.0 Module Key Evidence Audit | Completed (context) | Referenced in M5.1 notes |
| M5.1 Module Key Alignment | Implemented | `docs/M5.1-module-key-alignment.md` |
| M5.2 Booking Capability Decision Audit | Completed | `docs/M5.2-BOOKING-CAPABILITY-DECISION-AUDIT.md` |
| M5.3 Role Hierarchy Decision Audit | Completed | `docs/M5.3-ROLE-HIERARCHY-DECISION-AUDIT.md` |
| M5 Authority Alignment Consolidation Plan | This document | `docs/M5-AUTHORITY-ALIGNMENT-CONSOLIDATION-PLAN.md` |

---

## 11. Escalation Triggers

Escalate to architecture review if any of the following occur during M5 implementation:

1. **Schema change required** — Any finding that claims a table or column must be added
2. **Role hierarchy needed for M5.x** — If a milestone cannot be completed without hierarchy
3. **New workspace requires booking** — If Services/Salon activates before M7
4. **Security incident** — Any authorization bypass discovered
5. **Test regression** — If existing tests fail and cannot be fixed within the milestone scope

---

**Plan status:** ✅ Complete  
**Code changes:** None (read-only roadmap)  
**Next action:** Await approval to begin M5.4 implementation
