# A2.2 — Guest Brief Schema & Service Plan (Architecture Only)

**Branch:** `feature/q-agent-orchestration` · **Date:** 2026-07-19 · **Status:** PLAN ONLY — uncommitted. No schema, routes, or service code implemented.
Depends on: A1 (`37ce8de`), A2.1 (`021f304`), A2 design rev. 2 (`Q_AGENT_ORCHESTRATION_A2_HANDOFF_DESIGN.md`, uncommitted).

**Provisional decisions (approved for planning):** active expiry 60 min · claimed retention 7 days · confirmed completion window 24 h · terminal metadata retention 30 days then delete/anonymize · continue-conversation display-only in A2 · consume only after approved fields are successfully applied · visitor key non-authoritative, stored only as a derived hash · one unresolved claimed/confirmed brief per user · second claim → deterministic conflict · rate limits: create 5/visitor-IP/h, claim 10/user+IP/h, confirm/dismiss 10/user/h.

---

## 1. Table fields and indexes

```ts
// backend/src/db/schema.ts — additive only; no existing table changes
export const qGuestBriefs = pgTable('q_guest_briefs', {
    id:               text('id').primaryKey(),                    // 'gbr_' + uuid
    tokenHash:        text('token_hash').notNull(),               // HMAC-SHA256(raw token, server secret) — raw token never stored
    state:            text('state').notNull(),                    -- active|claimed|confirmed|consumed|expired|dismissed|revoked
    payload:          jsonb('payload').notNull(),                 // QGuestBriefPayload v1 (A2.1-validated)
    visitorKeyHash:   text('visitor_key_hash'),                   // derived hash only; non-authoritative context
    createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    activeExpiresAt:  timestamp('active_expires_at', { withTimezone: true }).notNull(),  // createdAt + 60 min
    claimedByUserId:  text('claimed_by_user_id'),                 // references users.id; NULL while active
    claimedAt:        timestamp('claimed_at', { withTimezone: true }),
    confirmedAt:      timestamp('confirmed_at', { withTimezone: true }),
    confirmedFields:  jsonb('confirmed_fields'),                  // subset of prefill keys the owner accepted
    stateUpdatedAt:   timestamp('state_updated_at', { withTimezone: true }).notNull().defaultNow(),
    terminalAt:       timestamp('terminal_at', { withTimezone: true }),  // set on consumed/expired/dismissed/revoked; drives 30-day cleanup
});
```

Indexes:
- `uq_q_guest_briefs_token_hash` UNIQUE(`token_hash`) — claim lookup; uniqueness also prevents double-minting collisions.
- `ix_q_guest_briefs_claimed_user_state` (`claimed_by_user_id`, `state`) — authenticated retrieval + one-unresolved-brief enforcement.
- `ix_q_guest_briefs_state_active_expiry` (`state`, `active_expires_at`) — expiry sweep.
- `ix_q_guest_briefs_terminal_at` (`terminal_at`) — 30-day cleanup sweep.

No FK cascade into tenant tables; `claimed_by_user_id` references `users.id` only (brief is pre-tenant by design).

## 2. Lifecycle constraints

- `active → claimed` only via the atomic claim transaction (§3).
- `claimed → confirmed` only via owner confirm; `confirmedFields` ⊆ `payload.prefill` keys, recorded at confirm.
- `confirmed → consumed` only after approved fields are successfully applied (per provisional decision — consume is the last step, idempotent).
- `active → expired` when `now() > active_expires_at` (lazy or sweep).
- `claimed → expired` after claimed retention (claimedAt + 7 days) without confirm.
- `confirmed → expired` after completion window (confirmedAt + 24 h) without consume.
- `claimed|confirmed → dismissed` via owner action.
- `active → revoked` when a newer brief replaces it for the same visitor context, or by security action.
- All other transitions rejected with typed `brief_invalid_state`. Enforced in the service layer with conditional UPDATEs (state in WHERE clause), not by reading-then-writing.

## 3. Atomic claim transaction

```
POST /api/q/guest-brief/claim   (authMiddleware; body { briefToken })
1. tokenHash = hashBriefToken(briefToken, env-injected secret)   // A2.1 fails closed on malformed
2. db.transaction:
   a. row = SELECT … WHERE token_hash FOR UPDATE
      - not found          → 404 typed 'brief_invalid'  (generic; no oracle between invalid/expired/foreign)
      - state='claimed' and claimed_by_user_id = caller → 200 idempotent replay of own claim (returns current brief)
      - state≠'active'     → 409 typed 'brief_conflict'  (deterministic; covers second claim by anyone)
      - now() > active_expires_at → set state='expired', terminalAt=now() → 410 typed 'brief_expired'
   b. unresolved = SELECT … WHERE claimed_by_user_id = caller AND state IN ('claimed','confirmed') LIMIT 1
      - exists → 409 typed 'brief_unresolved_exists' (one unresolved brief per user; no overwrite)
   c. UPDATE … SET state='claimed', claimed_by_user_id=caller, claimed_at=now(), state_updated_at=now()
      WHERE id AND state='active' AND active_expires_at > now()
      - 0 rows → treat as conflict (concurrent claim lost the race) → 409 'brief_conflict'
3. Re-validate row.payload via A2.1 validateGuestBriefPayload (registry-drift defense) → on failure: state='revoked', typed 'brief_payload_invalid'
4. audit Q_GUEST_BRIEF_CLAIMED { briefId, userId } — no payload, no token
```

The raw token is dead after step 2c; it is never accepted by any other endpoint.

## 4. Authenticated retrieval

```
GET /api/q/guest-brief/current   (authMiddleware)
- SELECT … WHERE claimed_by_user_id = jwt.sub AND state IN ('claimed','confirmed')
- Re-validate payload (A2.1) before returning.
- Returns { state, payload, claimedAt, confirmedAt?, expiresAt } — never tokenHash, visitorKeyHash, or other users' data.
- 404 typed 'brief_none' when none — a normal state, not an error for the client.
```

Retrieval is by user identity only; the original token is unusable here (per security rule).

## 5. Confirm / dismiss / consume / expire transitions

| Endpoint / process | Transition | Guard |
|---|---|---|
| `POST /api/q/guest-brief/confirm` body `{ acceptedFields: string[] }` | `claimed → confirmed` | conditional UPDATE `WHERE id AND claimed_by_user_id=caller AND state='claimed'`; `acceptedFields` validated ⊆ payload.prefill keys; sets `confirmedAt`, `confirmedFields` |
| `POST /api/q/guest-brief/dismiss` | `claimed|confirmed → dismissed` | same ownership pattern; sets `terminalAt` |
| `POST /api/q/guest-brief/consume` (called by onboarding apply flow after fields persist) | `confirmed → consumed` | only after the approved fields were **successfully applied** via the existing profile write; within the 24-h window; conditional UPDATE; sets `terminalAt`. Idempotent: repeat consume on `consumed` returns 200 |
| Expiry sweep | `active → expired` (past `active_expires_at`); `claimed → expired` (claimedAt + 7 d); `confirmed → expired` (confirmedAt + 24 h) | lazy on access + periodic sweep; sets `terminalAt` |

Every transition writes `state_updated_at` and emits its audit event.

## 6. Concurrency behavior

- Claim race (two sessions, same token): row `FOR UPDATE` + conditional UPDATE → exactly one winner; loser gets deterministic 409 `brief_conflict`.
- Second brief while one unresolved: 409 `brief_unresolved_exists`; user must confirm/dismiss/consume first.
- Confirm/consume races: conditional UPDATEs with `state=` in WHERE; losers get `brief_invalid_state`.
- Self-replay of a completed claim by the same user: idempotent 200 (safe for client retries).
- No read-modify-write outside transactions; no optimistic UI assumptions required.

## 7. Cleanup process

- **Lazy:** any access to an expired-but-unmarked row transitions it to `expired` first (same pattern as OTP expiry handling).
- **Sweep** (script, existing `tsx` conventions; later a scheduled job): transition due rows to `expired`; delete or anonymize rows with `terminal_at < now() - 30 days`. Anonymize = delete payload + visitorKeyHash, keep id/state/timestamps for metrics.
- Rate-limit tables: none new — reuse the per-route limiter pattern; note the known in-memory multi-instance limitation (documented in discovery) applies to the suggested rate limits.

## 8. Audit events (payload-free)

| Event | Fields recorded | Never recorded |
|---|---|---|
| `Q_GUEST_BRIEF_CREATED` | briefId, visitorKeyHash, expiry | token, payload |
| `Q_GUEST_BRIEF_CLAIMED` | briefId, userId | token, tokenHash, payload |
| `Q_GUEST_BRIEF_CLAIM_CONFLICT` | briefId, userId, reason code | token |
| `Q_GUEST_BRIEF_CONFIRMED` | briefId, userId, acceptedFields | payload contents |
| `Q_GUEST_BRIEF_CONSUMED` / `_DISMISSED` / `_EXPIRED` / `_REVOKED` | briefId, userId?, state | payload |
| `Q_GUEST_BRIEF_REPLAY_ATTEMPT` | briefId, userId | token |

Route code comments must prohibit request-body logging on brief endpoints.

## 9. Exact routes proposed (A2.3 wiring; nothing here is implemented)

| Method + path | Auth | Body → Result |
|---|---|---|
| `POST /api/public/q-concierge` (existing, extended) | public + visitor rate limit (5/h) | response gains `briefToken?` when `readyForSignIn` |
| `POST /api/q/guest-brief/claim` | JWT (10/user+IP/h) | `{ briefToken }` → `{ state:'claimed' }` or typed failure |
| `GET /api/q/guest-brief/current` | JWT | → `{ state, payload, … }` or 404 `brief_none` |
| `POST /api/q/guest-brief/confirm` | JWT (10/user/h) | `{ acceptedFields[] }` → `{ state:'confirmed' }` |
| `POST /api/q/guest-brief/dismiss` | JWT (10/user/h) | → `{ state:'dismissed' }` |
| `POST /api/q/guest-brief/consume` | JWT (internal: onboarding apply) | → `{ state:'consumed' }`, idempotent |

`/api/auth/verify` is **not** modified (authentication independence).

## 10. Migration and rollback strategy

- Migration: single additive `pgTable` via the project's drizzle flow (`db:push` after review); no existing tables/columns touched; no data backfill.
- Rollback: drop table `q_guest_briefs` + remove routes (feature is additive; no dependent writes exist elsewhere). The concierge works unchanged if brief creation is disabled behind an env flag (`Q_GUEST_BRIEF_ENABLED`, default off until A2.4 ships) — kill-switch precedent exists (`Q_AI_EXTERNAL_ENABLED`).
- Forward compatibility: payload is versioned (`version: 1`); future versions add new validators, never mutate stored v1 semantics.

## 11. Verification plan

New `verify:q-guest-brief-service` (staging-guarded like `verify:business-modules`):
1. create → claim happy path; token absent from all responses/audit rows.
2. claim with malformed token → fail-closed rejection (A2.1).
3. double claim (same user, other user) → deterministic 409 conflict; same-user retry → idempotent 200.
4. claim while unresolved brief exists → 409 `brief_unresolved_exists`.
5. expired active brief → 410 + row transitioned.
6. retrieval by identity; other user cannot see the brief (cross-tenant/user isolation).
7. confirm with fields ∉ prefill → rejection; confirm → consume happy path; consume twice → idempotent.
8. dismiss from claimed and from confirmed.
9. claimed-retention and confirmed-window expiry transitions.
10. rate-limit behavior at the suggested thresholds (or documented deferral).
11. cleanup: terminal rows older than 30 days deleted/anonymized.
12. login-independence proof: OTP verify succeeds with brief store unreachable (mock/stub).

## 12. Exact first A2.2 implementation slice

**Slice 1 — schema + service core, no routes:**
1. Add `qGuestBriefs` table to `backend/src/db/schema.ts` (additive).
2. New `backend/src/services/qGuestBriefService.ts`: `createBrief`, `claimBrief` (atomic transaction §3), `getCurrentBriefForUser`, `transitionBrief` (confirm/dismiss/consume with conditional UPDATEs), `expireDueBriefs` — all emitting payload-free audit events; secret injected; rate limiting left to route layer.
3. `verify:q-guest-brief-service` covering §11 cases 1–9 (staging-guarded).
Then stop for review before any route wiring (A2.3).

## Unresolved risks requiring architectural approval

- **R1 — Schema change approval** itself (first additive table in this workstream; needs the standard migration review).
- **R2 — Rate-limit storage:** suggested thresholds assume per-process limiters; multi-instance deployments need a shared store or documented acceptance (existing known limitation).
- **R3 — `visitorKeyHash` telemetry retention:** 30-day terminal retention includes this derived hash; privacy sign-off needed.
- **R4 — Consume caller identity:** consume is triggered by the onboarding apply flow; whether that is a user-facing endpoint or an internal service call affects the route surface (lean: internal service call, not a public route — route table above lists it for completeness).
- **R5 — Idempotent self-replay of claim** returns the current brief payload; confirm this does not violate the "single successful claim" intent (it does not re-execute the transition).
- **R6 — Cleanup scheduling mechanism** (script vs scheduled job) is undecided; A2.2 slice 1 ships lazy expiry only.

---

*Plan only. Uncommitted. Stop for architectural review.*
