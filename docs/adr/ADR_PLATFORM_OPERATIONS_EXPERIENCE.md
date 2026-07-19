# ADR: Platform Operations Experience on admin.q360.app

## 1. Status

- **Status:** Approved for implementation planning (not yet implemented)
- **Date:** 2026-07-19
- **Decision owner/context:** Q360 product/platform owner, following the accepted admin panel investigation (`docs/Q360_ADMIN_PANEL_INVESTIGATION.md`, 2026-07-19) and the subsequent architecture discussion in which the Platform Operations direction (option B) was explicitly approved over treating admin as another tenant-app route.
- **Scope of this document:** architectural direction only. This ADR authorizes no code, configuration, deployment, or infrastructure change by itself.

---

## 2. Context

### Two products, one backend

Q360 serves two fundamentally different audiences:

- **Tenant workspace** — business operators (owners, managers, staff) running their daily operations: sales, stock, team, customers, bookings. Single-tenant scope, calm guided UX, high-frequency daily use, mobile-relevant.
- **Platform Operations** — the Q360 team running the platform itself: tenant lifecycle, user administration, AI usage/cost, audit, feature flags, and (later) billing, payments, abuse, and support. Cross-tenant scope, dense search-driven console UX, low-frequency but high-consequence use.

These differ in users, scope, risk profile, scale trajectory, and required security policy — and every one of those differences widens over the next five years.

### Findings from the admin investigation (2026-07-19)

The full evidence is in `docs/Q360_ADMIN_PANEL_INVESTIGATION.md`. The load-bearing facts:

- The admin panel is real and substantially implemented: five pages (`/admin/users`, `/admin/businesses`, `/admin/audit-logs`, `/admin/q-usage`, `/admin/settings`) backed by 15 Postgres-persisted endpoints under `/api/admin/*`, all guarded by JWT + strict `requireRole(['admin'])`, with audit logging on mutations. No destructive deletes, no impersonation.
- **Duplicate admin surfaces exist.** A second admin page — the platform stats dashboard (`src/modules/admin/DashboardView.tsx`) — lives at `/app/admin` inside the tenant workspace shell, guarded by `ProtectedRoute` only (no role guard), and is what the tenant sidebar's "Admin Ops" item links to for **all** users. The real admin shell at `/admin/*` has **no navigation entry anywhere**; it is reachable only by typing the URL.
- **Current admin-domain behavior:** `admin.q360.app` serves the byte-identical SPA bundle as the main deployment and renders the public marketing landing page. There is no hostname-based routing anywhere in the frontend. Live probes confirmed the Railway API does **not** return `Access-Control-Allow-Origin` for `https://admin.q360.app` — the domain cannot currently make a single successful browser API call, including login.
- **Per-origin session behavior:** authentication is OTP → 24 h JWT stored as a Bearer token in `localStorage` (`auth_token`, `auth_user`). localStorage is per-origin, so sessions do not carry between `q360.vercel.app`, `admin.q360.app`, or any future tenant domain. This is currently incidental, not designed.
- Backend authorization is sound at baseline (independent 401/403 enforcement), but lacks per-request lock/status/role re-checks: a locked, deactivated, or demoted admin keeps a fully valid token for up to 24 hours.

### Why a decision is needed now

The `admin.q360.app` domain is already attached in Vercel. Every future admin feature, security hardening item, and domain-configuration step will be shaped by whether the admin origin is "just another route in the tenant app" or a distinct product experience. Deciding now prevents the accidental consolidation of the wrong model.

---

## 3. Decision

`admin.q360.app` **will become a dedicated Platform Operations experience**, with:

- its own top-level shell, navigation, login experience, role-denial behavior, and information architecture;
- **a host-selected top-level shell**: at application bootstrap, the hostname selects whether the app mounts the Workspace experience or the Platform Operations experience;
- continued sharing of: the existing repository, the existing Vite application/build, the existing Vercel deployment, the backend, OTP/JWT authentication foundations, shared API clients, and shared UI foundations and design tokens — **throughout Phase 1**;
- an **intentional, separate admin-origin session**: per-origin login is a designed security property, not an accident to be "fixed" with cross-domain session sharing;
- **no tenant workspace and no marketing experience on the admin origin**: the admin origin renders only the Platform sign-in, the Platform console, or the No Platform Access screen.

Explicitly preserved: this is **one repository, one build, one deployment** for now. The separation is of *experience*, not of codebase or stack.

---

## 4. Target domain model

| Domain | Target role | Status note |
|---|---|---|
| `q360.app` | Public / marketing site (apex) | ⚠ **Currently returns 404** — not attached to the frontend deployment at time of writing. Target-state assignment, not current truth. |
| `app.q360.app` | Tenant workspace | ⚠ **Target-state, not current production truth.** Tenants are currently served from `q360.vercel.app`; `app.q360.app` does not exist in production today. |
| `admin.q360.app` | Platform Operations console | Attached and serving the SPA today, but CORS-blocked and rendering the marketing page. This ADR defines its target role. |
| `q360.vercel.app` | Temporary deployment alias | Current de-facto tenant origin. Target: redirect to `app.q360.app` once the tenant domain exists, so exactly one tenant origin remains. |

Session strategy across these origins: Bearer-token, per-origin sessions, kept deliberately. Any future cross-origin identity flow would be a separate, explicitly designed decision (see §11 — deferred).

---

## 5. Platform experience rules

On the Platform Operations origin:

1. **Signed out** → the Platform sign-in screen (Platform branding, environment identity visible). Not the tenant landing page, not the tenant login.
2. **Authenticated `role=admin`** → lands on **Platform Overview** after sign-in. Never in a tenant workspace.
3. **Authenticated non-admin** → an explicit **No Platform Access** screen: calm, clear, with a link to the tenant application. The workspace shell is never rendered on this origin.
4. **No automatic redirect into a tenant workspace** on the admin origin — contexts never blend.
5. **Deep links remain restorable**: a signed-out visit to a deep Platform link passes through sign-in and returns to the requested destination (subject to role).
6. **Environment identity must be visible** on every Platform screen (e.g., a persistent PRODUCTION / STAGING badge), so operators always know which environment they are acting on.
7. The tenant application shows a "Platform Console" link **only** to `role=admin` users, pointing at the admin origin — never embedding the console.

---

## 6. Information architecture

The Platform console is organized by operator intent, not by database table:

- **Overview** — platform health, KPIs, active incidents, recent admin actions, provider status (Q AI, email, database). Absorbs the useful functionality of the current `/app/admin` stats dashboard.
- **Tenants** — business search/list, tenant detail (profile, members, modules, usage), lifecycle actions (create, suspend, activate).
- **People** — cross-tenant user search, user detail (role, status, lock, module access), user creation and tenant assignment.
- **AI Operations** — Q usage and cost by tenant/user, budgets, fallback reasons, provider mode (the current Q Usage capability).
- **Audit & Security** — full audit log with tenant/user/action/date filters (the current Audit Logs capability), later admin-action and login/session visibility.
- **Platform Settings** — feature flags (maintenance mode, read-only mode, signups) and system configuration (the current Settings capability), with validation and, later, dual-control for dangerous flags.

**Future areas** (architecturally reserved, not committed): **Billing**, **Payments**, **Trust & Safety**, **Support**. Each is platform-level and cross-tenant; each slots into this IA without touching the tenant workspace.

---

## 7. Session and security decisions

1. **Per-origin login is intentional.** Signing in on the admin origin establishes a session on the admin origin only. There is no mechanism — and there will be no accidental mechanism — for a tenant-origin session to authenticate the admin origin or vice versa.
2. **No accidental cross-domain session sharing.** No shared cookie domain, no token-passing between origins. If shared identity is ever wanted, it will be designed explicitly (identity flow or shared cookie domain) as its own decision.
3. **The backend remains the true authorization boundary.** All frontend shells, guards, and host-routing are UX. Every `/api/admin/*` endpoint must continue to independently enforce `requireRole(['admin'])` (verified today), regardless of origin.
4. **Per-request lock/status/role enforcement is required before public readiness.** Today a locked/deactivated/demoted admin's token remains valid for up to 24 hours. Backend re-check of account state (and optionally role) in the auth middleware is a **prerequisite** to exposing the Platform origin publicly, not a later refinement.
5. **Stronger admin authentication can evolve independently later.** Because the admin origin has its own session and sign-in surface, shorter token TTL, MFA/SSO, IP allowlisting, and step-up authentication for dangerous actions can be introduced on the Platform experience without touching the tenant workspace.

---

## 8. Existing-route resolution

- The useful functionality of `/app/admin` (the platform stats dashboard, `src/modules/admin/DashboardView.tsx`) **should be consolidated into the Platform shell** — as part of the Overview area.
- The duplicate surface **must not remain as an independent admin product** inside the tenant workspace: two admin surfaces with different guards, different navigation, and different scopes is a standing source of confusion and guard-drift (the current ungated "Admin Ops" nav item and role-unguarded `/app/admin` route are direct evidence).
- **Final redirect/removal behavior for `/app/admin` and the "Admin Ops" nav item will be decided during implementation planning** (redirect to the admin origin, role-gated link, or removal), including how in-flight bookmarks are handled.
- The existing `/admin/*` route tree is expected to be absorbed into the host-selected Platform shell (mounted at `/` on the admin origin); final route naming on the admin origin is deferred to implementation planning (see §11).

---

## 9. Phased evolution

- **Phase 0 — Configuration and verification (no code).** Enable CORS for `https://admin.q360.app` on the backend; verify production configuration truth (Resend configured, JWT secret set, Phase-3 migration columns present); run the live browser verification plan from the investigation report. *This phase unblocks everything and changes no architecture.*
- **Phase 1 — Host-selected shell in the existing SPA.** One repository, one Vite build, one Vercel deployment. Bootstrap detects the admin hostname and mounts the Platform shell at `/`; Platform sign-in, Overview landing, No Platform Access screen, environment badge; guard/nav consistency on both surfaces; backend per-request account-state enforcement; consolidation of `/app/admin`. This phase delivers the majority of the user-visible and security value of this ADR.
- **Phase 2 — Separate Vite entry points in the same repository**, when justified: two build entries (workspace, platform) so each origin downloads only its own bundle. Trigger: measurable bundle-weight pain on the tenant app or diverging dependency needs.
- **Phase 3 — Separate deployable apps/packages** (monorepo `apps/workspace`, `apps/platform`, shared packages; separate Vercel projects with independent deploy/rollback), **only** when scale and team structure justify it. Trigger: independent release cadence or ownership becomes a real need.

Each phase is independently shippable and reversible within its phase boundary; no phase requires the next.

---

## 10. Consequences

### Benefits

- The admin origin becomes a coherent product: clear entry, clear context, no URL memorization, no accidental tenant-workspace landings.
- Platform concerns (current and future: billing, payments, abuse, support) get a designed home instead of accreting as orphaned routes.
- Ops UX can be dense and console-like without compromising the tenant workspace's calm, mobile-friendly character.
- Environment identity on every screen reduces operational error risk.

### Costs

- Host-selection logic and a second top-level shell add moderate frontend complexity (one bootstrap fork, two shells, shared foundations).
- Two navigation/guard surfaces to keep consistent during Phase 1 (mitigated by consolidation in §8).
- Some shared components may need generalization to serve both shells without forking.

### Security advantages

- Separate origin → separate session storage → clean isolation between tenant and operator credentials; token theft on one origin does not imply presence on the other.
- Independent hardening path (MFA, TTL, allowlisting, step-up auth) without tenant-app side effects.
- Tenant users never receive, render, or navigate toward Platform UI — removing the class of mistake already observed (unguarded `/app/admin`, ungated nav item).
- Backend authorization remains the single boundary, unaffected by which origin a request comes from.

### Temporary limitations

- Until Phase 0 lands, the admin origin remains CORS-blocked and non-functional in browsers.
- Until Phase 1 lands, the admin origin still renders the marketing landing page.
- Per-origin sessions mean operators sign in separately on each origin — accepted as a security property.

### Bundle implications during Phase 1

Both shells ship in the **same bundle** during Phase 1: tenant users download Platform shell code and vice versa. Mitigations already available in the current build: route-level lazy loading (the admin route tree is already lazy-loaded) keeps the Platform shell out of the initial tenant chunk. The residual cost is acceptable for Phase 1 and is the explicit trigger condition for Phase 2.

---

## 11. Explicit non-decisions / deferred work

This ADR deliberately does **not** decide or authorize:

- **No second frontend repository now.** The shared repository/build remains the implementation strategy through Phase 1–2.
- **No SSO / shared-cookie design now.** Per-origin sessions stand; any cross-origin identity design is a future, separate decision.
- **No super-admin implementation now.** The need for an admin tier above `admin` (and dual-control for dangerous actions) is recorded as a future hardening direction, not committed.
- **No admin visual redesign now.** Phase 1 reuses shared UI foundations and design tokens; a distinct Platform visual language may emerge later.
- **No new routes or code in this task.** This document changes nothing.
- **No route naming finalization** beyond architectural direction. Whether the Platform console uses `/overview`, `/tenants`, etc., and how `/admin/*` paths map, is implementation-planning work.
- Final disposition of `/app/admin` and the "Admin Ops" nav item (redirect vs. removal) — decided in implementation planning per §8.
- Apex-domain (`q360.app` 404) and tenant-domain (`app.q360.app`) attachment work — recorded as target state in §4, but execution is out of scope here.
- Admin API versioning (e.g., `/api/admin/v1`) — future evolution, not decided.

---

## 12. Implementation prerequisites

Before Phase 1 implementation begins, the following must exist:

1. **CORS enablement and live browser verification.** `https://admin.q360.app` added to backend `CORS_ORIGINS`; the 9-step verification plan in `docs/Q360_ADMIN_PANEL_INVESTIGATION.md` §18 executed successfully in a browser (sign-in, admin landing, role denial, deep-link refresh, logout isolation).
2. **Production configuration verification.** Confirmed on Railway: `NODE_ENV=production`; `RESEND_API_KEY` set (no dev-OTP log fallback); `EMAIL_FROM` exact; `JWT_SECRET` set; Phase-3 schema columns present (`users.status`, `users.is_locked`, `businesses.status`, `businesses.suspension_reason`) so lock/suspend endpoints do not return `MIGRATION_REQUIRED`.
3. **Backend account-state enforcement plan.** A concrete plan for per-request lock/status (and optionally role) re-checks in the auth middleware, so administrative lockouts take immediate effect — required before the Platform origin is exposed publicly (§7.4).
4. **Route/nav consolidation plan.** The disposition of `/app/admin`, the "Admin Ops" nav item, and the `/admin/*` path mapping into the Platform shell, including bookmark/redirect handling (§8).

---

## 13. Superseded alternatives

### Alternative A — admin as another route inside the tenant application (rejected)

Under A, `/admin/*` remains a route tree inside the tenant SPA, reached through tenant navigation, on the tenant origin. Rejected because:

- It conflates two products with different users, scopes, and risk profiles into one shell, one navigation, and one security policy — a mismatch that widens with every future platform capability (billing, payments, abuse, support have no coherent home in a tenant sidebar).
- Its failure modes are already observable in the current codebase: the real admin panel has no navigation entry; admins land in a restaurant workspace after login; a duplicate stats dashboard grew at `/app/admin` with no role guard, linked to all users.
- It couples Platform security hardening (MFA, TTL, allowlisting, step-up auth) to the tenant app, where those controls are inappropriate for waiters and managers.
- It taxes every tenant device with Platform code as the console grows, directly opposing the tenant app's lean/mobile trajectory.
- Its only durable advantage — today's simplicity — is largely preserved by the chosen approach, which keeps one repository, one build, and one deployment during Phase 1.

### Preserved from Alternative A

The shared repository, shared Vite build, shared Vercel deployment, shared backend, shared OTP/JWT foundation, shared API clients, and shared design tokens **remain the current implementation strategy**. What is rejected is the shared *experience*, not the shared stack.

---

*This ADR is a draft for review. It is uncommitted. Approval of this document authorizes implementation planning only; each phase above requires its own scoped implementation plan before code changes begin.*
