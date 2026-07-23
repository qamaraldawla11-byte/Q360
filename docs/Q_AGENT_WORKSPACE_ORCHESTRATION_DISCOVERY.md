# Q Agent & Workspace Orchestration — Discovery & Architecture Evidence

**Branch:** `feature/q-agent-orchestration`
**Worktree:** `D:\VS CODE App\Q360-q-agent-orchestration` (created from `main` @ `faa59e2`)
**Date:** 2026-07-18
**Status:** Discovery only. No application code modified. No commit. No push. **Stop here for architectural review.**

---

## 0. M0 — Repository and Isolation Check

| Check | Result |
|---|---|
| Repository | `D:\VS CODE App\Q360` |
| Original working tree branch | `security/authz-evidence-baseline` (== `main` @ `faa59e2`, no divergence) |
| Original tree state | **Dirty with unrelated active work**: modified `backend/src/routes/{admin,auth,quotes,restaurant,user}.ts`, `backend/src/utils/tenant.ts`, `src/modules/public/{GuestQConcierge,LandingView}.tsx`, `src/views/admin/UsersPage.tsx`, plus ~40 untracked docs/scripts and `design-preview*/` directories |
| New worktree | `D:\VS CODE App\Q360-q-agent-orchestration`, branch `feature/q-agent-orchestration`, `git status` clean |
| Overlap with Security/Landing/design work | **None** — all discovery performed read-only inside the new worktree |
| Package boundaries | Frontend: React + Vite + TS, root `package.json`, code in `src/`. Backend: **Hono** (not Express) + TS + **Drizzle ORM / PostgreSQL (postgres-js)**, `backend/package.json`, code in `backend/src/`, routes mounted in `backend/src/index.ts:63-75` |

No files were created anywhere until this isolation was confirmed.

---

## 1. Current Q Capability Map

There are **two real Q conversation systems**, one admin observability surface, and several static/mock Q surfaces.

### 1.1 Guest Q Concierge (public, pre-auth)

| Aspect | Evidence |
|---|---|
| Frontend component | `src/modules/public/GuestQConcierge.tsx:1-411` — modal chat collecting a `GuestSetup` brief (business type/name/country/services/tables/employees/priorities/email) with a live "setup brief" sidebar and recommended-module chips |
| Entry point | `src/modules/public/LandingView.tsx:206-207,305,310,490-500` — hero prompt opens the modal; `onContinue` persists the brief to `sessionStorage['q360_guest_setup']` and `navigate('/login', { state: { guestSetup } })` |
| Backend route | `POST /api/public/q-concierge` — `backend/src/routes/public.ts:5-20`, mounted `backend/src/index.ts:63`; unauthenticated by design; IP/UA-derived `visitorKey` rate limiting |
| Backend service | `backend/src/services/qPublicConcierge.ts:1-317` — always-on rule engine (`guidedResponse` scripted state machine, lines 155-213; regex fact extraction `inferFallbackUpdates`, lines 127-153; module whitelist `modulesFor`, lines 47-60,109-125) plus an **optional** OpenAI Responses API call (lines 261-317; 12 s timeout, 450 max tokens, `store:false`, strict anti-injection system prompt lines 273-285) |
| Real vs mock | **Real** — every message round-trips the backend (`GuestQConcierge.tsx:169`). No canned client replies. |
| LLM influence | The model may only shape `reply` text and `suggestedReplies`; structured `updates` and `recommendedModules` come **only** from the deterministic extractor/whitelist (lines 229-250) — model output never writes state |
| Persistence | **Temporary** — React state only; transcript discarded on close/navigate. Backend stores nothing for guests. Rate limiter is an in-memory `Map` (lines 26-45), resets on restart |
| Limitations | History window 8 messages client / 6 server; 1200-char cap; no streaming; no retry; setup lost if modal closed; collected brief is never sent to any backend after login (see §5) |

### 1.2 Authenticated Restaurant "Q Assistant" (Business Pulse + Chat with Q)

| Aspect | Evidence |
|---|---|
| Frontend view | `src/modules/commerce/restaurant/views/AssistantView.tsx:1-150` — Business Pulse tab (question box, usage stats, insights, evidence cards, owner-reviewed drafts) + Chat with Q tab (conversation list, threaded messages, feedback) + owner/admin "Q business context" memory editor |
| Entry points | Route `/app/restaurant/assistant` (`src/views/routes.tsx:65,238`, behind `RestaurantAccessGuard management`); "Ask Q" floating launcher (`src/layouts/SmeLayout.tsx:254-269`); module registry entry `business-pulse` status `preview` (`src/core/modules/moduleRegistry.ts:225-235`) |
| Frontend API client | `src/api/restaurant.api.ts:309-325` — business-pulse, ask, briefing, memory, provider-status, conversations CRUD, messages, feedback, drafts, usage, draft decision |
| Backend handlers | `backend/src/routes/restaurant.ts` — helpers lines 440-981, routes lines 1082-1457. All authenticated, tenant-scoped (`businessId` filter on every query), audit-logged, usage-metered |
| "Q brain" | `buildQPulseResponse` (`restaurant.ts:772-842`) — deterministic keyword matching over a real DB snapshot (`buildBusinessPulseSnapshot`, lines 453-636: today's orders, payments, KDS tickets, tables, top items). Evidence cards/insights derived 1:1 from data |
| LLM wrapper | `backend/src/services/qModel.ts:86-158` — OpenAI Responses API via raw `fetch` (line 116), "advice-only" system prompt (lines 55-61), last-6-message history, cost tracking in USD micros. Every failure mode returns `usedModel:false` + `fallbackReason` so the rules engine silently takes over |
| Provider/budget gating | `backend/src/services/qProviderConfig.ts:1-74` — env-driven (`Q_AI_PROVIDER=openai` only, kill switch `Q_AI_EXTERNAL_ENABLED`, per-business monthly budget `Q_MONTHLY_BUDGET_USD` default **$5**). Keys never leave the server |
| Persistence | **Fully persistent, tenant-scoped Postgres** (`backend/src/db/schema.ts`): `q_assistant_conversations` (489-499), `q_assistant_messages` (501-514, with `evidenceCards` jsonb + `feedback`), `q_assistant_drafts` (430-447), `q_business_memories` (451-462), `q_usage_events` (466-485) |
| Action framework | **None.** No function calling, no tool dispatch. `allowedActions:['prepare_draft']` (`restaurant.ts:791-793`) is declarative metadata. Draft approval records a decision only — `dispatched:false` is returned explicitly (`restaurant.ts:1454`). Schema comment at `schema.ts:428`: drafts "never execute operational actions directly." |

### 1.3 Admin Q observability

`GET /api/admin/q-usage` (`backend/src/routes/admin.ts:68-86`) aggregates `q_usage_events`; frontend `src/views/admin/QUsagePage.tsx` at `/admin/q-usage` (`routes.tsx:373`). Real, admin-only, read-only.

### 1.4 Mock / static / placeholder Q surfaces

| Surface | File:line | Status |
|---|---|---|
| `AiView` "Meet Q" page at `/ai` | `src/modules/public/AiView.tsx:1-36`; `routes.tsx:191` | Static marketing copy, no chat |
| Landing "Meet Q" demo cards | `LandingView.tsx:392-438` | Hardcoded insight cards |
| SME dashboard agent panel | `src/components/sme/SmeDashboard.tsx:157-179` | Renders props; defaults empty — "Your agent is warming up" |
| Personal dashboard assistant panel | `src/components/personal/PersonalDashboard.tsx:15-26,116-132` | **Fully hardcoded** insights/invoices — pure mock |
| Shared future `business-pulse` module | `moduleRegistry.ts:594-603` | Registry placeholder, no route |
| Onboarding flow | `src/modules/onboarding/*` | Form-based (Identity/Type/Workspace); **no conversational Q interface** |

### 1.5 LLM integration verdict

Exactly **two** LLM call sites, both backend, both OpenAI Responses API via raw `fetch` (`qPublicConcierge.ts:298`, `qModel.ts:116`), both optional with deterministic rule-based fallback. No SDK, no other providers, no frontend keys, **no tool-calling framework anywhere**. Default shipped behavior of "Q" is rule-based unless an OpenAI key is provisioned.

---

## 2. Guest and Authenticated Q Surfaces

| Surface | Auth | Real/Mock | Persistent | Backend |
|---|---|---|---|---|
| Guest Q Concierge | Guest | Real (rules + optional LLM) | No (sessionStorage brief only) | `POST /public/q-concierge` |
| Restaurant Q Chat / Business Pulse | Authenticated (owner/admin/manager; drafts owner/admin) | Real (DB snapshot + rules + optional LLM) | Yes (Postgres) | `/restaurant/q/*`, `/restaurant/business-pulse/*` |
| Admin Q Usage | Admin | Real | Yes (read of `q_usage_events`) | `GET /admin/q-usage` |
| `/ai` page, landing cards, personal/SME dashboard panels | Mixed | Mock/static | n/a | None |
| Onboarding conversation | Authenticated | **Does not exist** — form views only | n/a | None |

---

## 3. Workspace Lifecycle (M2)

### Identity model — the critical distinction

| Concept | Meaning | Stored | In JWT | Sent to client |
|---|---|---|---|---|
| `businessId` | Stable tenant/DB identity (`biz_<uuid>`) | `users.business_id` (`schema.ts:39`), `businesses.id` (`schema.ts:350`); JWT claim | **Yes** (`auth.ts:224`; `middleware/auth.ts:20`) | **No** — `serializeUser` (`user.ts:51-65`) deliberately omits it; frontend `User` type has no `businessId` |
| `primaryWorkspace` | Navigation path, e.g. `/app/restaurant` | `users.primary_workspace` text column (`schema.ts:40`) only | No | Yes — used for redirects |

**They must not be copied into each other.** Known conflations found:

1. `backend/src/db/seed.ts:38` — seeded admin gets `primaryWorkspace:'biz_main'` (tenant ID in a route field).
2. `backend/src/routes/admin.ts:202` — `POST /admin/users` sets `primaryWorkspace: businessId || 'biz_main'`.
3. Reverse conflation is actively repaired: `isWorkspaceRoute()` (`utils/tenant.ts:7-8`), `/verify` repair (`auth.ts:204-211`), JWT rejection of route-like `businessId` (`middleware/auth.ts:43-45`).
4. Soft coupling: `resolveEffectiveBusinessRole` (`services/businessOwnership.ts:11-17`) uses `primaryWorkspace === '/app/restaurant'` as an ownership heuristic.

### Step-by-step call path

| Step | Path | Evidence |
|---|---|---|
| Signup/login | No signup form. `LoginView.tsx:42` → `auth.store.ts:105` → `POST /api/auth/login` → `auth.ts:38`. First verify auto-creates the user | Implemented |
| OTP verification | `LoginView.tsx:48` → `POST /api/auth/verify` → `auth.ts:100`. HMAC-hashed codes (`schema.ts:45-53`), 10-min TTL, 5 attempts, atomic claim, constant-time compare | Implemented |
| Business creation | (a) first verify: `businessId = invitation?.businessId \|\| 'biz_'+randomUUID()` + `ensureBusinessRecord` (`auth.ts:162-164`, `tenant.ts:18-35`); (b) onboarding: `ensureUserBusiness` (`user.ts:101`, `tenant.ts:37-54`); (c) admin: `POST /admin/businesses` (`admin.ts:415-445`) | Implemented (no dedicated user-facing endpoint) |
| Stable `businessId` | Generated server-side at user creation, JWT-carried, rehydrated per request into `c.set('businessId')` (`middleware/auth.ts:46-47`). **Never stored client-side.** Legacy fallback silently collapses into demo tenant `biz_main` (`tenant.ts:5,16,44`) | Implemented, with legacy gap |
| `primaryWorkspace` | Set at verify for staff (`'/app/restaurant'`, `auth.ts:177,189`); set at onboarding from `workspacePaths` map (`user.ts:29-41`, written line 127) | Implemented |
| Template/segment selection | `SubSegmentView.tsx` picker (only restaurant+retail `active`, lines 31-119; selection is **local-only** line 153) → `BusinessTypeView.tsx:73` → `PUT /api/user/profile` → `user.ts:79-143` persists `segment`+`primaryWorkspace`+name/country/currency in one write | Implemented; no template catalog API |
| Module activation | Policy catalog `services/businessModules.ts:15-27` (11 restaurant modules) → `GET /api/business/modules` (`business.ts:161-171`, **400s for non-restaurant**) → `PATCH /api/business/modules/:moduleKey` (`business.ts:173-196`) → `business_modules` table (`schema.ts:395-406`). Staff per-user access is separate: `users.moduleAccess` jsonb (`schema.ts:41`) | Implemented — **restaurant only** |
| Onboarding completion | `users.onboarding_completed` (`schema.ts:38`) set in `PUT /user/profile` (`user.ts:125`). Redundant client mirror `localStorage('onboarding_complete')` (drift-prone, never read for routing) | Implemented |
| Dashboard destination | Post-verify `LoginView.tsx:51-55`; post-onboarding `BusinessTypeView.tsx:83` → `lastActiveWorkspace \|\| /app/{segment}`; `/app` root resolution `routes.tsx:156-168`; restaurant index role-aware `routes.tsx:78-83` | Implemented |
| Session restoration | `initSession` (`auth.store.ts:72-103`) → `GET /api/user/profile` (`user.ts:69-77`) with Bearer token from `localStorage('auth_token')`; 401 → global logout (axios interceptor `http.ts:51-55`); 24-h JWT, no refresh. `GET /api/auth/session` (`auth.ts:251-273`) exists but is **unused** | Implemented |
| Workspace switching | UI links only (`VerticalLayout.tsx:111-125`, `SmeLayout.tsx:204-205,245`) → `/app/segments` hub; only restaurant enterable. **No API mutates `primaryWorkspace` post-onboarding.** `user.workspaces` hardcoded `[]` everywhere (`auth.ts:242,271`, `user.ts:64`). `lastActiveWorkspace` is client-only | UI-only stub |

### Lifecycle gaps relevant to Q

1. Onboarding **name is never persisted** (`UpdateProfileInput` has no `name` field; `IdentityView.tsx:14` is client-only).
2. Segment→path mapping **duplicated** in `SubSegmentView.tsx` and `user.ts:29-41` (drift risk; TODO aliases clinic→pharmacy, services→personal).
3. No workspace-switch API; no multi-workspace membership (`workspaces: []` stub).
4. Module activation exists only for restaurant.
5. Legacy users without stable tenant ID fall back to shared `biz_main`.

---

## 4. Navigation Lifecycle (M3)

Router: `react-router-dom` v6, `BrowserRouter` + `useRoutes` (`src/App.tsx:2,8,99`); full table `src/views/routes.tsx:186-384`.

Guards: `ProtectedRoute` (`routes.tsx:131-171`), `AdminRoute` (173-184), `RestaurantAccessGuard` (`src/components/auth/RestaurantAccessGuard.tsx:13-36`), `AppShell` layout picker (`src/layouts/AppShell.tsx:13-25`).

### Key transitions

| From → To | Initiator | Mechanism | Auth/state required | Conversation context survives? |
|---|---|---|---|---|
| Landing → Q concierge | `LandingView.tsx:490-500` | React state (modal, **not a route**) | None | Chat starts fresh with hero prompt |
| Concierge → Login | `LandingView.tsx:495-498` (`onContinue`) | `navigate('/login',{state})` + `sessionStorage['q360_guest_setup']` | CTA gated on `readyForSignIn` + valid email (`GuestQConcierge.tsx:268,400`) | **Partial** — transcript discarded; structured brief survives |
| Login → Onboarding (new user) | `LoginView.tsx:53-54` | `navigate('/onboarding/identity')` | `onboardingCompleted===false` (enforced `routes.tsx:142`) | Brief retained in storage/state; email prefilled |
| Login → Workspace (returning) | `LoginView.tsx:51-52` | `navigate(primaryWorkspace \|\| /app/{segment} \|\| /app)` | `onboardingCompleted===true` | Brief stored but **never consumed** |
| Onboarding type → workspace | `SubSegmentView.tsx:151-155` | `updateUser` + `navigate('/onboarding/workspace')` | **Manual segment pick required** — concierge `businessType`/`recommendedModules` not used to preselect | Brief unread here |
| Onboarding → module workspace | `BusinessTypeView.tsx:65,80-83` | `PUT /user/profile` then `navigate(workspacePath,{replace:true})` | Auth + segment set | Brief used only for `businessName`+`country` prefill (lines 43-60); then `sessionStorage.removeItem` (line 82) — **`businessType`, `services`, `priorities`, `tables`, `employees`, `recommendedModules`, `initialRequest` deleted unread** |
| Into Q Assistant | `SmeLayout.tsx:254-269` | `navigate('/app/restaurant/assistant?tab=chat')` | Restaurant manager | Server-persisted per-business conversations — **no handoff from concierge transcript** |

The frontend holds **no `businessId`** for navigation; guards key off `user.segment`, `userType`, `primaryWorkspace`, `lastActiveWorkspace`, `moduleAccess`. Note: `userType:'personal'` is never set anywhere in the frontend — all onboarding paths hardcode `'sme'`, so Personal OS is unreachable via onboarding.

### Can Q currently move a user from chat into the correct workspace?

**Partially supported.** The pipe exists end-to-end (concierge → login → forced onboarding → workspace landing → role-aware restaurant home), so a guest *can* land in a real guarded workspace. But:

- the concierge's core intelligence (`businessType`, `recommendedModules`, `priorities`, etc.) is stored and then **deleted unread** (`BusinessTypeView.tsx:82`);
- the segment is **never auto-selected** — the user can contradict Q's recommendation and the app honors the manual pick;
- the chat transcript survives **no** transition; the workspace Q assistant starts from scratch;
- the backend never receives the guest brief at all (no `guestSetup` references in `backend/src`);
- recommendations are display chips with **no downstream effect** (`GuestQConcierge.tsx:267,385-389`).

---

## 5. Conversation Persistence Status

| Conversation | Storage | Survives reload? | Survives navigation? | Crosses auth boundary? |
|---|---|---|---|---|
| Guest concierge transcript | React state only | No | No | No |
| Guest `GuestSetup` brief | `sessionStorage['q360_guest_setup']` + router state | Reload: yes | To login + onboarding prefill: partially (~80% of fields discarded) | Guest→auth handoff is email-prefill only; **never sent to backend** |
| Authenticated Q chat | Postgres `q_assistant_conversations` / `q_assistant_messages` | Yes | Yes | n/a (tenant-scoped) |
| Q business memory | Postgres `q_business_memories` | Yes | Yes | n/a |
| Q drafts / usage | Postgres | Yes | Yes | n/a |

**Verdict:** the authenticated Q system has production-grade persistence; the guest concierge — the system that would drive workspace orchestration — is entirely ephemeral, and its one persisted artifact (the brief) is discarded before use.

---

## 6. Real vs Mock Capability Matrix

| Capability | Classification | Evidence |
|---|---|---|
| Guest natural-language chat | Real (rules + optional OpenAI, advice-only) | `public.ts:5-20`, `qPublicConcierge.ts` |
| Authenticated business chat over live data | Real (tenant-scoped DB + rules + optional OpenAI) | `restaurant.ts:440-1457`, `qModel.ts` |
| Q conversation persistence (authenticated) | Real | `schema.ts:489-514` |
| Q conversation persistence (guest) | Missing | React state only |
| Structured recommendation from conversation | Partially implemented (whitelist module chips, no typed contract, no downstream effect) | `qPublicConcierge.ts:47-60,109-125` |
| Create business/tenant | Partially implemented (admin CRUD + onboarding side effect; no owner-facing endpoint) | `admin.ts:415-445`, `tenant.ts:18-35`, `auth.ts:163-164` |
| Select workspace template | Partially implemented (segment list + `workspacePaths`; restaurant-only enforcement; no template catalog) | `user.ts:12-41,79-131`; `business.ts:163` |
| Enable/activate modules | **Implemented, production-backed** (restaurant only) | `business.ts:161-196`, `businessModules.ts:15-27`, `schema.ts:395-406` |
| Initial config / seeding per new workspace | **Missing** (no provisioning hook; `seed.ts` is demo-tenant only) | — |
| Multiple locations | **Missing** (no location/branch/outlet table or route) | `schema.ts` (30 tables, none location-related) |
| Owner assignment | Implemented (side effect of onboarding/login; `businesses.owner_user_id`) | `schema.ts:351`, `user.ts:110-128`, `businessOwnership.ts` |
| Destination route returned by backend | Partially implemented (`primaryWorkspace` returned by verify/profile; admin create returns none) | `user.ts:29-41,127`, `auth.ts:240` |
| Module/workspace registry (canonical) | Backend: `restaurantModulePolicies` (`businessModules.ts:15-27`), `segments`+`workspacePaths` (`user.ts:12-41`). Frontend-only: `moduleRegistry.ts:47-90`, `verticals/index.ts:9-16` | Partially implemented |
| Tool-calling / action execution framework | **Missing** (drafts only, `dispatched:false`) | `restaurant.ts:1454` |

---

## 7. Can Q Currently Create a Workspace?

**No.** There is no API — user-facing or internal — that creates + configures a workspace from a conversation. Business creation is an admin CRUD row (`admin.ts:415-445`) or an implicit onboarding side effect (`tenant.ts:18-35`). The concierge's recommendation never leaves the browser and is deleted before any provisioning decision could consume it (`BusinessTypeView.tsx:82`). Module activation is real but manual, restaurant-only, and unreachable by Q (no tool-calling framework exists). Per-workspace config seeding and multi-location support do not exist.

---

## 8. Can Q Currently Navigate to the Correct Workspace?

**Partially supported** (see §4). The frontend can route a post-onboarding user to `primaryWorkspace`/segment destinations, and the backend does return a destination (`primaryWorkspace`). But Q's own recommendation has no binding to that destination: segment selection is manual, the brief is discarded, and there is no validated-destination mechanism — navigation targets are computed from client-cached user fields, not from a trusted orchestration result.

---

## 9. Security and Approval Boundaries (M7)

### Existing controls that must be preserved (verified)

- OTP + JWT auth (`auth.ts`, `middleware/auth.ts`) — HMAC-hashed codes, attempt lockout, HS256 24-h tokens.
- Tenant scoping — `businessId` from JWT only; every tenant query filtered; route-like `businessId` rejected/repaired (`middleware/auth.ts:43-45`, `auth.ts:204-211`).
- Role enforcement — `requireRole` (`auth.ts:75-90`), `canUseQ` / `canReviewQDraft` (`restaurant.ts:844-850`), `RestaurantAccessGuard`.
- Q model containment — advice-only prompts, model output never writes structured state (`qPublicConcierge.ts:229-250`), drafts never dispatched (`restaurant.ts:1454`), budget/kill-switch gating (`qProviderConfig.ts`).
- Audit logging on all Q and module mutations.

### Proposed action classification (to enforce in the orchestration layer)

**Read-only (no approval):** explain, recommend, summarize, inspect allowed workspace information — maps to existing `GET /business-pulse`, `GET /q/*` patterns.

**Owner approval required (typed intent + explicit confirmation, server-enforced):** create workspace, enable modules, invite users, change roles, create supplier/customer actions, send messages, change financial settings, execute payments.

**Never allowed from untrusted model output:** arbitrary route navigation, tenant assignment, role escalation, auth changes, payment execution, data deletion, cross-tenant access. The model may only propose a typed intent; a deterministic backend validator (allowlist + module registry + role check + audit log) decides whether it executes.

---

## 10. Smallest Viable Technical Architecture (M5)

Evidence-based, built on what already exists; the model never invents or executes routes.

```
GuestQConcierge / Q Chat
   │  POST message (existing pattern)
   ▼
Backend Q service (rules + optional LLM)            ← existing: qPublicConcierge.ts / qModel.ts
   │  emits TYPED recommendation only (model text is advisory; structure from deterministic layer)
   ▼
QRecommendation contract
{
  "intent": "create_workspace",
  "businessType": "restaurant",
  "recommendedTemplate": "restaurant",
  "recommendedModules": ["pos","kds","menu","tables"],
  "requiresApproval": true
}
   │  rendered as an approval card; owner confirms or corrects   ← new UI step
   ▼
POST /api/q/workspace-orchestration   ← NEW trusted endpoint (auth + role + audit)
   │  validates: intent enum, template ∈ workspacePaths/segments (user.ts:12-41),
   │  modules ∈ restaurantModulePolicies (businessModules.ts:15-27),
   │  destination ∈ internal route allowlist
   ▼
Trusted executor reuses EXISTING primitives — no new write semantics:
   • ensureBusinessRecord / ensureUserBusiness   (tenant.ts:18-54)
   • PUT /user/profile logic (segment + primaryWorkspace + business name)  (user.ts:79-143)
   • business_modules upserts                     (business.ts:173-196)
   • q_business_memories insert (carry concierge context into workspace)  (schema.ts:451-462)
   ▼
QOrchestrationResult
{
  "success": true,
  "businessId": "biz_<uuid>",          // from server/JWT — never from the model
  "workspace": "restaurant",
  "destination": "/app/restaurant"     // allowlist-validated, e.g. ^/app/(restaurant|personal|retail)(/…)?$
}
   ▼
Frontend navigates to result.destination (and only allowlisted values)
   ▼
Q continues onboarding inside the workspace — concierge context already
persisted server-side into q_business_memories / first assistant conversation
```

Key properties:

1. **Model output is never trusted.** The LLM contributes prose; the typed recommendation is assembled by the deterministic layer (the pattern already proven in `qPublicConcierge.ts:229-250`).
2. **No new persistence semantics.** Executor composes existing, audited write paths.
3. **Destination allowlist** derives from the backend registries (`workspacePaths`, `restaurantModulePolicies`), eliminating the current frontend/backend mapping duplication (`SubSegmentView.tsx` vs `user.ts:29-41`) as a drift source for Q-driven flows.
4. **Context continuity** is solved by persisting the guest brief server-side (new: brief attached at orchestration time; owner memory record created), instead of the current sessionStorage-then-delete flow.

---

## 11. Missing Capabilities (blocking Q orchestration)

1. **Server-side guest brief persistence** — brief never reaches the backend; deleted unread (`BusinessTypeView.tsx:82`).
2. **Typed recommendation contract** — recommendations are UI chips, not a validated structure.
3. **Trusted orchestration endpoint** — no single "create + configure workspace" API; creation is admin-only or implicit.
4. **Destination allowlist / route validator** — destinations today are client-computed from cached user fields.
5. **Owner approval step** — no UI or server pattern for intent confirmation before mutation (draft approvals are the closest precedent, `restaurant.ts:1419-1454`).
6. **Per-workspace config seeding** — new businesses get no default modules/settings rows (lazy creation on first PATCH only).
7. **Module activation beyond restaurant** — `GET /business/modules` 400s for other workspaces (`business.ts:163`).
8. **Conversation handoff** — no link between concierge context and workspace Q assistant; authenticated chat starts blank.
9. **Multi-location model** — absent from schema entirely.
10. **Onboarding name persistence** — `UpdateProfileInput` lacks `name`.
11. **Personal OS reachability** — `userType:'personal'` never set in frontend.
12. **In-memory guest rate limiting** — not multi-instance safe (`qPublicConcierge.ts:26-45`).

---

## 12. Recommended Implementation Milestones

| Milestone | Scope | Depends on |
|---|---|---|
| **A1 — Contract & registry foundation** | Shared TS types for `QRecommendation`/`QOrchestrationResult`; backend destination allowlist + validator module; verification script. No routes, no LLM changes | None |
| **A2 — Guest brief server persistence** | Endpoint to store the concierge brief (or attach at verify); remove the sessionStorage-delete flow; prefill + preselect segment in onboarding from the brief | A1 |
| **A3 — Approval UX + orchestration endpoint** | `POST /api/q/workspace-orchestration` composing existing primitives; approval card in concierge/onboarding; audit logging | A1, A2 |
| **A4 — Validated navigation + handoff** | Frontend navigates only from allowlisted `destination`; concierge context seeded into `q_business_memories` + first workspace conversation | A3 |
| **A5 — Continued onboarding in workspace** | Q assistant onboarding checklist inside the target workspace using persisted context | A4 |
| **Deferred** | Multi-location, non-restaurant module activation, workspace switching API, name persistence fix, personal-os onboarding path | Product decision |

Each milestone ships behind the existing authz controls; none touches OTP/JWT/tenant middleware, DB schema (A2/A4 may add columns only after review), deployment, or production route behavior for existing users.

---

## 13. Exact First Implementation Task

**A1: Create the typed orchestration contract and destination allowlist validator — backend-only, no behavior change.**

- Add `backend/src/services/qOrchestration.ts` exporting:
  - `QRecommendation` / `QOrchestrationResult` types (as in §10);
  - `ALLOWED_DESTINATIONS` derived from `workspacePaths` (`backend/src/routes/user.ts:29-41`) and active workspace routes;
  - `validateRecommendation(input): QRecommendation` — clamps `businessType`/`recommendedTemplate` to the segment registry, `recommendedModules` to `restaurantModulePolicies` (`backend/src/services/businessModules.ts:15-27`), forces `requiresApproval: true`;
  - `validateDestination(dest): string | null` — returns the destination only if allowlisted, else `null`.
- Add `backend/src/scripts/verify_q_orchestration_contract.ts` covering: valid restaurant recommendation passes; unknown template rejected; unknown module dropped; model-shaped garbage (`{"destination":"javascript:…"}`, `/admin/users`, cross-tenant IDs) rejected; `requiresApproval` cannot be false.
- Run existing verification scripts to confirm zero regressions.

**Then stop for architectural review** before A2 touches any request path.

---

*Discovery performed read-only in worktree `D:\VS CODE App\Q360-q-agent-orchestration`. The original working tree (`security/authz-evidence-baseline`, dirty with Security/Landing/design work) was not modified. Nothing committed or pushed.*
