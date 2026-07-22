# Q360 Admin Panel & `admin.q360.app` — Investigation Report

**Date:** 2026-07-19
**Scope:** Discovery and verification only. No code, configuration, DNS, Vercel, or Railway changes were made. Nothing in this report is committed.
**Method:** Static analysis of `src/` (frontend), `backend/src/` (API), and root deploy configs, plus live HTTP probes against `https://admin.q360.app`, `https://q360.vercel.app`, `https://q360.app`, and the production API `https://web-production-44025.up.railway.app`. In-browser verification via Kimi WebBridge was attempted but the browser extension was not connected; live evidence below is from HTTP-level probes (marked **[LIVE]**), which is sufficient for the conclusions drawn.

---

## 1. Executive summary

The Q360 admin panel is a **real, substantially implemented** feature — not a mock. Five admin pages in the SPA call live Postgres-backed endpoints, every admin API route is guarded by JWT auth plus a strict `requireRole(['admin'])` check, and all admin mutations write audit log rows.

However, **`admin.q360.app` is not production-ready today**, for reasons that have nothing to do with the domain's Vercel status:

1. **[LIVE] CORS blocks the subdomain.** The production API's `CORS_ORIGINS` does not include `https://admin.q360.app`. A preflight from that origin returns `204` **without** an `Access-Control-Allow-Origin` header, so every browser API call from the subdomain fails. Only `https://q360.vercel.app` is currently allowed — notably, **`https://q360.app` itself is also not allowed** (and `https://q360.app` returns 404 at the edge, so the apex domain is not attached to the frontend deployment at all).
2. **No hostname awareness exists.** The frontend has zero hostname/subdomain routing. `admin.q360.app` serves the identical bundle as `q360.vercel.app` (verified: both serve `/assets/index-DE83CebN.js`). Visiting the admin domain shows the public landing page, not the admin panel. The admin panel lives only at the path `/admin/*`, reachable by typing the URL — **no navigation anywhere in the UI links to it**.
3. **Cross-subdomain sessions do not carry over.** Auth is a Bearer token in `localStorage`, which is per-origin. A login on `q360.vercel.app` is invisible on `admin.q360.app` and vice versa. Each origin requires its own OTP login. This is acceptable security-wise but must be a designed behavior, not an accident.
4. The domain is otherwise well-prepared: Vercel SPA rewrites make deep links refresh-safe, the deployed bundle has the production Railway API URL baked in, and the backend admin API answers unauthenticated requests with 401 as expected.

**Bottom line:** this is a **configuration gap (CORS) plus a product/design gap (no host-based experience)**, sitting on top of a code base that is ~80% ready. There are also real security hardening items (24-hour tokens with no revocation; locked users keep valid tokens; global cross-tenant admin scope; weak rate limiter; no security headers) that should be addressed before or alongside public exposure of an admin-branded domain.

---

## 2. Current admin architecture

### Frontend (React/Vite SPA, `src/`)

- **Router:** single file `src/views/routes.tsx`, mounted via `useRoutes` in `src/App.tsx:8` inside `BrowserRouter`.
- **Admin route tree** (`src/views/routes.tsx:365-376`):
  - `/admin` → `ProtectedRoute` → `AdminRoute` → `AdminLayout` (`src/layouts/AdminLayout.tsx:5-26`, dark shell with `AdminSidebar`)
    - index → redirect to `/admin/users`
    - `users` → `src/views/admin/UsersPage.tsx`
    - `businesses` → `src/views/admin/BusinessesPage.tsx`
    - `audit-logs` → `src/views/admin/AuditLogsPage.tsx`
    - `q-usage` → `src/views/admin/QUsagePage.tsx`
    - `settings` → `src/views/admin/SettingsPage.tsx`
- **A second, separate "admin" surface exists:** `/app/admin` (`src/views/routes.tsx:322-328`) renders `src/modules/admin/DashboardView.tsx` (platform stats from `GET /admin/stats`) inside the normal app `MainLayout`, guarded by `ProtectedRoute` **only — no role guard**. This page is what the main-app sidebar links to ("Admin Ops", `src/layouts/Sidebar.tsx:23`, shown to **all** users). The two surfaces are not connected: `AdminSidebar` has no link to DashboardView, and the main sidebar never links to `/admin`.
- **Admin API client:** `src/api/admin.api.ts` over the shared axios instance in `src/api/http.ts:5` — base URL `import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'`; Bearer token from `localStorage('auth_token')` attached by interceptor (`http.ts:33-39`); 401 → session expiry (`http.ts:46-58`). No cookies, no `withCredentials`.
- **Guards:** `AdminRoute` (`src/views/routes.tsx:173-184`) — unauthenticated → `/login`; `user.role !== 'admin'` → `/app`. Role comes from the zustand auth store (`src/store/auth.store.ts`), populated from `POST /auth/verify` and refreshed via `GET /user/profile` — **not** decoded from the JWT. Cached `auth_user` in localStorage can pass the guard while the API is down (deliberate offline fallback, `auth.store.ts:96-101`).

### Backend (Hono + Drizzle/Postgres, `backend/src/`)

- **Admin router:** `backend/src/routes/admin.ts` (667 lines), mounted at `/api/admin` (`backend/src/index.ts:70`). Router-level guards: `authMiddleware` + `requireRole(['admin'])` applied to **every** admin route (admin.ts:15-16). 15 endpoints (full inventory in §6). All persist to real Postgres tables (`users`, `businesses`, `audit_logs`, `system_settings`, `q_usage_events`). No mocks, no in-memory stores, no `DELETE` endpoints, no impersonation.
- **Auth middleware:** `backend/src/middleware/auth.ts` — HS256 JWT verified against `JWT_SECRET` (fatal exit if unset), Bearer-header only, claims `sub/email/role/businessId`, effective role via `resolveEffectiveBusinessRole` (`backend/src/services/businessOwnership.ts:21-22`: non-`'user'` token roles are trusted as-is), tenant resolution rejects workspace-route identities and demands a real `businessId` (`400 TENANT_IDENTITY_REQUIRED` otherwise). Token TTL 24 h, hardcoded (auth.ts:82); no refresh, no revocation; logout is a stateless no-op (`backend/src/routes/auth.ts:254-256`).
- **Auth flow:** email OTP (`backend/src/routes/auth.ts`) — 6-digit code, HMAC-SHA256 storage keyed with `JWT_SECRET`, 10-min TTL, 60-s resend throttle, 5 attempt limit, constant-time compare, race-safe single-use claim. Auto-provisions unknown emails as `owner` of a fresh business. **[LIVE]** Production `/health` responds normally.

### Verdict on architecture

The admin panel is **complete enough to use for its current feature set** (user lifecycle, business lifecycle, audit viewing, Q usage analytics, feature flags), **not mock-only**, **not disconnected**, and **already structured so a subdomain could serve it** — but it was **not designed for one** (no host routing, no nav entry, no host-aware login redirect).

---

## 3. Domain-routing truth

**There is no hostname-based routing anywhere.** Grep for `hostname`, `location.host`, `subdomain`, `admin.q360` across `src/` returns zero matches; the deployed bundle contains no `admin.q360` string. The string `admin.q360.app` appears nowhere in the repo (code, configs, docs).

**[LIVE] Verified behavior of the admin domain (HTTP probes, 2026-07-19):**

| Request | Result | Meaning |
|---|---|---|
| `GET https://admin.q360.app/` | 200, same `index.html` as main app | Serves the identical SPA |
| `GET https://admin.q360.app/users` | 200 (SPA shell) | Vercel catch-all rewrite works; React Router then renders `*` → **NotFound** (there is no `/users` route — admin users live at `/admin/users`) |
| `GET https://admin.q360.app/login` | 200 (SPA shell) → renders `/login` | Login page renders, but OTP API calls **fail CORS** (see §9) |
| Deployed bundle | `/assets/index-DE83CebN.js` on both `admin.q360.app` and `q360.vercel.app` | Byte-identical deployment; API base `https://web-production-44025.up.railway.app/api` baked in |
| `GET https://q360.app/` | **404** | Apex domain is **not attached** to the frontend deployment; only `q360.vercel.app` and `admin.q360.app` serve the app |

**Expected per-scenario behavior today (from code + probes):**

| Scenario | What happens today |
|---|---|
| `https://admin.q360.app` | Public landing page (`LandingView`) — indistinguishable from the main domain |
| `https://admin.q360.app/` | Same |
| `https://admin.q360.app/login` | Login page renders; **OTP request fails in-browser due to CORS** → cannot sign in |
| `https://admin.q360.app/users` | SPA loads → NotFound view (route is `/admin/users`, not `/users`) |
| Refresh on `/admin/users` | 200 shell → `ProtectedRoute` → unauthenticated → redirect to `/login`; deep link itself is refresh-safe |
| Admin URL signed out | Redirect to `/login` on the same origin |
| Admin URL as normal user (`role != admin`) | `AdminRoute` redirects to `/app` |
| Admin URL as `role=admin` | Admin panel renders — **but only after CORS is fixed**, since every data call would otherwise fail |
| Main Q360 URL as admin | Lands in normal app (`/app/...`); must hand-type `/admin` — nothing links there |

---

## 4. Authentication flow

1. `POST /api/auth/login` (email) → OTP via Resend; 60-s resend throttle; rejects locked/inactive users (`backend/src/routes/auth.ts:47-49`).
2. `POST /api/auth/verify` (email + code) → returns `{ token, user }`; token = HS256 JWT, claims `sub/email/role/businessId`, **24 h expiry**, no refresh.
3. Frontend stores `auth_token` + `auth_user` in **localStorage** (`src/store/auth.store.ts:22-26`); axios attaches `Authorization: Bearer` per request.
4. Session restore on reload: `initSession()` → `GET /user/profile` with retries; on failure falls back to cached profile.
5. Logout: local clear + best-effort `POST /auth/logout` (server-side no-op).
6. Post-login redirect (`src/modules/auth/LoginView.tsx:49-55`): `onboardingCompleted` → `primaryWorkspace || /app/{segment} || /app`; else `/onboarding/identity`. **No admin-specific destination** — an admin who logs in on `admin.q360.app` would land in the normal workspace app, not the admin panel.

**Cross-subdomain session behavior:** localStorage is per-origin, so `admin.q360.app` and `q360.vercel.app` (and any future `q360.app`) each require a **separate OTP login**. Tokens are origin-agnostic Bearer credentials — a token minted on one origin is valid from any CORS-allowed origin. There are no cookies, hence no `Domain=`/`SameSite` surface. This behavior is *acceptable* (isolation between public app and admin console is arguably desirable) but is currently **incidental, undocumented, and unhandled in UX** (no "you are signed out here" affordance, no admin-specific login page or redirect).

---

## 5. Authorization matrix

| Layer | Mechanism | Effective rule | Assessment |
|---|---|---|---|
| Frontend `/admin/*` | `AdminRoute` (`routes.tsx:173-184`) | `user.role === 'admin'` from server profile | Sound as UX gate; not a security boundary |
| Frontend `/app/admin` | `ProtectedRoute` only (`routes.tsx:322-328`) | Any authenticated user renders the page | **Gap:** page renders for everyone; only the API call rejects non-admins (403) — leaks the UI's existence/shape, inconsistent with `/admin` gating |
| Frontend nav "Admin Ops" | none (`Sidebar.tsx:23`) | Visible to all users | **Gap:** links to `/app/admin` for roles that can never use it |
| Backend `/api/admin/*` | `authMiddleware` + `requireRole(['admin'])` (admin.ts:15-16) | Valid JWT **and** role `admin` | Sound. Frontend/backend agree: only `admin` |
| Backend role resolution | `resolveEffectiveBusinessRole` (businessOwnership.ts:21-22) | Token role trusted for non-`'user'` roles; no per-request DB re-check | **Risk:** demotion/lock of an admin takes effect only at next login — valid tokens live up to 24 h |
| Tenant scope of admin | none | Admin role is **platform-global**: reads/writes span all tenants | By design, but powerful: can create more admins, change any role, suspend any business, toggle maintenance mode |
| Legacy/missing tenant | `TENANT_IDENTITY_REQUIRED` 400 (auth.ts:56-58); workspace-route identities rejected/migrated | No unsafe default tenant for requests | Sound. (`biz_main` fallback remains only at token issuance, `utils/tenant.ts:16-17` — low risk, flagged) |
| Direct API with bypassed frontend | Router-level guard | 401 without token **[LIVE verified]**; 403 for non-admin roles | Protected independently of the frontend — correct |

Roles in the system: `admin`, `owner`, `manager`, `staff`, `user` (users table) plus staff-level `waiter|cashier|kitchen` (`staff_members`). Only `admin` enters `/api/admin/*`.

---

## 6. Admin feature inventory

All endpoints are under `/api/admin`, all require `role=admin`, all persist to Postgres, all mutations write `audit_logs` rows (some audit inserts fail silently with only a warn-log, e.g. admin.ts:332-334).

| Capability | Frontend page | Backend route | Authz rule | Persistence | Tenant scope | Readiness | Known risk |
|---|---|---|---|---|---|---|---|
| Platform stats dashboard | `DashboardView` (at `/app/admin`, **orphaned** from `/admin`) | `GET /stats` (admin.ts:20-64) | admin | Real DB | Global | Working; degrades gracefully if `status`/`audit_logs` columns missing | Unguarded frontend route (`/app/admin`) |
| User listing | `UsersPage` | `GET /users` (admin.ts:178-185) | admin | Real DB | **Global (all tenants)** | Working | No pagination, no field redaction; full-row select |
| User creation | `UsersPage` (businessId **required** in form) | `POST /users` (admin.ts:188-238) | admin | Real DB + audit | Attaches to chosen business | Working | Can create additional **`admin`** users — no super-admin tier |
| User update (name/role/status/lock/modules) | API client exists; **page does not use `PATCH`** | `PATCH /users/:id` (admin.ts:241-303) | admin | Real DB + audit | Global | **Backend ready; frontend unwired** | No self-demotion/self-lock guard; email/businessId deliberately immutable |
| Role update | Same as above | same `PATCH` | admin | Real DB + audit | Global | Backend ready; frontend unwired | Role change effective only at target's next login |
| Activate / deactivate user | `UsersPage` | `POST /users/:id/activate` / `deactivate` (admin.ts:307-379) | admin | Real DB + audit | Global | Working | 400 `MIGRATION_REQUIRED` if `users.status` missing in prod (db:push must have run); token of deactivated user stays valid ≤24 h |
| Lock / unlock user | `UsersPage` | `POST /users/:id/lock` / `unlock` (admin.ts:383-455) | admin | Real DB + audit | Global | Working | Same migration + live-token caveats |
| Business assignment | `UsersPage` create form only | `POST /users` (businessId mandatory, validated) | admin | Real DB | Per created user | **Partial** — assignment only at creation; `PATCH` refuses `businessId` by design | No re-assignment path at all |
| Business listing / creation | `BusinessesPage` | `GET/POST /businesses` (admin.ts:460-500) | admin | Real DB + audit | Global | Working | Type limited to retail/service/fnb in UI |
| Business suspend / activate | `BusinessesPage` (with reason) | `POST /businesses/:id/suspend` / `activate` (admin.ts:504-583) | admin | Real DB + audit | Global | Working | `MIGRATION_REQUIRED` guard; suspension does not invalidate sessions |
| Module management | **None in admin panel** | Tenant-scoped `GET/PATCH /api/business/modules*` (business.ts:161-196) | owner/manager/admin of that tenant | Real DB + audit | **Single tenant only** | Exists but not an admin capability | Admins can't manage modules for other tenants without a token in that tenant |
| Audit visibility | `AuditLogsPage` (filters, expandable detail) | `GET /audit-logs` (admin.ts:588-616) | admin | Real DB | Global, filterable | Working | Hard limit 200 rows; `JSON.parse(log.details)` can throw on malformed data (AuditLogsPage.tsx:158-160); reads not audited |
| Q usage / cost analytics | `QUsagePage` (7/30/90 days) | `GET /q-usage` (admin.ts:68-173) | admin | Real DB | Global rollups | Working | Loads full period into memory — scale concern |
| System settings / feature flags | `SettingsPage` (MAINTENANCE_MODE, READ_ONLY_MODE, DISABLE_SIGNUPS, arbitrary keys) | `GET/POST /settings` (admin.ts:621-664) | admin | Real DB + audit | Global | Working | **High blast radius** — one toggle takes down the platform; arbitrary key/value creation allowed |
| Health | `DashboardView` health card | included in `GET /stats`; public `GET /health` **[LIVE ok]** | admin (stats) / public (health) | n/a | Global | Working | Public `/health` leaks service metadata (minor) |
| Impersonation | — | **does not exist** | — | — | — | Absent (good) | — |
| Destructive deletes | — | **none anywhere in admin.ts** | — | — | — | Absent (good) | — |

---

## 7. Frontend/backend gaps

1. **CORS (blocker):** `admin.q360.app` absent from Railway `CORS_ORIGINS` — every browser API call from the subdomain fails. Also absent: `https://q360.app` (apex 404s anyway). **[LIVE]**
2. **No hostname routing:** the admin domain renders the marketing landing page. There is no code path that maps `admin.q360.app` → admin shell.
3. **No navigation to `/admin`:** sidebar links only to `/app/admin` (unguarded stats page); `SegmentsView` "Admin Console" card is disabled ("Internal preview"). The real panel is URL-only.
4. **Guard inconsistency:** `/app/admin` lacks `AdminRoute`; nav item lacks a role check.
5. **Post-login destination:** no admin-aware redirect — an admin signing in on the admin domain lands in a business workspace.
6. **Orphaned dashboard:** `/admin` index redirects to `/admin/users`; the stats dashboard isn't part of the admin shell.
7. **`PATCH /users/:id` unused:** role/status edits can't be made from the UI (only create + activate/deactivate/lock/unlock).
8. **Settings page allows arbitrary keys** — powerful, unvalidated.
9. **Audit page JSON.parse fragility**; **users list unpaginated**.
10. **`VITE_SIMULATION_MODE` is dead config** (declared, never read).

---

## 8. Cross-subdomain session behavior

- Storage: `localStorage` keys `auth_token`, `auth_user`, `onboarding_complete` — **per-origin**, so sessions do **not** transfer between `q360.vercel.app`, `admin.q360.app`, or any future apex domain. Each origin needs its own OTP round-trip.
- Token portability: Bearer tokens are origin-agnostic; any valid token works from any CORS-allowed origin. Convenient, but token theft anywhere = API access anywhere allowed.
- No cookies → no `Domain=.q360.app` sharing mechanism exists today. Intentional SSO-like sharing would require a design decision (shared cookie domain vs. per-origin login). Per-origin login is the safer default and current de-facto behavior.
- Logout clears only the current origin's storage; the other origin's session (and the server-side token) remain valid until the 24 h expiry. There is no server-side revocation to call.

## 9. CORS and environment findings

Backend CORS (`backend/src/index.ts:30-49`): production origins come **exclusively** from the `CORS_ORIGINS` env var (comma-separated, no wildcard); localhost origins only when `NODE_ENV !== 'production'`; `credentials: true` (moot — Bearer auth).

**[LIVE] Preflight probes against `https://web-production-44025.up.railway.app` (2026-07-19):**

| Origin | `Access-Control-Allow-Origin` returned? |
|---|---|
| `https://q360.vercel.app` | ✅ yes |
| `https://admin.q360.app` | ❌ **no** |
| `https://q360.app` | ❌ no |
| `https://www.q360.app` | ❌ no |
| `https://app.q360.app` | ❌ no |
| `https://one-os.vercel.app` | ❌ no |

Conclusions:
- Railway currently runs with `NODE_ENV=production` and `CORS_ORIGINS` effectively containing only `https://q360.vercel.app` (any other entries, if present, don't match the tested origins).
- **`admin.q360.app` cannot make a single successful browser API call today.** Even login is impossible from that origin.
- Repo config references (`.env.example`, `DEPLOYMENT.md`) predate the domain work and mention neither `q360.app` nor `admin.q360.app`.
- Frontend env: only `VITE_API_BASE_URL` matters; the deployed bundle correctly embeds the Railway API URL — no rebuild is needed for CORS reasons.
- Other env items to verify on Railway before exposure (from code): `RESEND_API_KEY` set (otherwise OTPs are printed to server logs and `developmentMode:true` is advertised — auth.ts:82-96), `EMAIL_FROM` exactly `Q360 <no-reply@send.q360.app>`, `JWT_SECRET` set (fatal otherwise), `DATABASE_URL` + SSL, and that the `preDeployCommand` `db:push` (railway.json) has actually applied the Phase-3 columns (`users.status`, `users.is_locked`, `businesses.status/suspension_reason`) — several admin endpoints return `400 MIGRATION_REQUIRED` otherwise.

---

## 10. Production-readiness risks

1. **CORS blocker** (config) — admin domain fully non-functional in browsers.
2. **Apex domain 404** — `q360.app` serves nothing; if marketing points there, that's a separate incident.
3. **Migration-dependent endpoints** — lock/deactivate/suspend fail with `MIGRATION_REQUIRED` if `db:push` drifted; verify on production before relying on them.
4. **24-h token validity with zero revocation** — lock/deactivate/suspend/demote do not cut live access.
5. **Global admin scope** — cross-tenant reads, admin-minting, platform-wide feature flags; no super-admin tier, no second-person rule for dangerous flags.
6. **Unpaginated `GET /admin/users`** and in-memory `q-usage` rollups — degrade as the platform grows.
7. **Weak global rate limiter** — keyed on spoofable raw `X-Forwarded-For`, unbounded in-memory Map (memory leak), 100 req/5 min shared across everything (`backend/src/middleware/rateLimit.ts`).
8. **No security headers** (no helmet/CSP/HSTS/X-Frame-Options) on API responses.
9. **Audit blind spots** — admin logins, failed authz, and all reads are unaudited; some audit writes fail silently.
10. **Silent offline guard bypass (minor):** cached `auth_user` passes `AdminRoute` while API is down — API still rejects, so impact is UX-only.

## 11. Security concerns

- **Session invalidation gap** (highest): no per-request `isLocked`/`status`/role re-check; stateless logout; 24 h tokens. A locked admin keeps full platform control for up to a day.
- **Admin proliferation:** any admin can create more admins and set any role on any user. No super-admin tier, no audit-anchored approval.
- **Cross-tenant data exposure by design:** user lists and audit logs of all tenants readable by any admin. Acceptable for a true platform-ops role; dangerous if `admin` is ever granted loosely.
- **Feature-flag endpoint** can globally enable maintenance/read-only mode — a single compromised admin token = platform DoS.
- **OTP coupling:** OTP HMAC keyed with `JWT_SECRET` (functional; couples concerns).
- **Dev OTP fallback** would log codes server-side if `RESEND_API_KEY` is missing — must be verified set on Railway.
- **Rate limiter spoofing** via `X-Forwarded-For` rotation; unbounded Map growth.
- **`/app/admin` frontend route exposed to all authenticated users** — minor information exposure, trivially fixed.
- No evidence of destructive endpoints, impersonation, SQL-injection surface (Drizzle parameterized), or missing authz on any admin route — the baseline authz posture is **good**.

## 12. UX/design concerns

- The admin domain shows a marketing landing page — worst possible first impression for an "admin" URL.
- No entry point to `/admin` from anywhere; admins must memorize the path.
- No admin-specific login screen, branding, or post-login destination; signing in on the admin domain drops you into a restaurant workspace.
- Error states: CORS failure surfaces as a generic network error, not "this domain isn't enabled"; `MIGRATION_REQUIRED` responses are raw.
- `AdminLayout` is a fixed dark sidebar shell (`AdminLayout.tsx`) with no responsive treatment observed — mobile behavior of the admin panel is effectively untested/unaddressed.
- Accessibility: no evidence of focus management, aria labeling, or keyboard pass in admin views; data tables (Users/Businesses/Audit) are custom-styled divs.
- "Back to App" in the admin sidebar navigates to `/app` — on a dedicated admin domain with a user who has no workspace, that lands in onboarding/segments, a confusing loop.

## 13. Exact files involved

**Frontend**
- `src/views/routes.tsx` — all routes; `ProtectedRoute` (131-171), `AdminRoute` (173-184), `/app/admin` (322-328), `/admin/*` tree (365-376)
- `src/App.tsx` — BrowserRouter/useRoutes mount
- `src/layouts/AdminLayout.tsx`, `src/layouts/AdminSidebar.tsx` — admin shell + nav (nav items at AdminSidebar.tsx:19-25; Back-to-App :81; Sign out :97)
- `src/layouts/Sidebar.tsx:18-25` — main nav, ungated "Admin Ops"
- `src/modules/core/SegmentsView.tsx:45-49` — disabled "Admin Console" card
- `src/views/admin/UsersPage.tsx`, `BusinessesPage.tsx`, `AuditLogsPage.tsx`, `QUsagePage.tsx`, `SettingsPage.tsx`
- `src/modules/admin/DashboardView.tsx` — orphaned stats page
- `src/api/http.ts` — axios base URL/interceptors; `src/api/admin.api.ts` — admin endpoints; `src/api/auth.api.ts` — OTP calls
- `src/store/auth.store.ts` — session, role source, logout
- `src/modules/auth/LoginView.tsx:49-55` — post-login redirect
- `src/types/user.ts:24-44` — role/tenant shape
- `vercel.json` — catch-all SPA rewrite (works for both domains)
- `vite.config.ts` — base `/`, aliases, chunks

**Backend**
- `backend/src/index.ts` — CORS (30-49), global rate limit (29), mounts (63-75), health (59-60), error handler (83-93)
- `backend/src/routes/admin.ts` — all 15 admin endpoints (see §6)
- `backend/src/routes/auth.ts` — OTP login/verify/logout/session
- `backend/src/middleware/auth.ts` — JWT verify, role/tenant context, `requireRole`
- `backend/src/middleware/rateLimit.ts` — global limiter
- `backend/src/services/businessOwnership.ts` — effective role resolution
- `backend/src/utils/tenant.ts` — tenant identity, `biz_main` issuance fallback
- `backend/src/utils/audit.ts` — audit helper
- `backend/src/db/schema.ts` — `users`, `businesses`, `audit_logs`, `system_settings`, `q_usage_events`, `business_modules`
- `railway.json` (preDeploy `db:push`), `Procfile`, `nixpacks.toml`
- `backend/.env.example`, root `.env.example`, `DEPLOYMENT.md` — config docs (all predate the new domains)

## 14. Recommended milestones (dependency order)

1. **M0 — Verify production config truth (no code):** confirm on Railway: `NODE_ENV=production`, `RESEND_API_KEY` set, `JWT_SECRET` set, Phase-3 columns present (hit a lock/suspend endpoint as an admin or check schema), and exact current `CORS_ORIGINS`. Confirm Vercel attachment plan for apex `q360.app` (currently 404).
2. **M1 — CORS config change (configuration-only):** add `https://admin.q360.app` (and the intended main origin) to Railway `CORS_ORIGINS`. Admin domain becomes minimally usable end-to-end the moment this lands.
3. **M2 — Hostname routing + admin landing (small implementation):** detect `admin.q360.app` at bootstrap; redirect `/` → `/admin` (guard handles sign-in redirect); post-login destination `/admin` for `role=admin` on the admin host; non-admin users on the admin host get a clear "not authorized" screen instead of the workspace app.
4. **M3 — Guard/nav consistency (small implementation):** add `AdminRoute` to `/app/admin` (or fold DashboardView into the admin shell as `/admin` index); role-gate the "Admin Ops" nav item; decide the fate of the disabled SegmentsView card.
5. **M4 — Session security hardening (security-sensitive):** per-request `isLocked`/`status` check in `authMiddleware`; shorter token TTL or refresh flow; audit admin logins and failed authz. Prerequisite for comfortable public exposure.
6. **M5 — Admin API ergonomics (small implementation):** paginate `GET /admin/users`; wire `PATCH /users/:id` into UsersPage (role/status edit); wrap AuditLogsPage JSON.parse; validate settings keys against a whitelist.
7. **M6 — Platform hardening (security-sensitive):** fix rate limiter (real client IP from Railway's proxy semantics, bounded store); security headers; super-admin tier or dual-control for `MAINTENANCE_MODE`/`READ_ONLY_MODE` and admin creation.
8. **M7 — Product/design (product work):** dedicated admin login screen/branding, error states, mobile pass, accessibility pass, observability dashboard for admin actions.

## 15. Maximum three possible next implementation tasks

- **T1 (config):** Add `https://admin.q360.app` to Railway `CORS_ORIGINS` and verify OTP login + `/admin/users` end-to-end in a browser. *(Configuration-only; the single unblocking step.)*
- **T2 (small impl):** Hostname-based admin entry — on `admin.q360.app`, route `/` → `/admin`, send admins to `/admin` after login, show an authorization-failure screen to non-admins, and add an "Admin Panel" entry to navigation visible only to `role=admin`.
- **T3 (security-sensitive):** Per-request account-state enforcement — re-check `isLocked`/`status` (and optionally role) in `authMiddleware`, so lock/deactivate/demote take immediate effect.

## 16. One best exact next task

**T1 — enable CORS for `https://admin.q360.app` on Railway, then run a full browser smoke test of the admin panel through the subdomain.**

It is configuration-only (no code risk), it is the single hard blocker, and it converts every other finding in this report from "hypothetical" to "testable" — including T2 and T3, which cannot be validated through the domain until browsers can talk to the API from it.

## 17. Files that task would modify

None in the repository. It changes only the Railway environment variable `CORS_ORIGINS` (add `https://admin.q360.app`; decide whether to also add the future main origin `https://q360.app` when the apex is attached in Vercel). Afterwards, update `DEPLOYMENT.md` and `backend/.env.example` documentation in a separate docs commit.

## 18. Verification plan

Post-CORS-change smoke test (read-only against production):

1. Preflight: `curl -i -X OPTIONS .../api/auth/login -H "Origin: https://admin.q360.app" ...` returns `access-control-allow-origin: https://admin.q360.app`.
2. Browser: open `https://admin.q360.app/login` → request OTP for an `admin`-role test account → code arrives via email (proves `RESEND_API_KEY`/`EMAIL_FROM`); no `developmentMode` flag in the `/auth/login` response.
3. Sign in → manually navigate to `/admin/users` → user list renders (proves auth + authz + CORS + DB).
4. Refresh on `/admin/audit-logs` → page survives deep-link refresh (proves SPA rewrite).
5. Sign in as a non-admin account → `/admin/users` redirects to `/app`; direct `GET /api/admin/users` with that token returns 403.
6. Signed-out visit to `/admin/users` → redirected to `/login`; direct API call → 401.
7. Lock a test user, then attempt login → rejected at `/auth/login`; note (and document) that their existing token remains valid until expiry (known gap, M4/T3).
8. Exercise one `MIGRATION_REQUIRED`-guarded action (e.g., lock/unlock on the test user) to confirm Phase-3 columns exist in production.
9. Check logout → `/admin` unreachable without re-login on that origin; confirm the session on `q360.vercel.app` is unaffected (documents per-origin behavior).

---

## Verdict

| Question | Answer |
|---|---|
| **Domain ready?** | **Partially.** Vercel serves the correct app on `admin.q360.app` and SPA rewrites work — but the Railway API rejects the origin (CORS), so the domain is unusable in practice. Also note: apex `q360.app` currently 404s. |
| **Routing ready?** | **No.** No hostname routing exists; the admin domain shows the public landing page; the admin panel is path-only (`/admin/*`) with no navigation entry, and `/users`-style deep links on the admin host hit NotFound. |
| **Authentication ready?** | **Mostly.** OTP + JWT works and is solid (throttling, single-use, constant-time compare). Blocked *on the subdomain* only by CORS. Caveats: 24-h tokens, no revocation, per-origin sessions (by accident, not design), dev-OTP log fallback if Resend is unconfigured. |
| **Authorization ready?** | **Yes, at baseline.** Backend enforces `requireRole(['admin'])` on every admin route independently of the frontend; direct API access is protected (401/403 verified). Gaps: no live re-check of lock/status/role, global cross-tenant scope, admin-can-mint-admin, unguarded `/app/admin` frontend route. |
| **Admin workflows ready?** | **Partially.** User create/lock/activate, business create/suspend, audit viewing, Q-usage analytics, and feature flags work end-to-end (subject to migration columns). Role editing UI is unwired; business re-assignment doesn't exist; module management is tenant-scoped only; no pagination; no admin dashboard inside the admin shell. |
| **Safe to expose publicly?** | **Not yet.** Minimum before exposure: (1) CORS fix, (2) hostname routing so the domain doesn't serve a marketing page with a hidden admin path, (3) per-request lock/status enforcement so admin lockouts actually work. Items (4)-(6) — rate-limiter fix, security headers, settings dual-control — should follow immediately after. |
