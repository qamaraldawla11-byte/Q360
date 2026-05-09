# One OS Architecture

One OS is currently a modular web application with a React/Vite frontend and a Hono/SQLite backend. Its existing architecture is strongest as a vertical business application shell: shared routing, authentication, admin controls, vertical manifests, and commerce workflows are already in place. The intended platform direction is to turn this shell into an AI operating system for agents, MCP servers, workflow automation, and enterprise applications.

## High-Level System Architecture

```text
User Browser
  |
  | React + Vite SPA
  | - public pages
  | - auth/onboarding
  | - app verticals
  | - admin UI
  |
Axios HTTP client
  |
  | REST JSON over /api
  |
Hono Backend API
  |-- auth routes
  |-- inventory routes
  |-- product/order routes
  |-- supplier/procurement routes
  |-- admin routes
  |
Middleware
  |-- CORS
  |-- request logging
  |-- in-memory rate limiting
  |-- JWT auth
  |-- role checks
  |
Drizzle ORM
  |
SQLite database
```

## Frontend Architecture

The frontend is a Vite single-page application. `src/App.tsx` initializes the auth session, wraps the app in `GlobalErrorBoundary`, and delegates route rendering to `src/views/routes.tsx`.

Routing is centralized in `src/views/routes.tsx` and uses React Router route objects with lazy-loaded modules. Public routes include `/`, `/pricing`, `/docs`, `/support`, and `/ai`. Protected routes include `/app/*`, `/onboarding/*`, and `/admin/*`.

Authentication state lives in `src/store/auth.store.ts`. The store restores JWT sessions from `localStorage`, calls `/auth/session`, and exposes login/logout/update methods. `ProtectedRoute` enforces login, onboarding completion, and workspace redirection.

API access is centralized through `src/api/http.ts`, an Axios singleton that sets the API base URL, attaches `Authorization: Bearer <token>`, applies a 10-second timeout, and logs the user out on `401` responses.

## Backend Architecture

The backend is a Hono application mounted in `backend/src/index.ts`. It loads environment variables using `dotenv/config`, configures logging, rate limiting, CORS, health check output, route modules, a 404 handler, and a global error handler.

Current mounted routes:

- `/api/auth` for login, logout, and session.
- `/api/inventory` for inventory CRUD and stock adjustments.
- `/api/products/search` for barcode product lookup.
- `/api/orders` for POS order creation and lookup.
- `/api/suppliers` for supplier listing and procurement orders.
- `/api/admin` for admin users, businesses, audit logs, settings, and stats.

JWT authentication and role checks live in `backend/src/middleware/auth.ts`. The backend exits at startup if `JWT_SECRET` is not set.

## Data Layer

The database layer is SQLite through `better-sqlite3`, wrapped by Drizzle ORM. The main database path is currently hardcoded as `backend/data/one-os.db` when the backend is started from `backend/`.

Primary tables defined in `backend/src/db/schema.ts`:

- `users`
- `inventory_items`
- `products`
- `orders`
- `suppliers`
- `businesses`
- `system_settings`
- `audit_logs`

Several tables include `businessId`/`business_id` fields, which indicates early multi-tenant readiness. Tenant isolation is enforced in several operational routes by filtering queries with the JWT business context. Admin routes are broader by design.

## Folder-by-Folder Explanation

`src/api/` contains the frontend HTTP client and typed API wrappers. This is the integration boundary between React modules and backend routes.

`src/components/` contains shared UI elements and the global error boundary. `src/components/shared/` includes reusable building blocks such as `ModuleShell`, `PageHeader`, and `StatCard`.

`src/core/services/` contains frontend service classes for inventory, orders, procurement, promotions, stats, and auth. These services coordinate API calls and selected Zustand store updates.

`src/core/mocks/` contains mock data still used by parts of the frontend. This is useful for demos but should be clearly separated from production data paths over time.

`src/layouts/` contains shell layout components including main app layout, admin layout, vertical layout, and sidebars.

`src/modules/` contains feature and vertical modules. Important groups include public pages, authentication, onboarding, admin dashboard, marketplace/logistics/merchants/settings, and vertical workspaces under `commerce/` and `education/`.

`src/modules/commerce/*/manifest.ts` files define vertical metadata and navigation. These manifest files are registered in `src/verticals/index.ts`.

`src/store/` contains global Zustand stores for auth, business, and configuration.

`src/types/` contains shared frontend TypeScript types for business entities, inventory, procurement, users, suppliers, and vertical manifests.

`backend/src/routes/` contains backend route modules.

`backend/src/db/` contains the Drizzle schema, SQLite client, seed script, and migration scripts.

`backend/src/middleware/` contains auth, role checks, and rate limiting.

`backend/src/scripts/` contains operational scripts such as database backup.

## Module Responsibilities

Public modules present the external product surface. They should remain brand-consistent with One OS and Qamar Technology.

Onboarding modules collect user/business context and route users into the correct workspace.

Vertical modules provide domain-specific workspaces. Restaurant, pharmacy, supermarket, retail, and school each have dedicated layouts or dashboards. Supermarket is currently the deepest backend-integrated vertical.

Admin modules provide platform administration for users, businesses, audit logs, settings, and system health.

Core services abstract common frontend operations and should increasingly become the primary path for API-backed data access.

Backend routes own validation, auth enforcement, tenant filtering, persistence, and audit logging for server-side operations.

## Data Flow

Login:

```text
LoginView -> auth.store.login -> authApi.login -> POST /api/auth/login
Backend creates or finds user -> signs JWT -> frontend stores auth_token -> protected routes unlock
```

Session restore:

```text
App startup -> auth.store.initSession -> GET /api/auth/session
JWT middleware validates token -> user returned -> app routes render
```

Inventory:

```text
Vertical view -> inventoryService -> GET /api/inventory
Auth middleware extracts businessId -> backend filters inventory_items -> frontend updates store
```

POS order:

```text
POS view -> ordersService.processSale -> POST /api/orders
Backend transaction inserts order -> deducts inventory -> writes audit log -> frontend refreshes inventory
```

Procurement:

```text
Procurement view -> procurementService -> POST /api/suppliers/procurement/orders
Backend validates item and role -> increases stock immediately -> writes audit log
```

Admin:

```text
Admin UI -> adminApi -> /api/admin/*
JWT auth + owner/admin role check -> database operations -> audit log where implemented
```

## Integration Points

Internal frontend/backend integration uses REST JSON through the Axios client. The configured base URL is `VITE_API_BASE_URL`.

Authentication uses bearer tokens in `localStorage`. This is simple and workable for internal development, but production should review token storage, refresh, expiry, revocation, and cross-site scripting risk.

Deployment integration is currently planned around Vercel for the frontend and a Node-capable cloud service with persistent storage for the backend. `DEPLOYMENT.md` references Railway and Vercel as one deployment path.

Shajara is a separate flagship application. Future Shajara integration should be treated as an external product integration, not a replacement for One OS naming or architecture.

## MCP Integration Strategy

Assumption: MCP is a strategic target for One OS, but this repository does not currently contain a production MCP server, MCP client registry, tool permission model, or agent runtime.

Recommended MCP architecture:

- Add an `mcp/` or `backend/src/mcp/` boundary for MCP server definitions, tool registration, and transport configuration.
- Model each enterprise capability as a tool provider with clear permissions, input schemas, output schemas, and audit logging.
- Keep MCP tools API-first and tenant-aware. Every tool call should resolve a tenant, actor, role, and audit context.
- Treat vertical capabilities as tool domains: inventory, orders, procurement, admin, workflows, documents, and external integrations.
- Add an agent orchestration layer above MCP tools rather than embedding agent logic inside UI views.
- Store tool invocation logs, workflow runs, approval decisions, and agent memory separately from operational business tables.
- Build a connector strategy for future systems: Shajara, CRM, ERP, email, calendars, documents, payments, and analytics.

## Strengths

- Clear modular direction with vertical workspaces.
- Central route map and lazy loading.
- Manifest-driven vertical registry.
- Backend routes are already separated by business capability.
- JWT secret enforcement prevents accidental insecure backend startup.
- Business/tenant fields are present in key operational tables.
- POS order creation uses a SQLite transaction for order and inventory updates.
- Audit logging exists for several critical operations.
- Backup script and deployment notes already exist.

## Weaknesses and Risks

- No Git metadata is present in the audited folder, so change history and branch state are unavailable locally.
- SQLite is file-based and needs careful handling for production scaling, concurrent writes, backups, and cloud filesystem persistence.
- Database path is hardcoded rather than environment-configurable.
- Migration state appears manual and partially inconsistent; admin routes include fallback warnings for missing columns.
- Authentication is email-only with auto-user creation and no password, SSO, invite, or verification flow.
- JWTs are stored in `localStorage`, increasing impact if XSS occurs.
- Rate limiting is in-memory and keyed by `x-forwarded-for`; it will reset on restart and will not coordinate across instances.
- Some frontend modules still rely on mock/static data.
- No formal test suite is defined in package scripts.
- No production MCP or agent orchestration layer exists yet.
- Multi-tenancy is emerging but not yet a complete tenant model with memberships, roles per workspace, invitations, billing, quotas, and cross-tenant test coverage.

## Deployment Readiness

Frontend deployment readiness is reasonable for a Vite SPA if environment variables are set and API CORS is configured.

Backend deployment readiness is partial. The API can run under Node with persistent SQLite storage, but production should address migrations, database backups, observability, secrets, rate limiting, tenant isolation, and rollback procedure before customer use.

For multi-instance cloud deployments, move from local SQLite to a managed database or use a carefully designed single-writer deployment with persistent volumes and operational guardrails.
