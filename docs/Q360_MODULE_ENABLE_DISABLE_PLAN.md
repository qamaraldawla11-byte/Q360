# Q360 Module Enable/Disable Plan

## 1. Clear conclusion

Q360 should stay one modular codebase. The safest model is:

Business -> Workspace / Template -> Enabled Modules -> Optional Modules -> Preview Modules -> Shared Data -> Optional AI Support.

A workspace template, such as Restaurant, Retail, Pharmacy, or Services later, should define sensible defaults. Each business can then customize which optional modules are enabled without deleting data, changing tenant identity, or forking the app by sector. Disabling a module should hide the operational UI, stop new module-specific work, and preserve all existing tenant-scoped records for later recovery, reporting, or re-enable.

## 2. Current module/navigation reality in the codebase

The current app is primarily route-based with manifest-assisted SME navigation. It does not yet have a business-specific module enable/disable system.

- Route registration is centralized in `src/views/routes.tsx`. Restaurant, Pharmacy, Retail, Supermarket, School, Personal, admin, marketplace, logistics, merchants, settings, auth, onboarding, and public pages are registered statically.
- `src/layouts/AppShell.tsx` chooses `PersonalLayout` for `/app/personal` and `SmeLayout` for hardcoded SME workspace paths: Restaurant, Pharmacy, Supermarket, Retail, and School.
- `src/layouts/SmeLayout.tsx` imports workspace manifests directly and builds the sidebar from each manifest's `modules` array. This is manifest-based navigation, but the manifests do not enforce module states.
- `src/types/vertical.ts` defines `VerticalManifest` and `VerticalModule`. Modules currently have only `id`, `label`, `path`, and `icon`; there is no structured `enabled`, `disabled`, `preview`, or `locked` status.
- `src/verticals/index.ts` has a central registry for Restaurant, Pharmacy, Retail, Supermarket, School, and a placeholder Logistics manifest. This is a code-level registry, not tenant-specific configuration.
- `src/modules/core/SegmentsView.tsx` is the current Core Segments view. It hardcodes workspace cards. Restaurant is active; Pharmacy, Retail, Admin are shown as internal preview; Logistics, Marketplace, and Merchants are coming soon. These states are UI-only and not backend-enforced.
- `src/modules/onboarding/SubSegmentView.tsx` hardcodes business segment choices. Restaurant and Retail are active; Pharmacy, Auto Parts, Clinic, Services, Other, and Supermarket have coming-soon or internal-preview availability. Services currently points to `/app/personal` as a TODO, not a dedicated Services workspace.
- Personal exists through `/app/personal` routes in `src/views/routes.tsx`, with `src/components/personal/PersonalDashboard.tsx` and coming-soon stub views in `src/components/personal/PersonalStubViews.tsx`.
- Projects is not present as a production workspace or route in the current route table. It should be treated as a future shared optional module.
- Restaurant modules are route-based and manifest-based. `src/modules/commerce/restaurant/manifest.ts` includes Dashboard, POS / Dining, Kitchen, Menu, Floor / Tables, Inventory preview, Orders & Payments, Staff preview, Reports, and Settings.
- Retail / Commerce modules are route-based and manifest-based. `src/modules/commerce/retail/manifest.ts` includes POS, Product Catalog, Inventory, Customers, Quotes, Procurement, Reports, and Settings.
- Pharmacy modules are route-based and manifest-based. `src/modules/commerce/pharmacy/manifest.ts` includes Catalog, Inventory, Suppliers, Procurement, Dispensing, Prescriptions, Staff, and Reports. The current manifest description includes compliance language; future product language should avoid presenting Pharmacy as production medical/pharmacy compliance until validated.
- Supermarket is route-based and manifest-based in `src/modules/commerce/supermarket/manifest.ts`, with barcode POS, catalog, inventory, procurement, suppliers, offers, staff, reports, and settings.
- Supplier has a manifest in `src/modules/commerce/supplier/manifest.ts`, but it is not registered in `src/verticals/index.ts`, not included in `SmeLayout`, and not registered in `src/views/routes.tsx`. Current behavior is manifest-only/unused from the visible route system.
- Shared Customers exists as a shared UI module re-exported by Retail in `src/modules/commerce/retail/views/CustomersView.tsx` from `src/modules/commerce/shared/customers/CustomersView.tsx`.
- Quotes is backend-connected in `src/modules/commerce/retail/views/QuotesView.tsx` through `src/api/quotes.api.ts` and `src/api/customers.api.ts`.
- Backend routes are statically mounted in `backend/src/index.ts`: auth, inventory, orders/products search, suppliers, customers, quotes, admin, user, and restaurant.
- Backend authentication and tenant scope are enforced in `backend/src/middleware/auth.ts` using JWT `businessId`. `backend/src/utils/tenant.ts` protects stable tenant identity and rejects workspace route values as tenant IDs.
- Shared Customers and Quotes tables already exist in `backend/src/db/schema.ts` and are explicitly commented as shared Commerce and future Services foundations.
- Restaurant is backend-connected through `backend/src/routes/restaurant.ts`, with Restaurant lifecycle, payments, KDS, tables, menu, orders, reports/dashboard, and Business Pulse snapshot logic. These must not be changed by the module plan.
- Preview/coming-soon patterns are currently hardcoded labels, disabled cards, TODO paths, and stub views. They are not a unified module-state architecture.
- Mock-only behavior appears in older commerce services under `src/core/services/*` and mocks under `src/core/mocks/*`, especially for inventory/orders/procurement/stats used by Retail/Supermarket views.
- Unknown: there is no current tenant-specific module state source, no module settings API, and no backend module authorization middleware.

Current classification:

- Restaurant: route-based, manifest-based, static navigation, partly backend-connected; Inventory and Staff are preview-labeled; KDS/payments/lifecycle are backend-connected.
- Retail / Commerce: route-based, manifest-based, static navigation; Customers and Quotes are backend-connected; other retail commerce areas are mixed mock/service-based.
- Pharmacy: route-based, manifest-based, static navigation, preview/validation-needed product area; backend connection is unknown or limited from current inspection.
- Services: segment exists in onboarding only; currently coming soon and routed to Personal as a TODO; no dedicated Services workspace.
- Projects: not present as a current route/workspace; future shared optional module.
- Personal: route-based, static navigation, stub/coming-soon for invoices, clients, expenses, tasks, settings.
- Core Segments view: hardcoded workspace cards with UI-only disabled/preview states.
- Manifests: used for SME sidebar labels and paths, not for tenant-specific enablement.

## 3. Recommended module model

Introduce a future code-level module registry first, then tenant-specific module configuration later.

The model should include:

- Workspace templates: code-defined templates such as `restaurant`, `commerce`, `pharmacy`, and future `services`.
- Default enabled modules: modules each template starts with for a new business.
- Optional modules: supported modules that an owner/admin can enable or disable when the backend is ready.
- Hidden/disabled modules: modules hidden from normal navigation and blocked from creating new records.
- Preview modules: visible only as clearly labeled preview/suggestion surfaces; not production operational truth.
- Locked modules: required modules that cannot be disabled because they protect core flows, tenant safety, billing, auth, or workspace integrity.
- Module settings: small per-business settings, labels, and feature flags, not separate codebases.
- Business-specific configuration: tenant-scoped module status stored by stable `businessId` later.

Disabling a module must not delete existing data. It should hide the module from the mobile sidebar/module dock, stop new operational use, and keep existing records recoverable. Existing active flows must be handled with warnings and guardrails before disablement is allowed.

## 4. Shared modules

These modules should be shared across workspaces and customized through labels/settings rather than separate implementations.

- Customers: shared because Commerce, Services, Restaurant catering/accounts, and future Projects all need contacts. Labels can vary as Customers, Clients, Buyers, or Patients only after validation for sensitive sectors.
- Products: shared because Retail, Auto Parts, Water Pumps, Industrial Supplies, Wholesale, Pharmacy stock, and Restaurant menu/inventory all need sellable or stockable items. Labels can vary as Products, Parts, Items, Medicines, or Menu Items where safe.
- Inventory/materials: shared because Commerce tracks stock and Services tracks materials. Settings should customize units, reorder points, batch fields, and terminology.
- Quotes: shared because Services, Retail, Wholesale, Auto Parts, and Industrial Supplies need estimates before orders or invoices. Labels can vary as Quotes, Estimates, Proposals, or Job Quotes.
- Orders: shared because POS, B2B commerce, and services jobs need committed work or sales records. Settings should customize order type and status labels.
- Invoices: shared because most businesses need billing documents. Sector-specific tax or compliance behavior should be settings-driven only after validation.
- Payment status/follow-up: shared because restaurants, commerce, services, and wholesale all need unpaid/paid/follow-up status. Payment collection rules must remain separate from full payment processing until validated.
- Tasks: shared because Services, Projects, back office, and Restaurant duties need assignable work.
- Projects: shared optional module for multi-step work, not a separate top-level workspace. It can support installation, maintenance, renovation, engineering, repair, and larger commerce jobs.
- Documents: shared because quotes, invoices, job files, purchase records, and business documents apply broadly.
- Team/roles: shared because owner/admin/manager/staff permissions are cross-workspace concerns.
- Duties: shared because Restaurants use duties/shifts and Services use job duties/checklists. Labels can vary by sector.
- Notifications: shared because module alerts should use one notification model with module-specific content.
- Audit logs: shared because module configuration and sensitive actions need traceability.
- Dashboard: shared shell concept, customized by enabled modules and workspace template.
- Business Pulse later: shared read-only insight layer that reads permitted data from enabled modules.

## 5. Restaurant-specific modules

Restaurant should keep its current lifecycle protected. Module enablement must not rewrite orders, payments, KDS transitions, tenant identity, or table/order behavior.

- POS: core. Required for Restaurant operations and should stay enabled for Restaurant.
- Menu: core. Required by POS/KDS order item creation.
- Tables: optional for dine-in, disabled for takeaway-only. Disabling Tables must not delete table records or break existing dine-in orders.
- KDS: optional. Useful for kitchens, but small businesses may operate without a kitchen display. Disabling KDS while tickets are active should require warnings or blocking until tickets are cleared.
- Payments: core/specialized. Restaurant payments and payment status are part of the current lifecycle and must remain protected.
- Daily Report: core or locked reporting for Restaurant. It should read existing data and should not create operational records.
- Inventory: preview until backend-connected for Restaurant-specific stock behavior. It may reuse shared inventory later.
- Staff: preview until persistent staff management is ready.
- Shifts/duties: preview until persistent shifts/duties are ready.
- Settings: locked. Needed to view configuration and future module settings.

Examples:

- Dine-in Restaurant: POS, Menu, Tables, KDS, Payments, Daily Report, Settings enabled; Inventory/Staff/Shifts preview until ready.
- Takeaway-only Restaurant: POS, Menu, KDS optional, Tables disabled; table turnover and floor views hidden; historical table records preserved.
- Small owner/operator mode: POS, Menu, Payments, Daily Report, Settings enabled; Staff, Shifts, KDS, Inventory disabled or preview.
- KDS optional: Restaurant can create orders without showing kitchen navigation if the business does not use KDS, but existing KDS lifecycle must remain stable for businesses that do.
- Inventory preview: visible only as preview until Restaurant inventory is backend-connected and tested.
- Staff/Shifts preview: visible only as preview until data is persistent and role-safe.

## 6. Commerce and Services modules

Commerce and Services should share core modules through one codebase and one module registry. Workspace templates should provide defaults, not separate apps.

Retail shops, auto parts, water pumps, industrial supplies, wholesale, and online sellers should use Commerce defaults such as Customers, Products, Inventory, Quotes, Orders, Invoices, Payment Status, Documents, Reports, and Settings. Auto Parts may customize labels like Parts, Vehicle Fitment, or Buyers later without becoming a separate codebase.

Maintenance, installation, engineering, repair, cleaning, contractors, and renovation teams should use Services defaults such as Customers, Quotes, Materials, Tasks, Projects, Orders/Jobs, Invoices, Payment Status, Documents, Team/Roles, and Settings.

Shared modules:

- Customers: customer/client records.
- Quotes: estimates, proposals, and pre-order documents.
- Products/Materials: sellable products for Commerce and materials for Services.
- Orders: sales orders, job orders, or work orders.
- Invoices: billing documents generated after quotes/orders/jobs.
- Payment status: paid, unpaid, partial, overdue, follow-up.
- Tasks: assignments for service work and internal operations.
- Projects: optional shared module for multi-step jobs; it should not be a separate top-level workspace.
- Documents: attachments and generated PDFs later.

Projects should be enabled inside a Commerce or Services workspace when needed. It should not fragment Q360 into a Projects app.

## 7. Pharmacy module rules

Pharmacy can remain a separate template/workspace because its default labels, workflows, and risk level are different from general Retail. It should still use the same modular codebase and shared module concepts.

Do not describe Pharmacy as full production medical/pharmacy compliance until validated. Pharmacy stock can reuse shared product/inventory ideas for medicine/product records. Batch, expiry, controlled stock, dispensing, prescription, audit, and safety-sensitive rules may need pharmacy-specific settings and validation later before any production claims.

Until validated, Pharmacy should be treated as a preview or controlled internal workspace where medicine/product stock concepts are explored without claiming complete regulatory readiness.

## 8. Module states

- enabled: The module is available for the business. Frontend shows it in navigation and normal workflows. Backend allows authenticated, tenant-scoped, role-permitted operations. Data remains available. Q/Business Pulse may read permitted data from it.
- disabled: The module is hidden from normal navigation and cannot create new records. Backend should reject new write operations where module status applies, while preserving reads needed for recovery, reporting, or dependencies. Data remains available and recoverable. Q/Business Pulse may reference historical data only if permitted and must not treat the module as active.
- preview: The module may appear with clear preview labeling. Frontend must avoid production wording and should limit or block critical actions. Backend behavior depends on whether preview is mock-only, read-only, or controlled internal; it must not imply production readiness. Data remains available if any exists. Q may mention preview modules as suggestions, not active operational truth.
- locked: The module is required for the workspace or platform safety. Frontend shows it and disables owner/admin toggling. Backend does not allow disabling. Data remains available. Q/Business Pulse may read permitted data when the module is part of active workspace operation.

## 9. Data safety rules

Disabling a module must never delete data. Disabled modules should not create new records unless the module is re-enabled. Existing records must remain tenant-scoped by stable `businessId` and recoverable by owner/admin or support tooling.

Active operational flows should not be broken by disabling a module. High-risk disables must require warnings and, where needed, blocking conditions:

- Tables: warn or block if dine-in orders are active or tables are occupied.
- KDS: warn or block if kitchen tickets are open.
- Inventory: warn or block if stock adjustments, procurement, or offline stock operations are queued.
- Staff/Shifts: warn if active shifts, duties, or assignments exist.

Re-enabling a module should restore access to existing data and continue from the prior state where safe.

## 10. Backend authorization rules

Frontend hiding is not enough. A user can still call APIs directly, so backend authorization must enforce module status where appropriate.

Backend checks should layer:

- Authentication through existing auth middleware.
- Stable `businessId` tenant scope from JWT and server-side context.
- Role permission, especially owner/admin-only configuration changes.
- Module enabled status for module-specific write operations when the module system is implemented.
- Audit logging for module configuration changes later.

Protected areas that must not be changed by this plan:

- OTP authentication.
- Stable tenant identity and JWT `businessId`.
- `primaryWorkspace` compatibility and legacy workspace path handling.
- Restaurant lifecycle.
- Restaurant payments.
- KDS lifecycle.
- Railway deployment schema flow.
- Existing verification scripts.

## 11. AI / Business Pulse impact

AI is optional. Q360 must work without AI. Business Pulse should be read-only first.

Q and Business Pulse should reason only over enabled modules and permitted tenant-scoped data. Q may mention preview modules as suggestions, but not as active operational truth. Q must not enable or disable modules automatically. Sensitive actions require owner/admin approval.

Examples:

- If Inventory is disabled, Q should not create stock alerts as if inventory is active.
- If Tables are disabled, Q should not analyze table turnover.
- If Projects are enabled, Q can show delayed tasks, missing materials, overdue documents, or blocked milestones.
- If KDS is disabled, Business Pulse should not present delayed kitchen tickets as a current operational priority unless historical context is explicitly requested and permitted.

## 12. Minimum future database design

Do not implement this now. The smallest future database-backed model is a tenant-scoped module configuration table:

`business_modules`:

- `id`
- `businessId`
- `workspaceKey`
- `moduleKey`
- `status`
- `settingsJson`
- `createdAt`
- `updatedAt`

A module definition registry can start in code before becoming database-backed:

`module_definitions` or code-level registry:

- `moduleKey`
- `label`
- `description`
- `category`
- `defaultStateByTemplate`
- `dependencies`
- `riskLevel`

What can remain code-configured first:

- Module definitions.
- Template defaults.
- Labels, icons, descriptions, dependency metadata, and risk levels.
- Preview/locked classification.

What should become database-backed later:

- Per-business module status.
- Per-business module settings.
- Audit history of configuration changes.
- Owner/admin decisions and warnings acknowledged during high-risk changes.

## 13. Minimum future API design

Do not implement this now. The smallest future API should be:

- `GET /api/modules`: return modules available to the authenticated business, including template defaults, status, labels, risk level, dependencies, and preview/locked metadata.
- `PATCH /api/modules/:moduleKey`: update one module status or settings for the authenticated business.

Rules:

- Updates must be owner/admin-only.
- Requests must validate against allowed modules for the workspace template.
- Dependency checks must run before disabling or enabling modules.
- No endpoint should delete module data.
- Every status/settings change should create an audit log event.
- All reads and writes must be tenant-scoped by stable `businessId`, not request body workspace paths.

## 14. Offline impact

Future offline support must know module states before accepting offline work.

- The offline queue must know which modules are enabled for the business and workspace.
- Disabled modules should not accept new offline operations.
- Queued operations from a module disabled later need conflict handling on sync.
- Payments and stock remain high-risk offline areas.
- Module configuration should sync clearly before offline work begins.
- Do not recommend full offline payments at this stage.

For example, if Inventory is disabled while a device has queued stock adjustments, sync should require owner/admin review or a conflict state instead of silently applying the queued writes.

## 15. Risks and edge cases

- Disabling Tables while dine-in orders are active could orphan active table/order flows.
- Disabling KDS while tickets are open could hide work that kitchen staff still need to complete.
- Disabling Inventory while stock operations are queued could create stock mismatch or lost adjustments.
- Disabling Staff while shifts/duties exist could hide assignments and accountability.
- Re-enabling a module after months may reveal stale settings, old records, changed permissions, and outdated labels.
- Module dependencies need clear rules, such as Quotes requiring Customers and Projects often needing Customers, Tasks, Materials, and Documents.
- Data visibility must respect both module status and role permission.
- Too many module choices can confuse mobile users; templates should start simple and hide advanced toggles.
- Fake preview modules can look production-ready if labels, actions, and docs are not strict.
- Pharmacy wording can create compliance risk if preview concepts are described as validated production pharmacy compliance.

## 16. Recommended phased build order

1. Module registry and documentation only.
2. UI labels for active, preview, and coming-soon modules.
3. Read-only module settings page showing current enabled/preview modules.
4. Controlled enable/disable for one low-risk module after testing.

Do not build a module marketplace now.

## 17. Acceptance criteria per milestone

Milestone 1: Module registry and documentation only.

- Done: architecture document and optional code-level registry proposal are reviewed.
- Not done: no dynamic toggles, no database changes, no route changes, no API changes.
- Testing required: `npm run build`, `npm run lint`, `cd backend && npm run build`.
- Protected areas that must not change: LandingView, Customers, Quotes, Restaurant lifecycle, payments, KDS, tenant identity, schema, routes, deployment, dirty/untracked unrelated files.

Milestone 2: UI labels for active, preview, and coming-soon modules.

- Done: existing hardcoded preview/coming-soon language is made consistent where already visible.
- Not done: no backend authorization changes, no tenant-specific configuration, no module marketplace.
- Testing required: build, lint, mobile navigation smoke test, onboarding smoke test.
- Protected areas that must not change: Restaurant lifecycle, payments, KDS, tenant identity, current route registration, schema.

Milestone 3: Read-only module settings page.

- Done: owner/admin can view current template modules and statuses as read-only.
- Not done: cannot enable/disable modules yet, no data deletion, no schema change unless explicitly planned later.
- Testing required: build, lint, auth/role smoke test, mobile layout check.
- Protected areas that must not change: OTP, JWT `businessId`, `primaryWorkspace`, Railway schema flow, Restaurant operational APIs.

Milestone 4: Controlled enable/disable for one low-risk module.

- Done: one low-risk module can be toggled for one workspace after dependency, warning, audit, and tenant-scope checks are implemented and tested.
- Not done: no full marketplace, no bulk toggles, no high-risk Restaurant Tables/KDS/Payments toggles at first.
- Testing required: backend authorization tests, audit log check, role tests, tenant isolation tests, re-enable test, disabled-write rejection test.
- Protected areas that must not change: Restaurant lifecycle, payments, KDS, tenant identity/auth/deployment, existing verification scripts.

## 18. Final recommendation

The single safest first implementation task later is a documentation/code-registry task: define a read-only module definition registry in code that mirrors current manifests and labels each module as enabled, preview, disabled, or locked by template, without changing routes, schema, backend APIs, Restaurant lifecycle, tenant identity, LandingView, Customers, or Quotes.

Do not start with dynamic toggles. Do not build a module marketplace. Do not let AI enable or disable modules. Do not delete data when disabling modules.
