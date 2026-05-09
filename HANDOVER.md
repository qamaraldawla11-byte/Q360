# One OS Handover

## Executive Summary

One OS is Qamar Technology's core AI operating system project. The current repository is a modular React/Vite frontend with a Hono backend and SQLite/Drizzle data layer. It already supports public pages, auth/session handling, protected routes, onboarding, vertical workspaces, admin surfaces, and several commerce workflows.

The project is best understood today as a strong modular business OS foundation. MCP servers, AI agent orchestration, full multi-tenant SaaS operations, and enterprise workflow automation are strategic goals that should be built on top of this foundation.

## Repository Overview

Frontend:
- `src/App.tsx` initializes auth and renders routes.
- `src/views/routes.tsx` defines public, protected, vertical, onboarding, and admin routes.
- `src/api/http.ts` centralizes Axios configuration and bearer-token handling.
- `src/store/auth.store.ts` owns session restore, login, and logout.
- `src/modules/` contains public pages, onboarding, admin, commerce verticals, education, marketplace, logistics, merchants, and settings.
- `src/verticals/index.ts` registers vertical manifests.

Backend:
- `backend/src/index.ts` creates the Hono server and mounts routes.
- `backend/src/middleware/auth.ts` enforces JWT validation and role checks.
- `backend/src/middleware/rateLimit.ts` provides a simple in-memory limiter.
- `backend/src/routes/` contains auth, inventory, orders, suppliers, and admin route modules.
- `backend/src/db/schema.ts` defines database tables.
- `backend/src/db/client.ts` opens SQLite and configures WAL mode.
- `backend/src/db/seed.ts` creates and seeds local tables.
- `backend/src/scripts/backup.ts` creates timestamped SQLite backups.

## Key Technical Decisions

- React/Vite SPA for fast frontend iteration.
- Central route definition with lazy-loaded modules.
- Zustand for lightweight client state.
- Axios singleton for API calls.
- Hono for a compact backend API.
- JWT bearer auth with backend-enforced `JWT_SECRET`.
- Drizzle ORM with SQLite for current persistence.
- Business/tenant context stored in JWT and filtered in operational routes.
- Vertical modules represented by manifests and dedicated layouts.
- Admin functionality separated under `/admin` and `/api/admin`.

## Current Strengths

- Clear modular vertical structure.
- Working backend API for core commerce flows.
- Audit logging exists for important mutations.
- Basic role-based restrictions exist.
- Database backup script exists.
- Public, app, onboarding, vertical, and admin routing are already separated.
- Frontend/backend integration path is understandable and centralized.

## Outstanding Issues

- No Git repository metadata exists in the audited directory.
- No formal test scripts are defined in root or backend package scripts.
- Database migrations are manual and need consolidation.
- SQLite path is hardcoded.
- Admin routes contain compatibility fallbacks for missing migration columns.
- Auth is development-grade: email login auto-creates users and lacks verification/SSO.
- JWTs are stored in `localStorage`.
- Rate limiting is in-memory and not suitable for multi-instance production.
- Several verticals are UI-first and not fully API-backed.
- MCP and AI agent orchestration are not yet implemented in code.
- Tenant model needs memberships, workspace-scoped roles, invites, and consistent enforcement.

## Recommended Onboarding Sequence

1. Read `README.md` for the project overview and repository map.
2. Read `SETUP.md` and run the frontend and backend locally.
3. Inspect `src/views/routes.tsx` to understand navigation and protected routes.
4. Inspect `src/store/auth.store.ts`, `src/api/http.ts`, and `backend/src/middleware/auth.ts` to understand session flow.
5. Inspect `backend/src/db/schema.ts` and `backend/src/db/seed.ts` to understand current data shape.
6. Inspect `backend/src/routes/` to understand API behavior.
7. Inspect one complete vertical, preferably `src/modules/commerce/supermarket/`, because it has the deepest backend integration.
8. Read `ARCHITECTURE.md` for system responsibilities, data flow, and MCP strategy.
9. Read `ROADMAP.md` before planning new work.
10. Read `DEPLOYMENT.md` before production deployment decisions.

## Guidance for Future AI Assistants

- Do not rename One OS.
- Do not modify Qamar Technology branding, qamartech.io references, product names, logos, or public terminology unless explicitly instructed.
- Treat Shajara as a separate flagship application that may integrate later.
- Before changing code, inspect the relevant route, service, store, and backend endpoint together.
- Keep documentation assumptions clearly labeled.
- For MCP or agent work, start with read-only tools and audit logging before write-capable automation.
- For multi-tenant work, verify every data access path has tenant context.
- For production work, prioritize migrations, secrets, backups, observability, and test coverage.

## Suggested Next Engineering Tasks

1. Add a tracked migration workflow and reconcile current schema drift.
2. Add backend tests for auth, RBAC, tenant filtering, inventory, orders, procurement, and admin.
3. Add frontend tests for protected routes, login, and core supermarket flows.
4. Replace development auth with invite/verification or enterprise SSO.
5. Formalize workspace membership and roles.
6. Add API contract documentation.
7. Build a read-only MCP proof of concept.
8. Add workflow and agent audit tables before enabling agent writes.

## Assumptions

- One OS remains the current official internal project name.
- Qamar Technology is the company owner and qamartech.io is the corporate domain.
- The current repository is the canonical One OS application codebase available in this workspace.
- MCP and AI agent orchestration are roadmap goals, not completed runtime capabilities in this codebase.
