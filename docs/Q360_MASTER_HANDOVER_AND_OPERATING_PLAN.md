# Q360 Master Handover and Operating Plan

**Status:** Authoritative operating reference for ChatGPT Work and Codex  
**Baseline date:** 11 July 2026  
**Authority:** Current repository evidence, Q360 current-state reporting, Railway deployment verification, and relevant Q360 documentation. Where an older report conflicts with newer verified evidence or this document, use this document and then re-verify the repository before acting.

## 1. Q360 product definition

Q360 is a modular, multi-tenant business operating system. It combines shared business capabilities with workspace-specific operational flows in one application and one repository. Restaurant is the first real operational workspace and the current beta proving ground. Commerce is the next shared operational foundation; Services, offline operation, Pharmacy persistence, and broader AI assistance remain later phases.

Q360 is not a collection of separately deployed vertical applications. Restaurant, Pharmacy, Retail, Supermarket, Personal, and future templates are route/module compositions inside the same product. Stable shared capabilities should be reused across workspace templates without flattening valid Restaurant-specific behavior.

## 2. Current technology stack

- Frontend: React 19, TypeScript 5.9, Vite 7, React Router 7, Zustand 5, Axios, Lucide, and CSS.
- Backend: Node.js, TypeScript, Hono 4, and `@hono/node-server`.
- Data: PostgreSQL through Supabase, accessed with Drizzle ORM and the `postgres` driver.
- Authentication: email OTP, JWT bearer sessions, and Resend-backed email delivery.
- Testing: ESLint, TypeScript builds, Playwright browser tests, and backend verification scripts.
- Hosting: Vercel frontend and Railway backend.

## 3. Current repository and deployment locations

- Authoritative local repository: `D:\VS CODE App\Q360`
- GitHub: `qamaraldawla11-byte/Q360`
- Frontend deployment: Vercel
- Backend deployment: Railway
- Database: PostgreSQL through Supabase
- Railway deployment sequence: build, guarded `db:push`, application start, then `/health` verification.

Do not treat older One OS handovers, another checkout, a preview folder, or a deployment artifact as authoritative source code.

## 4. Verified completed work

- The frontend/backend modular application foundation, protected routing, tenant-aware API boundary, and PostgreSQL/Drizzle data layer exist.
- Email OTP authentication and JWT session handling exist.
- Stable `businessId` tenant identity is separated from workspace route values and has focused verification coverage.
- Tenant filtering, role-based access patterns, and audit-log foundations exist.
- Restaurant owner-compatible authorization is implemented without removing established role checks.
- Restaurant has persistent menu, table, order, order-item, KDS ticket, payment, setup, reporting, timing, and lifecycle foundations.
- Restaurant order progression, kitchen ready flow, cancellation controls, table release rules, and payment timing behavior have been implemented.
- Restaurant payment creation is transactional; duplicate payment is rejected with HTTP `409` and must not create another payment.
- Shared Customers and Quotes foundations exist, including tenant-scoped backend persistence and frontend operational views.
- Railway `db:push` succeeded.
- The Railway application started successfully.
- Railway `/health` returned HTTP `200`.

## 5. Partially completed work

- Restaurant is the strongest operational path, but the current lifecycle changes still require controlled staging verification through the real deployed frontend, backend, database, OTP flow, and browser.
- Audit logging exists but coverage should be reviewed across all Restaurant lifecycle mutations.
- Monitoring, structured alerting, backup/restore rehearsal, security headers, and production-grade rate limiting are not yet complete.
- Customers and Quotes have shared foundations, but their complete quote-to-order-to-invoice operational chain is not finished.
- Commerce is incomplete. Products, inventory, generic orders, suppliers/procurement, Customers, and Quotes provide pieces of the foundation, but the module is not yet a complete business workflow.
- Shared Invoices do not yet exist. Generic payment settlement and payment follow-up are also incomplete.
- Offline architecture remains planned; there is no durable IndexedDB operation queue, conflict model, or safe sync implementation.
- Pharmacy is preview-only and remains mock/local-state oriented rather than a production-persistent regulated workflow.
- Personal, Retail, and Supermarket contain useful UI and shared capability reuse, but some workflows remain static, browser-local, or incomplete.

## 6. Protected architecture and behavior

The following are regression-protected. They may be changed only by an explicit, narrowly scoped task with evidence, migration impact, tests, and Work review:

- Stable `businessId` tenant identity; never use a route, segment, template, or workspace path as a tenant key.
- Authentication and OTP behavior, secret handling, JWT validation, and session protection.
- Tenant isolation on every read, write, relation, export, verification script, and future offline queue.
- Role-based access and Restaurant owner-compatible authorization.
- Audit-log integrity and actor/tenant attribution.
- Existing Restaurant routes, API contracts, onboarding destination, lifecycle, KDS/table behavior, cancellation rules, and verification gates.
- Payment integrity: transactional recording, valid lifecycle timing, single-payment enforcement, and duplicate-payment HTTP `409`.
- Server authority for money, final payment state, stock, and irreversible lifecycle transitions.

No generic Commerce refactor may silently alter Restaurant tables, endpoints, payment semantics, table release, or lifecycle behavior.

## 7. Dirty and untracked file boundaries

The following current work is protected and must not be overwritten, cleaned, moved, deleted, staged, committed, or included in unrelated task scope:

- `src/modules/public/LandingView.tsx`
- `.codex/`
- `design-preview/`
- `design-preview-cline/`
- `design-preview-minimal-future/`
- Unrelated untracked documentation under `docs/` or elsewhere.

Before every Codex implementation, run a read-only status check and name the files that are in scope. If an in-scope file already has unrelated edits, stop and return the overlap to Work. Never use destructive Git cleanup, broad formatting, mass renames, or repository-wide rewrites to work around a dirty tree.

## 8. Restaurant lifecycle status

Restaurant is the first real operational workspace and the release gate for Q360's architecture. Its implemented lifecycle covers setup, menu/tables, POS order creation, kitchen flow, ready/delivered/paid progression, cancellation constraints, dine-in table occupancy/release, takeaway payment timing, reporting, and payment integrity.

The lifecycle is protected but not yet fully accepted as staging-proven. Acceptance requires a dedicated safe staging database and a real deployed-browser run that demonstrates:

1. OTP sign-in and Restaurant onboarding/re-entry.
2. Stable tenant data after logout and re-login.
3. Menu and table loading.
4. Dine-in order through kitchen, delivery, payment, closure, and correct table release.
5. Takeaway pay-before-service and pay-after-service behavior.
6. Valid cancellation behavior.
7. One persisted payment and duplicate-payment HTTP `409` with no second record.
8. Correct authorization, tenant isolation, audit/log evidence, and no regression in reports or timing data.

## 9. Commerce module status

Commerce is incomplete. Shared Customers and Quotes are the first persistent shared foundations. Existing products, inventory, generic orders, suppliers, and procurement capabilities can be reused, but they do not yet form a complete, production-ready Commerce lifecycle.

The target dependency chain is: Customer → Quote → Order → Invoice → payment follow-up. Shared Invoices do not yet exist, so Q360 must not claim a complete quote-to-cash workflow or generic payment settlement. Build shared modules as tenant-scoped capabilities consumed by templates; do not create a new standalone Commerce application or duplicate Customer/Quote/Invoice models per vertical.

## 10. Deployment and testing status

- Railway: `db:push` succeeded, the app started successfully, and `/health` returned HTTP `200`.
- Vercel: the configured frontend host; end-to-end staging acceptance must confirm the deployed frontend points to the intended Railway API and the backend permits the exact Vercel origin.
- Database: PostgreSQL through Supabase. Database identity must be proven as staging before any test that creates, updates, deletes, seeds, or changes schema.
- Builds and static checks have established local verification paths for frontend and backend; rerun only as required by the task.
- Backend scripts provide focused verification for tenant identity, OTP, Restaurant, Restaurant service flow, setup, Customers, Quotes, and other foundations.
- Playwright is mocked and does not prove real backend persistence. A passing Playwright suite is a frontend regression signal, not staging acceptance.
- Real staging acceptance requires deployed-browser evidence plus server/database verification. Record commit/version, environment, timestamp, sanitized results, failures, and rollback decision.

## 11. Current technical risks

1. A successful health check proves process availability, not correct end-to-end Restaurant behavior or correct frontend/API/database wiring.
2. Running schema or lifecycle verification against an unproven database could alter beta or production data.
3. Mocked Playwright coverage can create false confidence about persistence, tenant isolation, OTP delivery, and deployment configuration.
4. Commerce can fragment if new modules duplicate existing tenant, customer, product, inventory, order, or quote foundations.
5. Missing shared Invoices blocks a truthful quote-to-cash claim.
6. Offline writes would risk duplicate orders, cross-tenant sync, stock conflicts, and false payment state until idempotency and conflict handling exist.
7. Pharmacy mock data could be mistaken for real operational or regulated persistence.
8. Audit, monitoring, backup/restore, security headers, and distributed rate limiting require further production hardening.
9. Dirty/untracked work may be accidentally overwritten or swept into unrelated changes.
10. Older documentation contains obsolete SQLite/One OS assumptions; relying on it without checking current code can reverse completed architecture work.

## 12. Current product priorities

1. Accept Restaurant on a controlled staging environment.
2. Close any staging-discovered Restaurant correctness, authorization, persistence, or observability issue without broad refactoring.
3. Establish minimum beta operations: monitoring, incident notes, backup/restore ownership, and release evidence.
4. Complete the shared Commerce operational spine, beginning with Invoices after confirming Customers and Quotes.
5. Add Services/Projects composition only after shared Commerce records are reliable.
6. Add low-risk offline foundations only after idempotent server APIs and conflict rules exist.
7. Keep Pharmacy preview-only until persistent, auditable pharmacy-specific models are deliberately designed.

## 13. Next 10 tasks in dependency order

1. Prove the target Supabase database is a dedicated, disposable/recoverable Q360 staging database and record the sanitized environment identity.
2. Run the documented Restaurant staging preflight: deployed version alignment, Railway/Vercel variables by name, CORS, health, database guard, backup/rollback readiness, and log access.
3. Run non-destructive deployed checks for Vercel load, Railway `/health`, API reachability, and real OTP delivery/login.
4. Run the guarded Restaurant backend verification set against staging and retain sanitized results, including tenant identity, lifecycle, and duplicate-payment `409`.
5. Complete the real-browser Restaurant lifecycle matrix for dine-in, takeaway pay-before-service, takeaway pay-after-service, cancellation, logout/re-login persistence, and role behavior.
6. Review staging logs, audit evidence, timing/report effects, payment count, and table state; resolve only verified defects and repeat the affected gates.
7. Publish a Restaurant staging acceptance decision and a one-customer beta runbook with rollback, support, monitoring, and backup ownership.
8. Audit the current Customers and Quotes foundations against the protected tenant/RBAC/audit conventions and close only concrete gaps.
9. Design and implement shared Invoices as the next missing Commerce dependency, with tenant-scoped API, audit, lifecycle, and Customer/Quote/Order links; keep generic payment settlement out of scope.
10. Prove the minimal Commerce chain Customer → Quote → Order → Invoice with real persistence and isolation before starting Services, Projects, offline sync, Pharmacy persistence, WhatsApp, or broader AI automation.

## 14. Work vs Codex responsibility split

**ChatGPT Work owns:** product intent, priorities, scope, acceptance criteria, risk decisions, environment authorization, customer impact, staging/production approval, review of Codex evidence, and the final accept/reject decision.

**Codex owns:** repository inspection, a narrow implementation plan, scoped code/document changes when explicitly authorized, preservation of protected boundaries, proportionate tests, exact result reporting, and early escalation of contradictions or unsafe environment identity.

Codex does not decide product direction, broaden scope, use real customer data, perform destructive operations, change databases, deploy, or perform Git publication unless the prompt explicitly authorizes that exact action.

## 15. Standard workflow: Work planning → Codex execution → Work review

1. **Work planning:** State the outcome, evidence, exact scope, protected areas, allowed operations, forbidden operations, acceptance criteria, tests, and expected handoff artifact.
2. **Codex execution:** Inspect first; report pre-existing status; work only in named scope; preserve architecture; run only authorized verification; stop on unsafe database identity, overlapping dirty work, or a material scope decision.
3. **Work review:** Compare the result with acceptance criteria; inspect changed files and test evidence; check protected behaviors and out-of-scope changes; accept, request a focused correction, or reject. Plan the next task only after the current result is resolved.

## 16. Standard Codex prompt template

```text
Q360 task: <single outcome>

Repository: D:\VS CODE App\Q360
Context/evidence: <relevant current report and verified facts>
In scope: <exact files/modules/behavior>
Out of scope: <explicit exclusions>
Protected behavior: businessId tenant identity; auth/OTP; tenant isolation; RBAC;
audit logs; Restaurant owner authorization/lifecycle; payment integrity and duplicate 409.
Protected dirty work: LandingView.tsx, .codex/, design-preview folders, unrelated untracked docs.

Allowed actions: <inspect / edit named files / run named non-destructive checks>
Forbidden actions: <database changes, deployment, Git stage/commit/push, destructive cleanup, etc.>
Acceptance criteria:
1. <observable result>
2. <regression condition>
3. <evidence required>

Required verification: <exact checks; state whether mocked, local, or real staging>
Deliver: outcome, files changed, checks/results, risks/assumptions, and recommended next task.
Stop and ask if database identity is unproven, dirty work overlaps, or scope must expand.
```

## 17. Standard Codex result review template

```text
Q360 Codex result review

Task/outcome: <summary>
Decision: ACCEPT / ACCEPT WITH FOLLOW-UP / REVISE / REJECT

Scope compliance: <pass/fail; unexpected files or operations>
Acceptance criteria: <criterion-by-criterion result>
Protected behavior: <tenant/auth/RBAC/audit/Restaurant/payment regression result>
Verification quality: <mocked/local/staging; what it does and does not prove>
Changed files: <reviewed list>
Dirty-boundary check: <preserved/issue>
Database/deployment/Git impact: <none or explicitly authorized evidence>
Risks and unresolved questions: <list>
Required correction: <smallest next change, if any>
Next task: <one dependency-ordered task>
```

## 18. Rules for parallel Codex tasks

- Parallelize only independent tasks with non-overlapping files, data, migrations, runtime services, and acceptance decisions.
- Give every task its own scope, protected list, branch/worktree strategy if authorized, and result review.
- Never parallelize two tasks that change shared schema, auth, tenant middleware, Restaurant lifecycle, payment behavior, central routing, module registry, or the same documentation.
- Only one task may own database schema work or staging mutations at a time.
- Read-only audits may run in parallel if they do not start/stop shared services or write artifacts into another task's scope.
- A task may not absorb another task's dirty files, fixes, tests, or commits.
- Merge/reconcile only after Work has reviewed each result and rerun shared regression gates on the combined state.

## 19. Weekly Q360 progress report format

```text
# Q360 Weekly Progress — <week/date>

Overall status: Green / Amber / Red
Current release target: <target>

Completed and verified:
- <outcome + evidence>

In progress:
- <owner + task + expected result>

Staging/deployment health:
- Frontend / backend / database / OTP / health / lifecycle

Quality and protection gates:
- Build, lint, focused scripts, Playwright limitation, real-browser checks
- Tenant isolation, RBAC, audit, Restaurant lifecycle, payment duplicate 409

Risks/blockers:
- <impact + owner + next action>

Dirty/untracked boundary status:
- <unchanged or exception>

Product decisions needed:
- <decision and deadline>

Next week, in dependency order:
1. <task>
2. <task>
3. <task>

Evidence links/reports: <documents, deployment run, screenshots/log references without secrets>
```

## 20. Immediate next task

Begin Restaurant staging verification using the existing lifecycle staging verification plan. First prove that the Supabase target is a dedicated Q360 staging database and that rollback/backup ownership is clear; then execute the guarded backend and real-browser lifecycle matrix against the deployed Vercel/Railway pair. Do not implement new Restaurant or Commerce behavior during verification. Record failures as evidence and return them to Work for separate, narrowly scoped fixes.

## Clear recommendation

**Begin Restaurant staging verification.** Railway schema deployment, startup, and health are already confirmed; another implementation prerequisite is not justified before the real Restaurant lifecycle is tested against the controlled deployed stack. The only mandatory preflight is proof that the database is safe, dedicated staging—not an additional product implementation task.
