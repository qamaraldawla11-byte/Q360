# A1 — Q Orchestration Contract Layer: Implementation Report

**Branch:** `feature/q-agent-orchestration` · **Worktree:** `D:\VS CODE App\Q360-q-agent-orchestration`
**Date:** 2026-07-18 (closure pass 2026-07-19) · **Scope:** foundation-only. No workspace creation, no module activation, no navigation, no LLM, no onboarding/auth/tenant/DB changes. **Not committed, not pushed.**

---

## 1. Files changed

| File | Change | Purpose |
|---|---|---|
| `backend/src/services/restaurantModulePolicies.ts` | new | **Canonical, dependency-free** module policy definition (type + 11 policies + `getModulePolicy`). No DB, no Hono, no env |
| `backend/src/services/businessModules.ts` | refactored | Now imports policy data from `restaurantModulePolicies.ts` and re-exports it (single canonical definition, unchanged import site for `routes/business.ts` / `routes/restaurant.ts`); keeps only the DB-backed `isBusinessModuleEnabled`. **No behavior change** |
| `backend/src/services/qOrchestration.ts` | new | Typed contracts, pure validators, destination allowlist + resolver. Imports policy data from the pure module only |
| `backend/src/scripts/verify_q_orchestration_contract.ts` | new | 22-case verification |
| `backend/package.json` | 1 line added | `verify:q-orchestration-contract` |
| `docs/Q_AGENT_ORCHESTRATION_A1_REPORT.md` | new | this report |

Untouched: GuestQConcierge, LandingView, onboarding, auth, tenant helpers, schema, business-creation routes, module activation logic, navigation components, security files, deployment config. The 11-module list exists exactly once (in `restaurantModulePolicies.ts`).

## 2. Pure import graph (before → after closure pass)

**Before:**
```
qOrchestration.ts → businessModules.ts → db/client.ts → requireDatabaseUrl() at module load
                                            ↳ drizzle-orm, postgres-js, @supabase/supabase-js
```

**After:**
```
qOrchestration.ts ────────────────→ restaurantModulePolicies.ts   (pure: zero imports)
businessModules.ts → db/client.ts (unchanged, DB-backed service)
                 ↘ restaurantModulePolicies.ts (re-exported; one canonical definition)
routes/business.ts, routes/restaurant.ts → businessModules.js      (import sites unchanged)
```

`qOrchestration.ts` is now importable with **no DATABASE_URL, no JWT_SECRET, no database initialization, no Hono, no React** — proven, not assumed (§6, first check).

## 3. Contracts introduced

All in `backend/src/services/qOrchestration.ts`:

- **`QRecommendation`** — validated recommendation: `intent` (enum), `businessType` (free text, display-only), `recommendedWorkspace: ApprovedWorkspaceId`, `recommendedModules`, `priorities`, `rationale`, `requiresApproval: true` (literal). Structurally cannot carry `businessId`, `destination`, `role`, JWT claims, or executable fields.
- **`QOwnerApproval`** — explicit owner decision: validated `recommendation`, `state` (`pending|approved|corrected|rejected`), validated `corrections`, anti-tamper recomputed `approvedWorkspace`/`approvedModules`, and optional **`clientEventAt`** (untrusted metadata only). **There is no `approvedAt`/`decidedAt`** — see §4.
- **`QTrustedApproval`** — type-only future record: `{ approval, approvedAt, approvedBy }`. `approvedAt`/`approvedBy` may only be minted server-side from authenticated context. A1 creates no instances.
- **`QOrchestrationResult`** — discriminated union on `success`; `businessId` exists only in the success branch; failure is machine-readable. `orchestrateWorkspace()` always returns `{ success:false, code:'not_implemented' }` — no success path exists in A1.
- **`validateRecommendation` / `validateApproval`** — pure `unknown → QValidationResult<T>` guards, project hand-rolled convention, no new framework.
- **`resolveDestination(workspace)`** — deterministic table lookup; no caller-supplied string can flow into a route.

## 4. Approval timestamp trust model

- The explicit approval **decision** is the `state` field set by a deliberate UI action — that is the only approval evidence in the client contract.
- **`clientEventAt`** (optional): client clock metadata. Accepted only as a string, carried verbatim, **never authoritative**.
- **`approvedAt`**: minted only by the future server-side orchestration layer. Runtime validation **rejects** any input containing `approvedAt` (`forbidden_field`). A1 fabricates no timestamps.
- Verified by the dedicated case: forged `approvedAt` rejected; `clientEventAt` carried but never promoted; approval with no timestamp at all remains valid (proof is the explicit state, not a clock value).

## 5. Trusted vs untrusted boundary

| Untrusted/model may propose | Trusted layer exclusively owns |
|---|---|
| business type (free text) | tenant identity, `businessId` (JWT/DB-derived) |
| workspace recommendation (allowlist-clamped) | role & permission decisions |
| module recommendation (registry-clamped) | module availability policy |
| priorities, rationale (display text) | approval state, `approvedAt` (server-minted) |
| `clientEventAt` (metadata) | execution, destination, navigation |

Runtime enforcement: `FORBIDDEN_UNTRUSTED_FIELDS` (15 fields incl. `businessId`, `role`, `destination`, `route`, `success`) rejected from recommendation input; `approvedAt` rejected from approval input.

## 6. Verification cases and results

`npm run verify:q-orchestration-contract` → **22/22 passed**, executed with `DATABASE_URL` and `JWT_SECRET` **explicitly unset at the shell level** (`env -u`) and also deleted inside the script before import.

- **Import purity (1):** contract module + canonical policy list import with both env vars unset.
- **Positive (5):** workspace→destination resolution; valid recommendation parses; all ready-module combinations validate; valid explicit approval; owner correction re-targets workspace.
- **Negative (10):** arbitrary route/destination strings; unknown workspace; unavailable workspaces (pharmacy/supermarket/school/services); unknown module; module/workspace mismatch; model-supplied `businessId`/`role`/`success`; missing/false `requiresApproval`; malformed approval; malformed recommendation objects; orchestration failure stays discriminated (no `businessId`/`destination` on failure).
- **Security — timestamp trust (1):** §4 cases.
- **Registry consistency (5):** see §7 — **transitional** textual checks.

## 7. Workspace/destination synchronization — honest status

The destination allowlist is an **audited map** kept deliberately in A1 (replacing the route architecture would broaden scope). Its consistency checks are **transitional drift alarms, not durable proof of route correctness**:

**Runtime/type-level checks (durable):**
- Module allowlist derived by import from the canonical `restaurantModulePolicies` — cannot drift silently.
- `resolveDestination` keyed by the typed `ApprovedWorkspaceId` union — unknown workspaces are compile-time + runtime rejected.

**Textual source-inspection checks (transitional, format-sensitive):**
- Route existence: regex `path: '...'` over `src/views/routes.tsx`.
- Workspace enabled-status: bounded-window regex over `src/core/modules/moduleRegistry.ts`.
- `workspacePaths` mapping: regex over `backend/src/routes/user.ts`.

**What could break them (false failures):** reformatting route definitions (e.g. `path="..."` JSX attributes, template literals, extracted route constants), reordering registry fields beyond the 400-char window, renaming `workspacePaths`.

**What could evade them (false passes):** a route whose path exists but renders a stub/404; a workspace marked `enabled` in the registry while its routes are removed (segment-level check only verifies each segment appears *somewhere*); semantic changes to guard behavior (`ProtectedRoute`, `RestaurantAccessGuard`) that alter real reachability; duplicated paths with different parents. Each check carries a sanity assertion (e.g. minimum extracted route count) so format changes fail loudly, but semantic drift in routing behavior is **not** covered.

**Follow-up recommendation (post-A1):** extract a dependency-free shared workspace/destination registry module (same pattern as `restaurantModulePolicies.ts`) that both frontend (`routes.tsx`, `moduleRegistry.ts`) and backend (`user.ts`, `qOrchestration.ts`) import, replacing all three textual checks with import-level truth.

## 8. Typecheck / hygiene

- `npx tsc --noEmit` (whole backend): **clean**
- `git diff --check`: **clean** (one informational LF→CRLF warning on `businessModules.ts`, matching repo convention)

## 9. `git status`

```
 M backend/package.json
 M backend/src/services/businessModules.ts
?? backend/src/scripts/verify_q_orchestration_contract.ts
?? backend/src/services/qOrchestration.ts
?? backend/src/services/restaurantModulePolicies.ts
?? docs/Q_AGENT_ORCHESTRATION_A1_REPORT.md
?? docs/Q_AGENT_WORKSPACE_ORCHESTRATION_DISCOVERY.md
```

**Nothing committed, nothing pushed.** The original working tree (`security/authz-evidence-baseline`) was not touched.

## 10. Remaining synchronization risks

1. **Workspace truth in three places** (allowlist / `workspacePaths` / frontend registry) — drift alarms only (§7); durable fix is the shared registry follow-up.
2. **Frontend cannot consume these contracts** (package boundary) — A2/A3 approval UI needs mirrored types or an extracted shared package; decide at A2 review.
3. **`businessModules.ts` re-export shim** — keeps one canonical definition, but a future reader could import the pure module and miss the DB-backed enablement semantics; documented in both files.

## 11. Exact proposed A1 commit contents (for review — NOT committed)

```
backend/src/services/restaurantModulePolicies.ts   (new — canonical pure policy)
backend/src/services/businessModules.ts            (refactor — import/re-export, no behavior change)
backend/src/services/qOrchestration.ts             (new — contracts + validators)
backend/src/scripts/verify_q_orchestration_contract.ts (new — 22 checks)
backend/package.json                               (+1 script line)
docs/Q_AGENT_WORKSPACE_ORCHESTRATION_DISCOVERY.md  (new — discovery baseline)
docs/Q_AGENT_ORCHESTRATION_A1_REPORT.md            (new — this report)
```

Suggested message: `feat(q-orchestration): A1 typed contract layer with allowlisted destinations and pure policy module`

---

*Stop here for architectural review. No commit, no push.*
