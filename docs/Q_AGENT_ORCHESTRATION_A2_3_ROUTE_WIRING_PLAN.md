# A2.3 — Guest Brief Route Wiring Plan (Architecture Only)

**Branch:** `feature/q-agent-orchestration` · **Date:** 2026-07-19 · **Status:** PLAN ONLY — uncommitted. No routes, auth, or frontend changes implemented.
Depends on: A1 (`37ce8de`), A2.1 (`021f304`), A2.2 Slice 1 (`8241b23`).

---

## 1. Route surface

| # | Method + path | Auth | Purpose |
|---|---|---|---|
| 1 | `POST /api/public/q-concierge/brief` | public | **Create** a guest brief from a validated recommendation. Separate from the existing chat endpoint so brief creation is explicit, rate-limitable, and feature-flagged |
| 2 | `POST /api/q/guest-brief/claim` | JWT | **Claim** with `{ briefToken }` — the only endpoint that ever accepts a raw token |
| 3 | `GET /api/q/guest-brief/current` | JWT | **Retrieve** the caller's current claimed/confirmed brief (identity-based) |
| 4 | `POST /api/q/guest-brief/confirm` | JWT | **Confirm** approved prefill fields `{ acceptedFields: string[] }` |
| 5 | `POST /api/q/guest-brief/dismiss` | JWT | **Dismiss** the unresolved brief |
| — | *(consume)* | — | **Internal only (R4).** No public consume endpoint; the future approved-field application workflow calls `consumeGuestBrief` in-process after fields are applied |

Alternative considered: extending the existing `POST /api/public/q-concierge` response with `briefToken`. Rejected for A2.3 — a dedicated creation endpoint keeps the chat contract stable and gives the feature flag a single choke point. The concierge frontend change (call create when `readyForSignIn`) lands in A2.4.

## 2. Authentication boundaries

- **Create** (`/api/public/...`): unauthenticated, like the existing concierge (`backend/src/routes/public.ts` pattern, `visitorKey` rate-limit context).
- **Claim / retrieve / confirm / dismiss**: `authMiddleware`; `userId` comes from the verified JWT (`c.get('userId')`) — never from the request body.
- **`/api/auth/login` and `/api/auth/verify` are not modified.** Authentication remains independently successful (A2 rev.2 invariant).
- **Frontend sequencing without coupling OTP to brief storage:** the concierge hands `briefToken` to the login view (sessionStorage, replacing `q360_guest_setup` payload storage in A2.4). After `verifyOtp` resolves, the client fires `claim` as a **separate, awaited-but-non-blocking request**: success → summary card / onboarding preselect; any failure (expired, conflict, store down) → the user proceeds exactly as today with no brief. The claim call is idempotent-safe to retry, and a failed claim never triggers logout or blocks navigation. OTP correctness and token issuance never reference brief state.

## 3. Token handling

- Raw token accepted **only** at `POST …/claim` (and implicitly at create, where the server generates it).
- `isBriefTokenShape` runs **before any DB access** at both endpoints (A2.1 fail-closed primitives) — malformed input returns `invalid_token` without touching storage.
- After a successful claim the raw token is dead: retrieval/confirm/dismiss resolve by `claimed_by_user_id` from the JWT.
- The raw token is returned to the client **exactly once** (create response), is never placed in URLs (body + sessionStorage transport only), and must not appear in logs, audit details, or analytics. Implementation note for route code: no request-body logging on brief endpoints; structured log lines reference `briefId` only.
- Server stores only `token_hash` (HMAC, env-injected secret at the route composition root — the service itself stays env-free).

## 4. Rate limiting

**Constraint:** no new unbounded in-memory limiter. The existing concierge limiter (`qPublicConcierge.ts:26-45`, per-process `Map`) is the known temporary pattern — acceptable for single-instance staging, **not** production-grade (multi-instance resets/bypass).

| Layer | Create | Claim | Confirm/dismiss/retrieve |
|---|---|---|---|
| Temporary (staging) | 5 per visitor-IP/hour, reusing the concierge limiter shape **with a hard cap on tracked keys** (e.g. 10k entries, LRU evict) to bound memory | 10 per user+IP/hour, same bounded structure | 10 per user/hour |
| Production-grade | Shared store (DB-backed counters or Redis) so limits hold across instances; or edge/CDN rate limiting | Same | Same |

- **Abuse behavior:** over-limit → deterministic `429` with `retryAfterSeconds` and a typed code `rate_limited`; no payload echoes; repeated claim-failures for one user surface in observability (§5) rather than stricter silent drops.
- Abuse responses must not reveal whether a token exists: claim failures return the same generic `brief_not_found` for unknown vs foreign tokens (no oracle).

## 5. Audit and observability

- **Do not force pre-tenant events into tenant-scoped `audit_logs`** (`businessId`/`userId` are `notNull` there — A2.2 deviation already documented).
- **Unauthenticated events** (brief created, claim failures, rate-limit hits): write to a lightweight, payload-free server log/telemetry channel — proposal: reuse the service's `onEvent` hook with a route-layer subscriber that (a) structured-logs `{ event, briefId, visitorKeyHash? }` and (b) increments counters. No `audit_logs` writes pre-auth.
- **Post-auth events** (`claimed`, `confirmed`, `consumed`, `dismissed`, `claim_conflict` with a real userId): once a legitimate `userId` exists, these **may** enter `audit_logs` — but `businessId` is still notNull. **Open decision D1:** either (a) write with the user's JWT `businessId` (briefs are pre-workspace, so this is the user's default/legacy tenant — semantically wrong), or (b) keep brief events out of `audit_logs` entirely until A3 tenancy exists and use the telemetry channel only. **Lean: (b).**
- All event metadata remains **payload-free and token-free** (A2.2 already enforces this shape; route layer must not add request bodies to logs).

## 6. HTTP semantics (deterministic mapping)

| Outcome | HTTP | Body code |
|---|---|---|
| create success | 201 | `{ briefToken, activeExpiresAt }` |
| claim success (new) | 200 | `{ state: 'claimed', brief }` |
| claim retry (same user) | 200 | `{ state, brief }` (`outcome: 'already_claimed'`) |
| `invalid_token` | 400 | typed code |
| `brief_not_found` (unknown **or** foreign token) | 404 | typed code (uniform — no existence oracle) |
| `expired` | 410 | typed code |
| `conflict` (claimed by another user / terminal / lost race) | 409 | `brief_conflict` |
| `unresolved_exists` | 409 | `brief_unresolved_exists` |
| `payload_invalid` | 422 | typed code |
| `invalid_state` / `invalid_fields` | 409 / 422 | typed code |
| unauthenticated on protected endpoint | 401 | `unauthorized` |
| authenticated but not permitted (reserved) | 403 | `forbidden` |
| over limit | 429 | `rate_limited` + `retryAfterSeconds` |
| feature flag off | 404 | route not mounted (fail-closed, invisible) |

## 7. Idempotency

- **Create:** not idempotent by nature (each call mints a new token); bounded by rate limit + one-active-brief-per-visitor-context replacement being deliberately absent in A2.2 (R3 — no visitor-based decisions). Retrying create is harmless but rate-limited.
- **Same-user claim retry:** idempotent at the service layer (returns current brief, zero side effects) — safe for client retries and double-clicks. No client-supplied idempotency key needed because the token itself is the natural key and the claim is a CAS.
- **Confirm retry:** second confirm on an already-`confirmed` brief → `invalid_state` (409). Clients retrying after a timeout may see this; acceptable because the desired end-state is observable via `GET …/current`. **Open decision D2:** alternatively make confirm idempotent when `acceptedFields` match the stored set. Lean: keep 409, client reads current state.
- **Dismiss retry:** second dismiss → `invalid_state`; same rationale.
- **Explicit idempotency keys:** not needed for A2.3 — every mutating operation has a natural unique key (token hash or user identity) and a conditional transition.

## 8. Privacy

- `visitorKeyHash`: optional telemetry only — never raw visitor key, never identity/authorization/retrieval/matching use (service structurally never queries it; A2.2 case 16 guards this).
- Payload minimization: the stored payload is the A2.1 contract — no transcript, no email, capped sizes, forbidden-field rejection at write and re-validation at claim/retrieval.
- Retention: active 60 min → claimed 7 days → confirmed 24 h → terminal metadata 30 days then delete/anonymize (A2.2 `terminalAt` drives the future sweep; lazy expiry already live).
- Responses never include `tokenHash`, `visitorKeyHash`, or other users' data.

## 9. Feature flag

- **Placement:** single choke point at route mounting in `backend/src/index.ts` (or the brief route module's registration): `if (process.env.Q_GUEST_BRIEF_ENABLED === 'true') app.route('/api/q/guest-brief', …)` plus the same gate on the public create endpoint. Precedent: `Q_AI_EXTERNAL_ENABLED` kill-switch (`qProviderConfig.ts`).
- **Fail-closed:** any value other than explicit `'true'` → routes not mounted → 404, no code path reachable, no DB writes possible.
- Flag stays **off** everywhere until route verification (§10) and frontend integration (A2.4) are approved.

## 10. Verification plan

New staging-guarded `verify:q-guest-brief-routes` (Hono `app.request` pattern from `verify_business_modules.ts`, JWT minted in-script):

1. **Route contract:** every endpoint's happy path + the §6 status/code matrix.
2. **Auth boundary:** each protected endpoint without JWT → 401; with another user's JWT → no cross-access; `/api/auth/verify` source untouched (textual guard) and login flow test from existing verify suites stays green.
3. **Malformed-token pre-DB proof:** invalid token to claim/create returns 400 and row counts are unchanged.
4. **Race/concurrency claim proof:** two parallel `app.request` claims with the same token → exactly one 200-`claimed`, one 409; no duplicate side effects (event count check).
5. **Rate-limit proof:** exceed create and claim thresholds → deterministic 429 + `retryAfterSeconds`; counter resets after window.
6. **No-token-in-logs proof:** capture logger output during the full flow → assert raw token and payload fields absent.
7. **Login independence with brief storage down:** point the brief routes at a failing DB handle (or disable flag) → OTP verify + login succeed unchanged.
8. **Flag-off proof:** with flag unset → all brief routes 404.
9. **Regressions:** A2.2 (16), A2.1 (22), A1 (22) all green.

## 11. Files likely to change (NOT modified now)

| File | Change |
|---|---|
| `backend/src/routes/qGuestBrief.ts` | new — protected endpoints |
| `backend/src/routes/public.ts` | add `POST /brief` (or a new `publicGuestBrief.ts` mounted alongside) |
| `backend/src/index.ts` | mount brief routes behind the feature flag |
| `backend/src/services/qGuestBriefService.ts` | none expected; possibly expose event subscriber typing only |
| `backend/src/services/qPublicConcierge.ts` | none in A2.3 (concierge chat unchanged) |
| `backend/src/scripts/verify_q_guest_brief_routes.ts` | new — §10 |
| `backend/package.json` | register verify script |
| `backend/.env.example` (if present) | document `Q_GUEST_BRIEF_ENABLED`, `Q_GUEST_BRIEF_TOKEN_SECRET` |

Explicitly untouched: `routes/auth.ts`, `middleware/auth.ts`, all frontend files, OTP storage, `GuestQConcierge.tsx`, `LandingView.tsx`.

## 12. Rollout and rollback

1. **Staging first:** schema already pushed (A2.2); deploy routes with flag off; run §10 verification; enable flag on staging; smoke-test the handoff manually.
2. **Production prerequisite:** one-time additive `db:push` of `q_guest_briefs` (already reviewed in A2.2) + env vars (`Q_GUEST_BRIEF_TOKEN_SECRET` ≥ 32 bytes, flag off initially).
3. **Enable:** flag on for internal testers, then general.
4. **Rollback:** flag off → routes 404 instantly, zero data impact; auth and onboarding never touched, so rollback cannot damage them. Deeper rollback (drop table) is safe because nothing references it; not required for ordinary disable.

## Unresolved decisions requiring architectural approval

- **D1 (§5):** keep brief events out of tenant-scoped `audit_logs` until A3 (lean: yes) vs writing with the JWT's default tenant.
- **D2 (§7):** confirm/dismiss retry semantics — strict 409 + client reads `GET …/current` (lean) vs idempotent-on-same-input.
- **D3 (§4):** production-grade rate-limit store choice (DB counters vs Redis vs edge) — needed before production enablement, not for staging.
- **D4 (§1):** dedicated `POST /api/public/q-concierge/brief` (lean) vs extending the chat endpoint's response.
- **D5:** `Q_GUEST_BRIEF_TOKEN_SECRET` provisioning/rotation story for production (staging can reuse a generated secret).

---

*Plan only. Uncommitted. Stop for architectural review.*
