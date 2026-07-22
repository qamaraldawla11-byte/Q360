# A2 — Guest-to-Authenticated Q Handoff: Architecture & Design

**Branch:** `feature/q-agent-orchestration` · **Worktree:** `D:\VS CODE App\Q360-q-agent-orchestration`
**Date:** 2026-07-19 (rev. 2 — claim-boundary correction) · **Status:** DESIGN ONLY. This document is intentionally **uncommitted**. No push.

Baseline: A1 contract layer (commit `37ce8de`), A2.1 pure guest-brief contract (`backend/src/services/qGuestBrief.ts`), discovery report (uncommitted).

**Rev. 2 corrections incorporated:** (1) brief claiming is a **dedicated authenticated boundary**, never inside `/api/auth/verify` — authentication is independently successful regardless of brief state; (2) explicit lifecycle `active → claimed → confirmed → consumed` with terminal `expired / dismissed / revoked`; (3) `visitorKey` is non-authoritative context only; (4)(5) revised existing/new-user behavior; (6) security invariants restated.

---

## 1. Current handoff behavior

Verified in discovery:

- Guest concierge → `sessionStorage['q360_guest_setup']` + router state (`LandingView.tsx:495-498`).
- Login consumes only the **email** (`LoginView.tsx:20-34`).
- Final onboarding step prefills `businessName`/`country` then **deletes the brief unread** (`BusinessTypeView.tsx:82`).
- The backend never receives the brief: no validation, expiry, single-use, or audit.

## 2. Requirements

| # | Requirement |
|---|---|
| R1 | Surviving artifact: A2.1 `QGuestBriefPayload` (validated recommendation + concise summary + approved prefill candidates + bounded answers). Raw transcript does **not** survive |
| R2 | Authentication independence: OTP verify, token issuance, and login never depend on brief presence or state |
| R3 | Claim boundary: a **dedicated authenticated endpoint** binds the brief after login; separate request, separate transaction |
| R4 | Lifecycle: `active → claimed → confirmed → consumed`; terminal `expired / dismissed / revoked`. Never "consumed because login succeeded" |
| R5 | Single successful claim; replay/concurrent claim returns a typed failure |
| R6 | Active-token expiry 60 minutes (anonymous window); claimed-brief retention is a separate policy (§12, open question Q1) |
| R7 | `visitorKey` is context only: replacement hints, abuse control, telemetry. Never ownership, never authorization, never tenant selection, never binding |
| R8 | Sensitive data: token never in URLs/logs; only derived token hash persisted; payload caps per A2.1 |
| R9 | Existing users: informational summary only — no automatic change to `primaryWorkspace`, `businessId`, modules, tenant config, or onboarding state |
| R10 | New users: validated preselect/prefill shown; explicit owner confirmation before any field is applied; no workspace creation or orchestration in A2 |

## 3. Storage-option comparison

| Criterion | A. DB-backed brief record | B. Short-lived signed token | C. Temp cache + opaque ref | D. Current sessionStorage | **E. Hybrid (recommended)** |
|---|---|---|---|---|---|
| Confidentiality | High | Low–Med (payload in token) | High (while store lives) | Low | **High — only opaque token in browser** |
| Tamper resistance | High | High (integrity only) | High | None | **High** |
| Replay protection | **Yes — atomic claim** | No (stateless) | If store supports CAS | None | **Yes** |
| Expiry | Yes | Yes (`exp`) | Yes | No | **Yes** |
| Single-use (single claim) | **Yes** | No | Degraded | No | **Yes — `otp_codes` pattern (`auth.ts:150-157`)** |
| Cross-device | No — acceptable (portability is a theft vector) | Yes — a risk | No | No | **No, deliberately** |
| Logout/login behavior | Clean | Clean | Clean | Lossy | **Clean — claim is post-login** |
| Existing-user handling | Informational card possible | Possible | Possible | Never applied | **Informational card, explicit confirm/dismiss** |
| New-user handling | Preselect/prefill after confirm | Possible | Possible | Email-only | **Preselect/prefill + explicit confirmation** |
| Operational complexity | Med | Low–Med (key mgmt) | Med–High (no shared cache in stack) | None | Med |
| DB/schema impact | One additive table | None | None/new infra | None | **One additive table** |
| Cleanup | Lazy + sweep | None | TTL eviction | None | Lazy + sweep |
| Observability | Full (audit events) | Weak | Med | None | **Full** |
| Cost | Low | Lowest | Med | Zero | Low |
| Sensitive-info suitability | **Yes** | Only if encrypted | Yes | No | **Yes** |

**Decision: Option E**, unchanged from rev. 1. What changed is the **binding architecture** (§5): claim is its own authenticated transaction, not a side effect of authentication.

## 4. Threat model

| Threat | Mitigation |
|---|---|
| Token theft (XSS, extension) | 256-bit CSPRNG token; only HMAC-SHA256 hash persisted (A2.1 `toBriefTokenRecord`); 60-min active window; single claim; payload is a low-sensitivity recommendation, not tenant access |
| Link sharing | Token never in URLs; transported in JSON bodies + sessionStorage only; no shareable link exists by design |
| Replay | Atomic claim: `UPDATE … SET state='claimed', claimed_by_user_id … WHERE state='active' AND expires_at > now()`; second claim → typed `brief_already_claimed` |
| Browser storage theft | Only the opaque token is client-side; payload never touches browser storage |
| Altered recommendation payload | Payload is server-built and A1/A2.1-validated at write; **re-validated at claim and again at confirm** against current registries (registry-drift defense) |
| Account switching during login | Claim uses the authenticated `userId` from the request's JWT, never a client claim; a second account cannot claim an already-claimed brief |
| Anonymous→authenticated identity confusion | Binding happens only at the claim endpoint in one atomic operation; audit-logged; `visitorKey` never participates in identity (R7) |
| Stale recommendations | 60-min active expiry; revalidation at claim/confirm rejects recommendations that no longer match registries |
| Duplicate submissions | Single claim; one `active` brief per visitor context (new brief revokes the previous `active` one — a convenience hint only, not security) |
| Oversized/malicious descriptions | A2.1 caps: summary ≤ 2000, name ≤ 120, ≤ 12 answers × 500, total normalized ≤ 16 KB, control characters rejected |
| Sensitive data in URLs/logs | Token/payload never in query strings; audit events record ids + event type only; brief endpoints must not log request bodies (code-comment requirement) |
| Cross-tenant attachment | Brief structurally cannot carry `businessId`/tenant fields (A2.1 forbidden-field rejection); after claim, all tenant context comes from the JWT |
| CSRF-like handoff misuse | Claim is an authenticated POST requiring the session JWT (no ambient-cookie-only flow) plus the token in the body; an attacker needs both the victim's session and the token |
| Brief outage blocks login | **Authentication independence (R2):** verify/login never touch the brief store; claim is a separate request whose failure leaves the user fully logged in |

## 5. Recommended design (Option E, rev. 2)

```
GuestQConcierge (UI unchanged in A2)
   │  POST /api/public/q-concierge (existing)
   ▼
Server builds recommendation → A1 validateRecommendation
   │  on readyForSignIn, server ALSO persists the brief:
   ▼
q_guest_briefs row:  state='active', token_hash, payload (A2.1-validated),
                     expires_at(+60m), claimed_by_user_id NULL, confirmed_at NULL,
                     visitor_key (context only), created_at
   │  response carries { briefToken } exactly once
   ▼
Browser: sessionStorage['q360_brief_token']  (replaces payload-in-storage flow)
   │  navigate('/login') as today
   ▼
POST /api/auth/verify            ← UNCHANGED. No brief logic here.
   │  OTP → JWT. Login succeeds with or without any brief.
   ▼
POST /api/q/guest-brief/claim    ← NEW authenticated boundary (separate request/transaction)
   { briefToken }  +  Authorization: Bearer <jwt>
   │  hash(token) → lookup → ATOMIC claim:
   │     state='active' & unexpired → state='claimed', claimed_by_user_id = jwt.sub
   │     else typed failure: brief_expired | brief_already_claimed | brief_invalid
   │  token is now dead for anonymous use; audit Q_GUEST_BRIEF_CLAIMED
   ▼
GET /api/q/guest-brief/current   ← authenticated retrieval by USER IDENTITY (never by token)
   │  returns claimed brief payload (re-validated) for the summary card
   ▼
POST /api/q/guest-brief/confirm  ← owner explicitly accepts summary + prefill candidates
   │  state='claimed' → 'confirmed'  (records which prefill fields were accepted)
   ▼
Onboarding consumes confirmed fields → POST …/consume (or implicit at onboarding completion)
   │  state='confirmed' → 'consumed' — cannot be applied again
   ▼
Terminal alternatives at any point: dismissed (user declines), expired (TTL), revoked (security action).
```

**Failure isolation:** every brief endpoint failure (expired, malformed, replayed, missing, store unavailable) is contained to the brief flow. Login, token issuance, and onboarding access never depend on it.

## 6. Exact data contract

**Payload (A2.1, implemented):** `QGuestBriefPayload v1` — `{ version, businessSummary, recommendation, prefill{businessName?,country?,currency?}, answers[], clientMetadata }`, with A2.1 limits and forbidden-field rejection. No `businessId`, no routes, no approval timestamps, no raw transcript, no email (login already owns email).

**Database row (schema-backed alternative, §14):**
```
q_guest_briefs
  id                  text pk            -- 'gbr_' + uuid
  token_hash          text not null      -- HMAC-SHA256(raw token, server secret)
  state               text not null      -- active|claimed|confirmed|consumed|expired|dismissed|revoked
  payload             jsonb not null     -- QGuestBriefPayload
  visitor_key         text               -- NON-AUTHORITATIVE context (abuse control/telemetry only)
  expires_at          timestamptz        -- active-token expiry: created_at + 60 min
  claimed_by_user_id  text null references users(id)
  claimed_at          timestamptz null
  confirmed_at        timestamptz null
  state_updated_at    timestamptz
  created_at          timestamptz
```

**API surfaces (A2.3, not implemented):**
- `POST /api/public/q-concierge` — response gains optional `briefToken` (raw, once) when `readyForSignIn`.
- `POST /api/q/guest-brief/claim` — authenticated; body `{ briefToken }`; atomic; typed failures; never affects the session.
- `GET /api/q/guest-brief/current` — authenticated; resolves by `claimed_by_user_id = jwt.sub`, never by token; re-validates payload.
- `POST /api/q/guest-brief/confirm` — authenticated; owner accepts summary + selected prefill fields; `claimed → confirmed`.
- `POST /api/q/guest-brief/dismiss` — authenticated; `claimed|confirmed → dismissed`.
- Consumption (`confirmed → consumed`) happens when onboarding actually applies the confirmed fields (A2.4) — exactly once.

No client-visible type contains `token_hash`, `visitor_key`, `claimed_by_user_id`, or any tenant field.

## 7. Expiry and single-use rules

- **Active-token expiry: 60 minutes** (anonymous window concierge→login→claim; kept from rev. 1 — no evidence has surfaced for a different value).
- **Single successful claim**, enforced atomically in the claim transaction. Login does NOT consume or claim.
- **Claimed-brief retention:** separate policy; proposed 7 days for the informational summary card, then `expired`. Flagged as open question Q1 (§17) — needs product evidence.
- **Replacement:** creating a new brief for the same visitor context revokes the previous `active` brief (continuity hint only; security never depends on `visitorKey`).
- **Cleanup:** lazy delete-on-read for terminal rows + periodic sweep.

## 8. Identity-binding lifecycle (state machine)

| State | Meaning | Entered by |
|---|---|---|
| `active` | Anonymous token valid; brief unbound | brief creation |
| `claimed` | Token atomically invalidated for anonymous use; brief bound to exactly one authenticated user; retrievable only via authenticated identity | `POST …/claim` (atomic) |
| `confirmed` | Owner explicitly accepted the summary and allowed approved prefill fields | `POST …/confirm` |
| `consumed` | Confirmed handoff applied; cannot be applied again | onboarding apply (A2.4), exactly once |
| `expired` | TTL passed (active: 60 min; claimed: retention policy) | time |
| `dismissed` | Owner declined | `POST …/dismiss` |
| `revoked` | Replaced by newer brief (same visitor context) or security action | system |

Illegal transitions are typed failures (`brief_invalid_state`); e.g. confirm on `active`, claim on `claimed`, consume on `claimed`.

## 9. Existing-user behavior

- Login succeeds normally; nothing about the brief runs during authentication.
- The client may immediately call the claim endpoint; claim succeeds or fails independently.
- A claimed brief appears as an **informational Q summary card** in the user's normal destination.
- The user may **confirm** (marks interest; applies nothing automatically), **dismiss**, or **continue the conversation** (hands the validated summary to the workspace Q assistant context — display only in A2).
- No automatic change to `primaryWorkspace`, `businessId`, modules, tenant configuration, or onboarding state — in A2, confirming an existing-user brief changes no tenant data at all.

## 10. New-user behavior

- Signup/login succeeds normally (auto-created user, unchanged).
- Claim happens separately; onboarding may then show the validated **preselected segment** (restaurant/retail only — the active segments) and **prefilled approved fields** (`businessName`, `country`, `currency`) plus the summary card.
- The owner must **explicitly confirm** before any field is applied; corrections use the A1 `corrections` shape.
- Confirmation changes only the onboarding draft; the actual persistence path is the existing `PUT /user/profile` — **zero new write semantics, no workspace creation, no orchestration in A2.**

## 11. Conversation-continuity policy

| Artifact | Survives authentication? | Where | Justification |
|---|---|---|---|
| Raw transcript | **No** (default) | Dies with the concierge modal | Data minimization; unfiltered PII/small talk; A2.1 payload has no transcript field |
| Structured recommendation | **Yes** | `q_guest_briefs` → claim → summary card/onboarding | A1-validated core |
| Concise business summary | **Yes** | same | Display + prefill aid, ≤ 2000 chars |
| Bounded onboarding answers | **Yes** | same | ≤ 12 × 500 chars |
| Onboarding form answers | Yes (as today) | `PUT /user/profile` | Existing behavior |
| Long-term Q memory | **Not in A2** | `q_business_memories` (existing) after owner approval + workspace (A4) | Must be tenant-scoped and owner-sanctioned |

## 12. Observability and cleanup

- Payload-free audit events: `Q_GUEST_BRIEF_CREATED`, `_CLAIMED`, `_CONFIRMED`, `_CONSUMED`, `_DISMISSED`, `_EXPIRED`, `_REPLAY_ATTEMPT`, `_CLAIM_FAILED_STORE`.
- Metrics: created/claimed/confirmed/consumed/expired/replay-attempts per day (extends admin observability style).
- Alert: repeated `REPLAY_ATTEMPT` from one visitor context; claim-endpoint store failures (does not page on login — login is unaffected by design).
- Cleanup: lazy delete-on-read + sweep of terminal rows older than 1 day.

## 13. No-schema-change alternative

Signed **encrypted** token (AES-256-GCM, env key) `{ payload, exp, jti }`; claim ≈ decrypt + in-memory `jti` denylist. Honest trade-offs: no durable single-use (denylist is per-process — the known multi-instance limitation), no replay forensics, key-rotation burden, weak observability, payload transits the browser. Acceptable only as a temporary fallback; **not recommended** given the OTP precedent in this codebase.

## 14. Schema-backed alternative (recommended)

The `q_guest_briefs` table in §6: one additive table, no changes to existing tables. Requires explicit schema approval before A2.2 — **A2.1 (done) made no schema changes.**

## 15. Recommended implementation milestones

| Milestone | Scope | Gate |
|---|---|---|
| **A2.1 — Contract & token primitives (DONE, uncommitted)** | `qGuestBrief.ts` + `verify_q_guest_brief_contract.ts`: versioned payload, validation/normalization/limits, token generation/hash/compare, 18 checks | — |
| **A2.2 — Schema + brief service** | `q_guest_briefs` table; create/claim/confirm/dismiss/consume service with atomic transitions; cleanup | Schema approval + §17 questions |
| **A2.3 — Route wiring** | `briefToken` in concierge response; claim/current/confirm/dismiss endpoints; audit events | Security review of §4 |
| **A2.4 — Frontend consumption** | sessionStorage token swap; onboarding preselect/prefill + confirmation card; existing-user summary card; remove `q360_guest_setup` payload flow | UX review |

## 16. Exact first A2 implementation task

A2.1 (this pass, complete): pure `QGuestBriefPayload` v1 + `validateGuestBriefPayload` + token primitives (`generateBriefToken` 256-bit, `hashBriefToken` HMAC-SHA256 with injected secret, `briefTokenHashesEqual` constant-time, `toBriefTokenRecord`) + 18-case verification — no routes, no schema, no env coupling, no A1 behavior change.

## 17. Remaining questions before schema-backed A2.2

- **Q1 — Claimed-brief retention:** 7 days proposed for the informational card; needs product evidence (active-token expiry stays 60 min).
- **Q2 — "Continue the conversation" for existing users:** does confirm seed a `q_assistant_conversations` stub (write) or stay display-only in A2? Current design: display-only; seeding is A4.
- **Q3 — Consume trigger:** explicit `/consume` endpoint vs. implicit on onboarding completion (lean: explicit, idempotent).
- **Q4 — Rate limits on claim/confirm endpoints:** reuse auth-route limiter values or define new?
- **Q5 — `visitor_key` retention/privacy:** how long may this non-authoritative context be kept for telemetry (privacy review)?
- **Q6 — Multiple briefs per user:** one active claimed brief per user, or a list? (Lean: latest-claimed wins; earlier claimed briefs auto-expire.)

---

*Design only. This document is uncommitted by instruction. Stop for architectural review.*
