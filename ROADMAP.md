# One OS Roadmap

This roadmap reflects the repository state observed during the technical audit. It separates current implementation facts from strategic platform goals.

## Current State Assessment

One OS currently functions as a modular business application shell with a working React frontend and a Hono backend. The strongest implemented areas are routing, vertical workspace structure, authentication/session restoration, supermarket commerce flows, admin APIs, audit logging, and local SQLite persistence.

The system is not yet a full AI operating system platform. MCP, agent orchestration, workflow automation, multi-tenant SaaS controls, and enterprise deployment controls should be treated as near-future architecture work rather than completed capabilities.

## Immediate Priorities

1. Stabilize environment and setup documentation.
2. Ensure backend startup consistently uses a documented `.env` location and required `JWT_SECRET`.
3. Add a database migration strategy that can be run repeatedly and tracked safely.
4. Align seeded schema, Drizzle schema, and manual migration scripts.
5. Add automated tests for auth, inventory, orders, procurement, admin authorization, and tenant filtering.
6. Replace or clearly isolate mock data in production-facing flows.
7. Add typed request validation for backend payloads.
8. Add structured error responses and frontend error display patterns.
9. Confirm production domains, CORS origins, and Vercel/backend deployment targets.
10. Keep One OS naming, Qamar Technology context, and qamartech.io domain references consistent.

## Medium-Term Milestones

Platform foundation:
- Introduce a formal workspace/tenant membership model.
- Add role assignments per workspace instead of only global user roles.
- Add invitation, verification, and user lifecycle flows.
- Implement organization/business switching.
- Add billing/subscription readiness if One OS becomes SaaS.

Data and backend:
- Move to a managed relational database for SaaS production, or document a strict single-instance SQLite deployment model.
- Add versioned migrations through Drizzle Kit or an equivalent migration runner.
- Make database path configurable.
- Add OpenAPI or similar API contract documentation.
- Add request IDs, structured logs, and health/readiness endpoints.

Frontend:
- Standardize loading, error, empty, and permission states across modules.
- Convert vertical modules to data-backed services where currently static.
- Make module registration more manifest-driven so verticals can be added without editing a large central route file.
- Add test coverage for protected route behavior and critical vertical flows.

Security:
- Review token storage and session lifecycle.
- Add account verification or enterprise SSO.
- Replace in-memory rate limiting with a shared production limiter.
- Add audit coverage for all sensitive admin and data mutations.
- Add dependency and secret scanning to CI.

## MCP and AI Platform Milestones

MCP phase 1:
- Define MCP architecture boundaries.
- Create a server/tool registry concept.
- Add typed tool schemas for inventory lookup, order creation, procurement requests, audit lookup, and admin-safe read operations.
- Add per-tool authorization checks.
- Log every MCP tool invocation.

MCP phase 2:
- Add workflow execution records.
- Add human approval gates for risky actions.
- Add agent-to-tool permission scopes.
- Add connector adapters for external applications.
- Add internal developer docs for adding MCP tools.

Agent orchestration:
- Define agent personas by responsibility: operations, admin assistant, procurement assistant, support assistant, developer assistant.
- Keep agents API-first and auditable.
- Add sandboxing, rate limits, and approval policies before agents can write production data.

## Long-Term Platform Vision

One OS should become Qamar Technology's enterprise AI operating layer:

- A modular app platform for business verticals.
- An API-first backend for enterprise data and operations.
- An MCP-native tool and connector layer.
- A workflow automation engine.
- An AI agent orchestration environment with tenant-aware permissions.
- A deployment-ready SaaS platform.
- A future integration hub for Shajara and other Qamar Technology products.

## Risks to Track

- Schema drift between code, seed scripts, and deployed databases.
- Tenant leakage if every query is not consistently scoped.
- Premature agent automation before approval, audit, and permission models exist.
- SQLite operational limits under SaaS-scale concurrency.
- Inconsistent module quality as more verticals are added.
- Public-facing claims exceeding implemented capabilities.

## Recommended Next Sequence

1. Complete setup hardening and migrations.
2. Add tests for the backend critical path.
3. Finalize tenant and role model.
4. Convert vertical data flows from static mocks to API services.
5. Add API documentation.
6. Add CI checks.
7. Build MCP proof of concept for read-only tools.
8. Add write-capable MCP tools only after authorization and audit controls are in place.
