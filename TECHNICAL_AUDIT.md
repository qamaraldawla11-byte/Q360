# One OS Technical Audit

Audit date: 2026-06-13

Scope: current working tree in `D:\VS CODE App\One OS`, including the React
frontend, Hono backend, SQLite schema, scripts, deployment files, and handover
documentation.

## Executive Summary

One OS is a modular business operations web application and an early platform
foundation for multiple industry workspaces. Today, it is not yet the AI
operating system, real-time mesh, offline-first product, or mature multi-tenant
SaaS platform described by some public copy and strategy documents.

The strongest working path is:

```text
React SPA
  -> Axios bearer-token API client
  -> Hono REST API
  -> Drizzle ORM
  -> local SQLite database
```

Supermarket inventory, barcode lookup, POS order creation, immediate
procurement stock updates, and platform administration are the main
database-backed capabilities. Restaurant and pharmacy have substantial
interactive UI, but most of their domain state is held in non-persisted Zustand
stores or hardcoded arrays. Retail and School are dashboard prototypes with
navigation entries that mostly lead to the global 404 page. Marketplace,
Logistics, and Merchants are explicit placeholder screens.

Overall readiness:

| Area | Assessment |
|---|---|
| Frontend build | Passes |
| Frontend architecture | Good prototype structure |
| Backend implementation | Functional narrow commerce/admin API |
| Data persistence | Partial; SQLite-backed only for selected features |
| Authentication | Development-grade, not production identity |
| Multi-tenancy | Tenant fields exist, but tenant lifecycle/model is incomplete |
| Real-time/offline sync | Not implemented |
| Automated quality gates | Not ready; lint and backend type check fail |
| Production deployment | Frontend deployable; full system not launch-ready |
| Scale readiness | Single-instance prototype, not safe for multi-instance SaaS |

## 1. Project Overview

### What the application is

One OS currently provides:

- A public Qamar Technology product site.
- Email-based login and JWT session restoration.
- A protected application shell and onboarding flow.
- Vertical workspaces for Restaurant, Pharmacy, Supermarket, Retail, and
  School.
- Shared application surfaces for segments, admin, marketplace, logistics,
  merchants, and settings.
- A separate backend for authentication, supermarket commerce operations, and
  platform administration.

The implemented product is best described as a modular vertical business OS
prototype. The longer-term vision in `PRODUCT_VISION.md` is an API-first,
MCP-native, agent-enabled enterprise platform, but there is no MCP server,
agent runtime, workflow engine, model integration, tool registry, or approval
system in this repository.

### Current technology stack

Frontend:

- React 19.2
- TypeScript 5.9
- Vite 7
- React Router 7 route objects
- Zustand 5
- Axios
- Lucide React
- Vanilla CSS and CSS custom properties

Backend:

- Node.js and TypeScript
- Hono with `@hono/node-server`
- Hono JWT utilities
- Drizzle ORM
- `better-sqlite3`
- SQLite in WAL mode

Infrastructure/tooling:

- npm with separate root and `backend/` dependency trees
- ESLint
- Vercel frontend configuration
- Railway deployment instructions, but no committed Railway configuration
- Manual SQLite seed/migration/backup scripts

There is no Tailwind dependency despite older screenshot notes mentioning
Tailwind. Styling is inline React style objects plus `src/index.css` and
`src/styles/theme.css`.

### Repository shape

This is one repository containing two separately installed applications:

```text
/
|-- src/                 React SPA
|-- public/              static/PWA assets
|-- scripts/             verification scripts
|-- backend/
|   |-- src/             Hono API and database code
|   |-- data/            ignored runtime SQLite files
|   `-- backups/         ignored database backups
|-- package.json         frontend scripts/dependencies
`-- backend/package.json backend scripts/dependencies
```

It is not an npm workspace/monorepo: there is no root workspace declaration,
shared package, unified test command, or unified backend build command.

## 2. Current Feature and Route Status

Status terms:

- **Functional/persisted**: connected to the backend and SQLite.
- **Functional/local**: interactive but state is memory-only and resets.
- **Static/demo**: rendered sample data or controls without a complete action.
- **Stub/empty**: placeholder copy or missing implementation.
- **Broken navigation**: advertised by a manifest/sidebar but no matching route.

### Public routes

| Route | Component | Status |
|---|---|---|
| `/` | `LandingView` | Static marketing page; contains unimplemented sync/offline claims |
| `/pricing` | `PricingView` | Static |
| `/docs` | `DocsView` | Static |
| `/support` | `SupportView` | Static form; no submit integration |
| `/ai` | `AiView` | Static product copy; no AI runtime |
| `/login` | `LoginView` | Interactive; real API with development mock fallback |
| `*` | `NotFoundView` | Functional 404 display |

### Onboarding routes

| Route | Component | Status |
|---|---|---|
| `/onboarding/identity` | `IdentityView` | Functional/local |
| `/onboarding/segment` | `SegmentView` | Functional/local |
| `/onboarding/type` | `SubSegmentView` | Functional/local |
| `/onboarding/workspace` | `BusinessTypeView` | Simulated completion only |

Onboarding updates the in-memory auth store through `updateUser()`. It does not
call a backend endpoint, create a database business/workspace, or update the
user row. A refresh restores the backend user and discards the onboarding
result.

`SegmentView` and `SubSegmentView` also overload `lastActiveWorkspace` as
temporary wizard state. `BusinessTypeView` waits 800 ms to simulate an API call.

### Main application routes

| Route | Status |
|---|---|
| `/app/segments` | Functional workspace chooser, but Retail and Logistics cards are marked SOON |
| `/app/admin` | Database-backed admin dashboard |
| `/app/marketplace` | Stub |
| `/app/logistics` | Stub |
| `/app/merchants` | Stub |
| `/app/settings` | Local theme toggle only; theme is not applied/persisted consistently |

### Restaurant workspace

| Route | Status |
|---|---|
| `/app/restaurant` | Local dashboard derived from the restaurant store |
| `/app/restaurant/menu` | Functional/local menu editing |
| `/app/restaurant/pos` | Hybrid and unsafe: writes an order to the shared backend, then updates local KDS state |
| `/app/restaurant/kitchen` | Functional/local order status workflow |
| `/app/restaurant/floor` | Functional/local table status workflow |
| `/app/restaurant/billing` | Functional/local display over restaurant orders |
| `/app/restaurant/staff` | Static sample data |
| `/app/restaurant/inventory` | Static hardcoded metrics and low-stock rows |
| `/app/restaurant/reports` | Static |
| `/app/restaurant/settings` | Static controls |

Restaurant menu, table, order, and KDS state starts from
`restaurant.store.ts` mock data and is not persisted. Restaurant POS calls the
generic supermarket-style `/api/orders` endpoint with menu IDs such as `m1`.
Those IDs do not match seeded inventory IDs, so the backend stores the order
but normally deducts no inventory. The kitchen receives the order only in the
current browser memory after the API call succeeds.

There is no cross-device KDS transport. A second browser or refreshed page
will not see restaurant orders.

### Pharmacy workspace

| Route | Status |
|---|---|
| `/app/pharmacy` | Functional/local dashboard derived from mock inventory |
| `/app/pharmacy/catalog` | Functional/local |
| `/app/pharmacy/inventory` | Functional/local |
| `/app/pharmacy/suppliers` | Static sample table; Add/Edit controls do not mutate data |
| `/app/pharmacy/pos` | Functional/local dispensing simulation |
| `/app/pharmacy/rx` | Functional/local prescription workflow |
| `/app/pharmacy/reports` | Static sample cards |
| `/app/pharmacy/staff` | Static sample list |
| `/app/pharmacy/procurement` | Mock shared procurement view |

Pharmacy inventory, batches, prescriptions, and dispensing are held in
`pharmacy.store.ts`. They reset on refresh and are not connected to SQLite.
Batch selection is described as FIFO but simply consumes array order. There is
no license validation, controlled-substance ledger, prescriber verification,
interaction checking, immutable dispensing audit, or server-side compliance
model.

The pharmacy manifest omits the implemented `/procurement` route, so users
cannot reach it from the pharmacy sidebar.

### Supermarket workspace

| Route | Status |
|---|---|
| `/app/supermarket` | Static/mock dashboard stats |
| `/app/supermarket/pos` | Functional/persisted core flow |
| `/app/supermarket/catalog` | Database-backed inventory/catalog display |
| `/app/supermarket/inventory` | Functional/persisted list and stock/procurement actions |
| `/app/supermarket/procurement` | Mock shared procurement list/create placeholder |
| `/app/supermarket/suppliers` | Database-backed list; add modal is not implemented |
| `/app/supermarket/offers` | Functional UI over mock service data |
| `/app/supermarket/staff` | Local/static interactive UI |
| `/app/supermarket/reports` | Mock service data |
| `/app/supermarket/settings` | Static navigation cards |

The core POS flow performs barcode lookup, creates an order, stores it in
SQLite, and refreshes inventory. Procurement from the inventory screen calls a
backend endpoint that immediately increases inventory and returns a synthetic
received purchase order. This is stock adjustment behavior, not a complete
procurement lifecycle.

### Retail workspace

| Route | Status |
|---|---|
| `/app/retail` | Static dashboard prototype |
| `/app/retail/procurement` | Mock shared procurement view |
| Manifest links: POS, catalog, inventory, pricing, customers, reports, settings | Broken navigation; no routes |

The Segments screen marks Retail as SOON and points its card to Marketplace,
even though a Retail dashboard route exists. The Retail manifest does not list
the implemented procurement route.

### School workspace

| Route | Status |
|---|---|
| `/app/school` | Static dashboard prototype |
| Manifest links: students, classes, attendance, fees, teachers, reports, settings | Broken navigation; no routes |

### Supplier workspace

`src/modules/commerce/supplier/` contains dashboard and orders views, but no
route or layout exposes them. They are orphaned code.

### Platform admin routes

| Route | Status |
|---|---|
| `/admin/users` | Database-backed list/create/update/status actions |
| `/admin/businesses` | Database-backed list/create/suspend/activate |
| `/admin/audit-logs` | Database-backed list/filter |
| `/admin/settings` | Database-backed settings/feature-flag UI |

Backend admin routes correctly require owner/admin roles. The frontend
`/admin` route only uses the generic authenticated `ProtectedRoute`, so a
non-admin can load the admin shell and trigger repeated 403 responses. The
server still protects the data.

## 3. Architecture

### Routing and workspace isolation

Routes are centralized in `src/views/routes.tsx` and lazy-load most pages.
Vertical layouts render navigation from manifests, but the route table is
manually duplicated. This duplication has already drifted:

- Retail and School manifests advertise unregistered routes.
- Pharmacy and Retail have registered procurement routes absent from manifests.
- Logistics is forced into the vertical registry as an empty object.
- Supplier views are not registered.

Workspaces are UI namespaces under `/app/<vertical>`. They are not isolated
deployments, services, databases, schemas, or bundles. All verticals share the
same SPA runtime, auth store, API client, and backend.

### Shared data versus isolated data

There are three distinct data patterns:

1. Shared persisted backend data:
   supermarket inventory/products/orders/suppliers and platform admin data.
2. Vertical-local Zustand memory:
   restaurant menu/orders/tables and pharmacy medicines/prescriptions.
3. Static or delayed mock data:
   dashboards, reports, offers, staff, school, retail, and procurement UI.

There is no coherent shared domain data layer across all workspaces.
`inventory.service.ts` directly writes into `useSupermarketStore`, which makes a
nominally core service supermarket-specific.

### Authentication

Frontend flow:

```text
LoginView
  -> auth.store.login(email)
  -> authApi.login()
  -> POST /api/auth/login
  -> token stored in localStorage
  -> Axios adds Authorization header
```

Backend behavior:

- Any email can log in.
- Unknown emails automatically create an account.
- There is no password, one-time code, email verification, invitation, SSO, or
  external identity provider.
- JWT expiry is 24 hours.
- Logout does not revoke a token.
- User `status` and `isLocked` are not checked during login or session access.
- The backend defaults missing tenant claims to `biz_main`.

Development behavior is especially misleading: when the API is unavailable,
`auth.api.ts` returns a mock admin and mock token. The UI appears logged in, but
subsequent real protected API calls fail because the mock token is not signed by
the backend.

### Real-time behavior

There is no:

- WebSocket server or client
- Server-Sent Events
- polling loop
- pub/sub broker
- event log
- offline mutation queue
- service worker sync
- conflict resolution
- location replication protocol

KDS is local Zustand state. Live orders are not live across devices.

### OneMesh Sync

“v7.0 with OneMesh Sync”, “Global Mesh”, instant location sync, and offline
sync appear in `LandingView.tsx`. No OneMesh implementation, interface,
dependency, server, protocol, storage layer, or roadmap milestone with that
name exists in code.

This is currently an unimplemented marketing claim and should be removed,
renamed as planned functionality, or backed by an explicit architecture and
delivery plan.

## 4. Data Layer

### Database

The backend uses SQLite via `better-sqlite3`, wrapped by Drizzle ORM.
`backend/src/db/client.ts` opens:

```text
./data/one-os.db
```

The path is relative to the process working directory, not to the source file
and not configurable. Starting the backend from different directories can
create or open different databases. Existing database artifacts in the
repository show this has already happened: ignored databases exist under
`backend/data/`, while additional database and backup files are present at the
`backend/` root.

WAL mode is enabled, which improves local concurrency, but does not make local
SQLite suitable for horizontally scaled stateless hosting.

### Tables

Drizzle defines:

- `users`
- `inventory_items`
- `products`
- `orders`
- `suppliers`
- `businesses`
- `system_settings`
- `audit_logs`

Important missing persisted concepts include:

- tenant memberships and workspace-specific roles
- locations
- restaurant menus/tables/KDS tickets
- pharmacy medicines/batches/prescriptions/dispensing records
- real purchase orders and purchase order lines
- staff and shifts
- promotions
- customers
- refresh/revocation sessions
- idempotency keys
- schema migration history
- workflow, MCP tool, or agent execution records

### Persistence across sessions

Persisted:

- backend users
- supermarket inventory/products/orders/suppliers
- businesses/admin settings/audit logs

Not persisted:

- onboarding changes made by the normal user flow
- restaurant state
- pharmacy state
- supermarket cart
- theme/sidebar configuration
- mock dashboards/reports/offers/procurement/staff data

### API/data integrity risks

The order endpoint trusts client-provided item names and prices. It does not
load canonical prices from the database, reject unknown items, enforce positive
integer quantities, or verify stock sufficiency. Inventory deduction clamps at
zero, so an order can oversell stock while still succeeding.

The fixed 10% tax is calculated independently in frontend and backend code.
Pharmacy uses 8% locally. There is no currency, jurisdiction, tax category, or
rounding policy.

The procurement endpoint accepts a quantity without requiring it to be
positive, does not create a purchase-order record, and immediately adjusts
stock.

IDs based on `Date.now()` can collide under concurrent requests. Orders add a
random suffix, but users, inventory items, and synthetic purchase orders do
not.

### Migrations

Schema management is split between:

- Drizzle schema declarations
- raw `CREATE TABLE IF NOT EXISTS` statements in `seed.ts`
- `migrate_phase2_5.ts`
- `migrate_phase3.ts`
- `migrate_admin.ts`

There is no tracked, ordered, repeatable migration command in
`backend/package.json`. Admin routes contain compatibility fallbacks for
columns/tables that may not exist, which confirms schema drift is expected at
runtime.

## 5. Infrastructure and Deployment

### Current serving model

Root `package.json`:

- `npm run dev`: Vite on `127.0.0.1:5174`
- `npm run build`: TypeScript project build plus Vite production bundle
- `npm run preview`: Vite preview

Backend `package.json`:

- `npm run dev`: `tsx watch src/index.ts`
- `npm run start`: execute TypeScript directly through `tsx`
- no production compile script

The production frontend bundle is emitted to `dist/`. `vercel.json` only
defines the build command and output directory.

### Configuration defects

- README documentation says frontend port 5173, while the actual dev script
  uses 5174.
- Backend default CORS allows 5173 and 3000, not the actual 5174 dev origin.
- The current backend environment file defines only `JWT_SECRET` and `PORT`, so
  it does not correct that CORS mismatch.
- `VITE_API_BASE_URL` defaults to localhost, which must be explicitly replaced
  for production.
- There is no SPA rewrite rule in `vercel.json`; direct navigation to nested
  BrowserRouter routes may return a platform 404 unless Vercel's detected Vite
  behavior supplies the fallback.
- There is no Dockerfile, committed `railway.toml`, infrastructure-as-code, or
  checked deployment manifest for the backend.

### `DEPLOYMENT.md` assessment

`DEPLOYMENT.md` declares “READY” and “ALL PASSED”, but that statement is not
supported by the current tree:

- lint fails
- backend standalone TypeScript compilation fails
- there are no CI checks
- the worktree has uncommitted changes
- no formal test script exists
- production backend hosting is documentation-only
- migration automation is absent
- authentication is not production-grade
- SQLite backup and restore are not tested as a launch gate

The document also includes mojibake/encoding corruption and references
`one-os.io`, which should be validated against current Qamar Technology domain
decisions.

### CI/CD and observability

No `.github/workflows` or alternative CI configuration was found.

Observability is limited to:

- Hono request logger
- console logs
- generated error request IDs based on time
- a health response that always reports running if the process responds
- admin “system health” values hardcoded to database `ok` and server `running`

There is no readiness check, database query health probe, metrics, tracing,
central log transport, error reporting service, uptime monitor, or alerting.

## 6. Gaps and Incomplete Areas

### Explicitly stubbed or marked for later

- Retail and Logistics cards: `SOON`
- Logistics registry manifest: placeholder cast
- Marketplace: structure-ready placeholder
- Logistics: structure-ready placeholder
- Merchants: structure-ready placeholder
- Shared procurement create form: “would go here”
- Supermarket Add Supplier modal: placeholder
- `core/services/auth.service.ts`: unused placeholder service
- Auth workspace relationship: TODO

### Broken or misleading routes

- Retail manifest links seven routes that do not exist.
- School manifest links seven routes that do not exist.
- Pharmacy and Retail procurement routes are missing from their manifests.
- Supplier views have no routes.
- New backend users receive `primaryWorkspace: "biz_main"`, which is a tenant ID,
  not a valid application route.
- Several onboarding categories intentionally map unrelated business types to
  Restaurant, Pharmacy, Retail, Supermarket, or School placeholders.

### Documentation drift

`HANDOVER.md` and `ARCHITECTURE.md` are materially more accurate than the older
`ONE_OS_HANDOVER.md` and `OVERNIGHT_LOG.md`, but all should be treated as
historical context rather than proof of current behavior.

Notable drift:

- `ONE_OS_HANDOVER.md` claims Supermarket lacks a store, but a store now exists.
- It documents an `/api/v1` pattern, while current endpoints use `/api`.
- `OVERNIGHT_LOG.md` says inventory/POS sync was next work, but a partial
  database-backed sync now exists.
- `DEPLOYMENT.md` says no pending changes, while the current worktree is dirty.
- Some docs state no Git metadata is present, but this workspace is a Git
  repository on `main`.
- Several files contain character-encoding corruption.

## 7. Security and Reliability Findings

### Critical

1. Authentication is identity assertion by email, not authentication.
   Anyone who knows an email address can sign in as that user. Unknown emails
   are auto-provisioned.

2. Onboarding and workspace assignment are not persisted.
   The product cannot reliably establish tenant membership or a durable primary
   workspace through its normal user flow.

3. Order integrity is client-controlled.
   Clients can submit arbitrary prices, names, and quantities. Stock is not
   reserved or validated and overselling succeeds.

### High

1. Tenant identity is conflated with `primaryWorkspace`.
   A route path is expected by the frontend while the backend uses the same
   field as `businessId`.

2. Legacy JWTs without a tenant silently receive `biz_main`.
   Rejecting missing tenant context is safer than assigning a shared default.

3. Restaurant POS persists orders to a schema designed for supermarket items,
   but its local IDs do not map to inventory. KDS state remains browser-local.

4. Development mock auth masks backend/CORS failures and creates sessions that
   cannot call protected APIs.

5. SQLite path depends on process working directory, risking split databases,
   incorrect backup targets, and accidental empty production databases.

6. There is no automated migration gate or migration history.

### Medium

1. JWTs in `localStorage` increase token exposure in an XSS incident.
2. Logout has no server-side revocation.
3. Locked/inactive users can still log in and restore sessions.
4. Rate limiting is in-memory, shared under `unknown-ip` when proxy headers are
   absent, trusts raw forwarded headers, and does not work across instances.
5. Error request IDs are time-only and can collide.
6. Admin frontend lacks a role guard, although backend RBAC prevents data
   access.
7. CORS defaults do not include the configured frontend dev port.
8. No idempotency protection exists for order creation.
9. No API schema validator or formal OpenAPI contract is present.
10. No pagination limits protect admin list endpoints.

## 8. Scale Readiness

### Current tenancy model

The application is nominally multi-tenant because operational tables include
`business_id` and several backend queries filter by the JWT business context.
It is not a complete multi-tenant product.

Missing foundations:

- organization/workspace membership table
- one user belonging to multiple businesses
- role per membership
- invitations and lifecycle
- location hierarchy
- platform-admin versus tenant-admin separation in the data model
- tenant-aware uniqueness constraints
- tenant isolation tests
- quotas/billing/subscriptions
- tenant deletion/export/retention

### First failure points at 100 concurrent users

Likely early problems:

1. SQLite write contention around orders, stock updates, audit writes, and admin
   mutations.
2. In-memory rate limits behaving differently after restart and across
   instances.
3. Single-process backend with no shared session/rate/event infrastructure.
4. Full-table admin and operational reads without pagination.
5. No connection/load testing or backpressure policy.
6. Duplicate orders from retries because no idempotency key exists.
7. Inventory races and overselling because stock sufficiency is not enforced.
8. Local KDS/pharmacy state diverging immediately between users and devices.
9. Local filesystem database and backups failing on ephemeral or multi-instance
   hosting.
10. Console-only diagnostics making production incidents difficult to trace.

At 100 mostly read-only users on one well-sized host, the shell may remain
responsive. At 100 operational users creating orders and adjusting stock,
correctness and write contention become the larger risk than frontend render
performance.

## 9. Verification Results

Commands run against the current working tree:

| Command | Result |
|---|---|
| `npm run build` | Passed; Vite production bundle generated |
| `npm run lint` | Failed: 66 errors and 1 warning |
| `cd backend && npx tsc --noEmit` | Failed with TS4023 for exported SQLite type |

The lint failures include backend `any` usage, unused variables, React purity
violations, direct global mutation in onboarding, and route-file Fast Refresh
violations.

No unit/integration test command exists in either package. There are ad hoc
verification scripts, but they are not wired into package scripts or CI and
were not treated as a reproducible test suite.

## 10. Recommended Remediation Plan

### Phase 0: Correct product claims and local reliability

1. Align README, `.env.example`, Vite port, and backend CORS.
2. Remove or label OneMesh, instant global sync, and offline claims as planned.
3. Reconcile manifests with actual routes and hide incomplete modules.
4. Remove development auth fallback from normal dev mode; make simulation an
   explicit isolated mode.
5. Make the SQLite path absolute/configurable.
6. Fix lint and backend TypeScript compilation.

### Phase 1: Identity, tenancy, and data integrity

1. Implement real identity: passwordless email OTP, invitations, or OIDC/SSO.
2. Add `organizations`, `workspaces/locations`, `memberships`, and
   membership-role tables.
3. Stop using `primaryWorkspace` as both route and tenant ID.
4. Persist onboarding transactionally through backend endpoints.
5. Reject inactive/locked users and support token revocation/rotation.
6. Validate requests with typed schemas.
7. Rebuild order creation around canonical server prices, positive quantities,
   stock checks, idempotency, and transaction-safe inventory changes.

### Phase 2: Consolidate the operational product

1. Choose one or two priority verticals.
2. Move Restaurant and/or Pharmacy state to explicit backend domain models.
3. Replace mock dashboard/report/procurement data with API-backed queries.
4. Add durable purchase orders, receiving, adjustments, and supplier linkage.
5. Add paginated APIs, consistent loading/error/empty states, and audit coverage.
6. Introduce versioned Drizzle migrations and a production migration command.

### Phase 3: Production operations

1. Add CI for install, lint, frontend build, backend type check, migrations, and
   tests.
2. Add backend unit/integration tests and frontend critical-flow tests.
3. Add structured logs, real request IDs, error reporting, metrics, and
   readiness checks.
4. Move SaaS production data to managed PostgreSQL, or formally constrain the
   product to one SQLite instance with a persistent volume and tested recovery.
5. Add deployment manifests, secret management, backup restore drills, and
   rollback verification.
6. Load-test order/inventory concurrency and tenant isolation.

### Phase 4: Real-time, offline, MCP, and agents

Only after the core data and permission model is stable:

1. Add a durable event model and real-time transport for KDS/live operations.
2. Design offline queues, synchronization, conflict policy, and location
   identity before claiming offline or mesh behavior.
3. Build read-only MCP tools over the same tenant-aware application services.
4. Add tool scopes, approval gates, audit records, and workflow execution
   records before enabling agent writes.

## Final Assessment

One OS has a credible modular shell and a useful persisted supermarket/admin
prototype. Its structure is good enough to continue building on, but the
product surface currently overstates the depth of several verticals and the
existence of synchronization/AI capabilities.

The next milestone should not be another vertical. It should be a trustworthy
core: real identity, durable onboarding and tenancy, canonical order/inventory
rules, versioned migrations, automated tests, and deployable backend
operations. Once that foundation is real, Restaurant or Pharmacy can be made
deep and multi-user without multiplying the current inconsistencies.
