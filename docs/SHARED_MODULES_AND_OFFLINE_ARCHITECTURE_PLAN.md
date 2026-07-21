# Q360 Shared Modules and Offline Architecture Plan

## 1. Clear conclusion

- **Verified:** Q360 currently has two backend-connected operational foundations: the Restaurant beta flow under `backend/src/routes/restaurant.ts` with restaurant-specific tables in `backend/src/db/schema.ts`, and a generic Commerce slice for inventory, products, orders, and suppliers under `backend/src/routes/inventory.ts`, `backend/src/routes/orders.ts`, and `backend/src/routes/suppliers.ts`.
- **Verified:** Restaurant is the only current workspace with an end-to-end persistent order lifecycle, KDS status progression, payment transaction record, duplicate-payment rejection, table release behavior, dashboard calculation, tenant-scoped backend APIs, and verification gates. Evidence: `backend/src/routes/restaurant.ts`, `src/api/restaurant.api.ts`, `src/modules/commerce/restaurant/views/PosView.tsx`, `src/modules/commerce/restaurant/views/KitchenView.tsx`, `src/modules/commerce/restaurant/views/BillingView.tsx`, `backend/src/scripts/verify_restaurant_core.ts`, `backend/src/scripts/verify_tenant_identity.ts`, and `tests/e2e/03-restaurant-loop.spec.ts`.
- **Verified:** Retail and Supermarket contain reusable Commerce patterns, but their maturity is mixed: catalog, inventory, stock adjustment, barcode lookup, sale creation, and supplier lookup connect to generic backend persistence; dashboards, reports, purchase-order list/detail screens, offers, staff, settings, and several summary counters are mock-only or browser-state-only. Evidence: `src/core/services/inventory.service.ts`, `src/core/services/orders.service.ts`, `src/core/services/procurement.service.ts`, `src/core/services/stats.service.ts`, `src/modules/commerce/retail/store/retail.store.ts`, and `src/modules/commerce/shared/procurement/ProcurementView.tsx`.
- **Verified:** Pharmacy is unsafe to present as a real production workflow because medicine inventory, batches, prescriptions, dispensing, suppliers, reports, and staff are not backed by a pharmacy persistence model. Evidence: `src/modules/commerce/pharmacy/store/pharmacy.store.ts`, `src/modules/commerce/pharmacy/store/pharmacy.types.ts`, `src/modules/commerce/pharmacy/views/PosView.tsx`, `src/modules/commerce/pharmacy/views/PrescriptionView.tsx`, and `src/modules/commerce/pharmacy/views/SuppliersView.tsx`.
- **Verified:** Services exists as an onboarding segment and schema enum only, currently routed to Personal. It is not a workspace/template with persistent jobs, quotes, tasks, materials, invoices, or projects. Evidence: `backend/src/db/schema.ts`, `backend/src/routes/user.ts`, `src/modules/onboarding/SubSegmentView.tsx`, and `src/views/routes.tsx`.
- **Recommendation:** Do not build new vertical apps. Promote the generic Commerce backend slice into shared modules first, then add the smallest missing persistent entities needed for Commerce and Services: customers, quotes, generic invoices, projects, tasks, milestones, material allocations, document metadata, and payment follow-up state.
- **Recommendation:** Projects must become an optional shared module enabled by Commerce or Services templates, not a top-level workspace type.
- **Recommendation:** Offline-first should not start with payments, final stock mutations, or final payment confirmation. It should start with IndexedDB-backed drafts, selected order/task operations, recently viewed data, operation queues, idempotency keys, tenant-scoped records, server-confirmed sync status, retries, conflicts, and audit trails.

## 2. Current capability maturity map

### Workspaces

| Workspace | Classification | Evidence | Conclusion |
| --- | --- | --- | --- |
| Restaurant | Production-ready; Backend-connected and persistent | `backend/src/routes/restaurant.ts`, `backend/src/db/schema.ts`, `src/api/restaurant.api.ts`, `backend/src/scripts/verify_restaurant_core.ts`, `backend/src/scripts/verify_tenant_identity.ts`, `tests/e2e/03-restaurant-loop.spec.ts` | **Verified:** Current Restaurant production flow is the immediate beta product and should remain protected. |
| Retail | Backend-connected and persistent; Browser-state-only; Mock-only; Unsafe to expose externally | `src/modules/commerce/retail/views/CatalogView.tsx`, `src/modules/commerce/retail/views/InventoryView.tsx`, `src/modules/commerce/retail/views/PosView.tsx`, `src/modules/commerce/retail/views/CustomersView.tsx`, `src/modules/commerce/retail/store/retail.store.ts`, `src/core/services/stats.service.ts` | **Verified:** Retail can inform Commerce modules, but only inventory/products/orders are backend-persistent. Customers, sales history, and settings are browser-state-only. |
| Supermarket | Backend-connected and persistent; Mock-only; Browser-state-only; Unsafe to expose externally | `src/modules/commerce/supermarket/views/PosView.tsx`, `src/modules/commerce/supermarket/views/InventoryView.tsx`, `src/modules/commerce/supermarket/views/DashboardView.tsx`, `src/modules/commerce/supermarket/store/supermarket.store.ts`, `src/core/services/stats.service.ts` | **Verified:** Supermarket demonstrates barcode POS and inventory persistence, but payment wording is unsafe because generic orders do not create payment records. |
| Pharmacy | Browser-state-only; Mock-only; Not found; Unsafe to expose externally | `src/modules/commerce/pharmacy/store/pharmacy.store.ts`, `src/modules/commerce/pharmacy/store/pharmacy.types.ts`, `src/modules/commerce/pharmacy/views/PrescriptionView.tsx`, `src/modules/commerce/pharmacy/views/PosView.tsx`, `src/modules/commerce/pharmacy/views/SuppliersView.tsx`, `src/modules/commerce/pharmacy/manifest.ts` | **Verified:** Pharmacy must remain visibly limited until a real backend persistence model exists. |
| Personal | Mock-only; Not found | `src/components/personal/PersonalDashboard.tsx`, `src/components/personal/PersonalStubViews.tsx`, `src/views/routes.tsx` | **Verified:** Personal invoices, clients, expenses, and tasks are static/dashboard or coming-soon UI, not persistent operational modules. |
| Services | Not found; Mock-only | `backend/src/db/schema.ts`, `backend/src/routes/user.ts`, `src/modules/onboarding/SubSegmentView.tsx`, `src/views/routes.tsx` | **Verified:** Services is an enum/onboarding option that currently routes to `/app/personal`; there is no Services workspace implementation. |

### Shared Modules

| Shared module | Classification | Evidence | Conclusion |
| --- | --- | --- | --- |
| Customers | Browser-state-only; Not found | `src/modules/commerce/retail/store/retail.store.ts`, `src/modules/commerce/retail/views/CustomersView.tsx`, `backend/src/db/schema.ts` | **Verified:** Retail customers persist only through Zustand browser storage; no backend customer table or API exists. |
| Products | Backend-connected and persistent; Seed-data-only | `backend/src/db/schema.ts`, `backend/src/routes/inventory.ts`, `backend/src/routes/orders.ts`, `backend/src/db/seed.ts`, `src/modules/commerce/retail/views/CatalogView.tsx` | **Verified:** Products exist as backend rows tied to inventory creation and barcode lookup, but seeded product data is the only initial catalog. |
| Inventory / Materials | Backend-connected and persistent; Backend-connected but incomplete | `backend/src/db/schema.ts`, `backend/src/routes/inventory.ts`, `src/core/services/inventory.service.ts`, `scripts/e2e-verify.ts` | **Verified:** Inventory is tenant-scoped and persistent, but there is no materials allocation model, stock ledger, reservation model, or offline-safe stock mutation model. |
| Quotes | Not found | `backend/src/db/schema.ts`, `src/views/routes.tsx`, `src/modules/onboarding/SubSegmentView.tsx` | **Verified:** Quotes appear only as Services onboarding copy; no quote routes, tables, or screens were found. |
| Orders | Backend-connected and persistent; Backend-connected but incomplete | `backend/src/routes/orders.ts`, `backend/src/db/schema.ts`, `src/core/services/orders.service.ts`, `backend/src/routes/restaurant.ts` | **Verified:** Generic orders persist cart items and deduct inventory; Restaurant orders have a richer lifecycle. Generic orders lack status, customer, invoice, payment, fulfillment, and idempotency fields. |
| Invoices | Mock-only; Not found | `src/components/personal/PersonalDashboard.tsx`, `src/components/personal/PersonalStubViews.tsx`, `backend/src/db/schema.ts` | **Verified:** Invoices are static Personal dashboard data or coming-soon stubs; there is no invoice table or API. |
| Payment Follow-up | Backend-connected and persistent; Not found; Unsafe to expose externally | `backend/src/routes/restaurant.ts`, `backend/src/db/schema.ts`, `src/modules/commerce/supermarket/views/PosView.tsx`, `src/modules/commerce/retail/views/PosView.tsx` | **Verified:** Restaurant has persistent payment records and duplicate-payment rejection. Generic Commerce has order totals but no generic payment or follow-up state. |
| Tasks | Mock-only; Not found | `src/components/personal/PersonalStubViews.tsx`, `backend/src/db/schema.ts` | **Verified:** Tasks are a Personal stub only; no task table or API exists. |
| Projects | Not found | `backend/src/db/schema.ts`, `src/views/routes.tsx`, `src/modules/onboarding/SubSegmentView.tsx` | **Verified:** Projects is not implemented as a module, workspace, route, table, or store. |
| Team | Mock-only; Backend-connected but incomplete | `backend/src/db/schema.ts`, `backend/src/routes/admin.ts`, `src/modules/commerce/restaurant/views/StaffView.tsx`, `src/modules/commerce/supermarket/views/StaffView.tsx`, `src/modules/commerce/pharmacy/views/StaffView.tsx` | **Verified:** Users/businesses/admin exist, but vertical staff screens are static/mock and not a tenant team scheduling module. |
| Documents | Not found | `backend/src/db/schema.ts`, `src/views/routes.tsx`, `src/modules/public/DocsView.tsx` | **Verified:** Public documentation exists, but no operational document metadata/storage module exists. |
| WhatsApp Follow-up | Not found | `rg` over `src`, `backend`, `tests`, `scripts` | **Verified:** No WhatsApp workflow, route, client, or model was found. |
| Business Pulse | Mock-only; Not found | `src/components/sme/SmeDashboard.tsx`, `src/components/personal/PersonalDashboard.tsx`, `src/core/services/stats.service.ts` | **Verified:** Business Pulse/insights are UI placeholders or prop-driven display, not generated from structured operational data. |

## 3. Existing reusable backend capabilities

- **Verified:** Tenant identity is represented by `businessId` in JWT payloads and database rows. Evidence: `backend/src/middleware/auth.ts`, `backend/src/utils/tenant.ts`, `backend/src/db/schema.ts`, and `backend/src/scripts/verify_tenant_identity.ts`.
- **Verified:** Generic inventory supports tenant-scoped list, item read, stock adjustment with role requirements, item creation, status recalculation, product row creation on barcode, and audit logging. Evidence: `backend/src/routes/inventory.ts`, `backend/src/utils/audit.ts`, and `backend/src/db/schema.ts`.
- **Verified:** Generic products support tenant-scoped barcode lookup and are used by generic POS flows. Evidence: `backend/src/routes/orders.ts`, `src/core/services/orders.service.ts`, `src/modules/commerce/supermarket/views/PosView.tsx`, and `src/modules/commerce/retail/views/PosView.tsx`.
- **Verified:** Generic orders use server-side canonical product pricing, validate stock, reject oversell, persist orders, deduct inventory in a transaction, and log audit entries. Evidence: `backend/src/routes/orders.ts` and `scripts/e2e-verify.ts`.
- **Verified:** Generic suppliers support tenant-scoped read. Procurement "orders" currently auto-receive by increasing inventory immediately and return a generated `po_` id without a persisted purchase-order table. Evidence: `backend/src/routes/suppliers.ts`, `backend/src/db/schema.ts`, and `src/core/services/procurement.service.ts`.
- **Verified:** Admin users, businesses, audit logs, and global system settings are backend-connected and persistent. Evidence: `backend/src/routes/admin.ts`, `src/api/admin.api.ts`, `src/views/admin/UsersPage.tsx`, `src/views/admin/BusinessesPage.tsx`, `src/views/admin/AuditLogsPage.tsx`, and `src/views/admin/SettingsPage.tsx`.
- **Verified:** Feature flags are global system settings only: `MAINTENANCE_MODE`, `READ_ONLY_MODE`, and `DISABLE_SIGNUPS`. They are not tenant module entitlements. Evidence: `src/views/admin/SettingsPage.tsx` and `backend/src/db/schema.ts`.

## 4. Frontend-only, mock, seed, and unsafe capabilities

- **Verified:** Retail customers, sale history, and settings are browser-state-only through Zustand persist under key `one-os-retail`. Evidence: `src/modules/commerce/retail/store/retail.store.ts`.
- **Verified:** Pharmacy medicine inventory, batch data, prescriptions, stock updates, and dispensing are in-memory Zustand state initialized from mock arrays. Evidence: `src/modules/commerce/pharmacy/store/pharmacy.store.ts`.
- **Verified:** Supermarket dashboard and reports are mock-backed through `statsService`, not backend metrics. Evidence: `src/core/services/stats.service.ts`, `src/core/mocks/stats.mock.ts`, and `src/modules/commerce/supermarket/views/DashboardView.tsx`.
- **Verified:** Shared procurement list/detail/create screens use local mock purchase orders and demo submit text. Evidence: `src/modules/commerce/shared/procurement/ProcurementView.tsx`.
- **Verified:** Supermarket and Retail POS call generic order creation, not a generic payment endpoint; UI labels such as "Payment processed" are unsafe externally because no payment transaction, tender type, settlement confirmation, or duplicate-payment guard exists for generic orders. Evidence: `src/modules/commerce/supermarket/views/PosView.tsx`, `src/modules/commerce/retail/views/PosView.tsx`, and `backend/src/routes/orders.ts`.
- **Verified:** Personal invoices and financial insights are hard-coded arrays or coming-soon stubs. Evidence: `src/components/personal/PersonalDashboard.tsx` and `src/components/personal/PersonalStubViews.tsx`.
- **Verified:** Seed data initializes generic inventory, products, suppliers, Restaurant menu, and tables for `biz_main`; seed data is not proof of production workflow readiness. Evidence: `backend/src/db/seed.ts`.
- **Verified:** No service worker, IndexedDB layer, durable offline queue, operation idempotency table, sync status model, retry worker, or conflict-resolution code was found. Evidence: repository search over `localStorage`, `indexedDB`, `serviceWorker`, `sync`, `queue`, `retry`, and `idempot`.

## 5. Recommended shared module boundaries

- **Recommendation:** Customers should be a shared tenant module with contacts, company/person type, phone/email/address, source, notes, and optional workspace-specific metadata. Do not keep customer data in Retail browser storage.
- **Recommendation:** Products should own SKU/barcode/name/category/sale price and optionally link to Inventory / Materials. Current `products` and `inventory_items` are coupled by shared ids; future changes should be minimal and avoid a broad redesign until Commerce beta proves the workflow.
- **Recommendation:** Inventory / Materials should cover on-hand stock, minimum stock, units, supplier display, and later material allocation/reservation. Do not mix irreversible stock settlement with offline drafts.
- **Recommendation:** Quotes should become a shared pre-order document for Commerce and Services, with quote items, statuses, customer link, expiry, and conversion to order/job/invoice later.
- **Recommendation:** Orders should remain separate from payment settlement and invoices. Generic order creation needs status and idempotency before offline or external beta expansion.
- **Recommendation:** Invoices should be generic and tenant-scoped, with invoice items, status, due date, payment follow-up state, and links to customer/order/project where present.
- **Recommendation:** Payment Follow-up should track due/overdue/partial/paid intent and reminders. Final payment confirmation should remain server-confirmed and gateway/cash-control-aware.
- **Recommendation:** Tasks should be a small shared module for assignee/status/due date/related entity, usable by Services, Projects, and follow-up.
- **Recommendation:** Projects should be optional and shared, containing customer, status, milestones, tasks, material allocations, documents, quotes, orders, and invoices. Projects must never become a workspace type.
- **Recommendation:** Team should initially reuse users, roles, and business membership patterns; staff scheduling can wait until a real team model is needed.
- **Recommendation:** Documents should start as metadata linked to customer/project/quote/invoice with storage references, not full document authoring.
- **Recommendation:** WhatsApp Follow-up should not be built yet; add it only after customers, invoices, tasks, and consent/audit requirements exist.
- **Recommendation:** Business Pulse should read structured operational data only after the shared modules produce reliable records.

## 6. Commerce workflow foundation

- **Verified:** Existing Commerce foundation: products, inventory, barcode lookup, generic order creation, stock deduction, supplier lookup, and auto-received procurement are already present. Evidence: `backend/src/routes/inventory.ts`, `backend/src/routes/orders.ts`, `backend/src/routes/suppliers.ts`, `src/core/services/inventory.service.ts`, `src/core/services/orders.service.ts`, and `src/core/services/procurement.service.ts`.
- **Verified:** Existing Commerce gaps: backend customers, quotes, invoices, payment follow-up, persisted purchase orders, order status beyond creation, generic payment records, idempotency keys, and module-level tenant entitlements are not present. Evidence: `backend/src/db/schema.ts`, `backend/src/index.ts`, and `src/views/routes.tsx`.
- **Recommendation:** Commerce template should initially enable Customers + Products + Inventory + Quotes + Orders + Invoices, but implementation should start with the smallest persistent chain: Customers, Quotes, Orders, Invoices using the current inventory/products/orders tables where safe.
- **Recommendation:** Do not expose "payment processed" semantics for Commerce until generic payment records and payment confirmation rules exist. Use "order created" or "sale recorded" until settlement is modeled.
- **Assumption:** The water pumps supplier example needs products, inventory, quotes, orders, invoices, and optional Projects for installation jobs; this maps cleanly to shared modules once Customers, Quotes, Invoices, and Projects are added.

## 7. Services and Projects workflow foundation

- **Verified:** Services is currently only a segment value and onboarding route choice; it maps to `/app/personal`. Evidence: `backend/src/routes/user.ts` and `src/modules/onboarding/SubSegmentView.tsx`.
- **Verified:** Projects is not present as a backend model, route, frontend route, store, or manifest module. Evidence: `backend/src/db/schema.ts`, `src/views/routes.tsx`, and `src/verticals/index.ts`.
- **Recommendation:** Services should be a template that enables Customers + Quotes + Jobs/Orders + Tasks + Materials + Invoices, with Projects optional. It should not be a separate vertical app with duplicated customers, quotes, invoices, or tasks.
- **Recommendation:** Jobs can initially be represented as orders/projects depending on scope, but a dedicated "job" abstraction should not be added until the shared order/project boundary is validated.
- **Recommendation:** Projects should begin as optional grouping around customer work: status, project name, customer, due dates, milestones, tasks, material allocations, document metadata, linked quotes, and linked invoices.
- **Assumption:** The maintenance company example requires customers, quotes, jobs/tasks, materials, invoices, and optional projects; this should reuse the same Customers, Quotes, Inventory / Materials, Tasks, Projects, and Invoices modules as Commerce.

## 8. Pharmacy reality and safe future path

- **Verified:** Pharmacy has visible routes for catalog, inventory, suppliers, procurement, dispensing, prescriptions, reports, and staff. Evidence: `src/modules/commerce/pharmacy/manifest.ts` and `src/views/routes.tsx`.
- **Verified:** Pharmacy's core domain data is local mock state, not backend persistence. Evidence: `src/modules/commerce/pharmacy/store/pharmacy.store.ts` and `src/modules/commerce/pharmacy/store/pharmacy.types.ts`.
- **Verified:** Pharmacy procurement route reuses the shared mock procurement screen, while pharmacy suppliers are static local state. Evidence: `src/modules/commerce/pharmacy/views/ProcurementView.tsx`, `src/modules/commerce/shared/procurement/ProcurementView.tsx`, and `src/modules/commerce/pharmacy/views/SuppliersView.tsx`.
- **Recommendation:** Keep Pharmacy visibly limited until generic inventory, customers, invoices, and payment/follow-up are stable. Then add pharmacy-specific persistence deliberately: medicines, batches, expiry, prescriptions, dispensing events, and compliance audit entries.
- **Recommendation:** Do not build Pharmacy offline dispensing, prescription fulfillment, or stock mutation before server-side pharmacy audit and inventory models exist.
- **Assumption:** Pharmacy beta will need stricter auditability than generic Commerce because medicine batches, expiry, prescription status, and dispensing are regulated workflows in many markets.

## 9. Offline-first architecture recommendation

- **Verified:** No durable offline-first architecture exists today. Only auth/onboarding localStorage and some browser-state stores were found. Evidence: `src/store/auth.store.ts`, `src/api/http.ts`, `src/modules/onboarding/BusinessTypeView.tsx`, `src/modules/commerce/retail/store/retail.store.ts`, and repository search for IndexedDB/service-worker/sync/idempotency terms.
- **Recommendation:** Do not use localStorage as the durable primary offline database. Use IndexedDB for tenant-scoped local records, drafts, recently viewed records, and an operation queue.
- **Recommendation:** Every queued operation should include `tenantId/businessId`, `userId`, client operation id, idempotency key, entity type, payload, created-at timestamp, retry count, sync status, server response metadata, and last error.
- **Recommendation:** Server APIs that accept queued writes should support idempotency keys before they are allowed offline. This protects against duplicate orders after retry.
- **Recommendation:** Offline phase one should allow drafts, selected order drafts/submissions after idempotency exists, task changes, and recently viewed data. It should not allow offline-first payment settlement, irreversible stock adjustments, or final payment confirmation.
- **Recommendation:** Payments should remain online/server-confirmed because marking paid without gateway/cash-control confirmation can corrupt revenue, table release, invoices, and customer balances.
- **Recommendation:** Stock should remain server-authoritative because offline devices can oversell the same stock. If offline order capture is later needed, sync should reserve/confirm stock server-side and return conflicts when stock changed.
- **Recommendation:** Task/status conflicts should use server versions or updated-at checks and a conflict UI that shows both local and server values.
- **Recommendation:** Tenant safety must be enforced locally and server-side: all IndexedDB stores should be keyed by `businessId`, all queued operations should carry the intended `businessId`, and the server should reject mismatches against the JWT tenant.
- **Recommendation:** Data loss risk from browser storage should be acknowledged: IndexedDB is a resilience layer, not the system of record. The server remains the durable source after sync confirmation.

## 10. Minimal future data model

- **Verified:** Current schema already has users, OTP codes, inventory items, products, generic orders, restaurant menus/categories/items/tables/orders/order items/KDS tickets/payments, suppliers, businesses, system settings, and audit logs. Evidence: `backend/src/db/schema.ts`.
- **Recommendation:** Small future additions, after audit approval only, should be limited to: customers, quotes, quote items, generic invoices, invoice items, projects, tasks, milestones, material allocations, document metadata, payment status/follow-up state, and operation idempotency/sync metadata when offline work begins.
- **Recommendation:** Do not redesign the entire schema before validating the Commerce core workflow. Add the minimum tables needed to stop using browser-only customers and static invoices/quotes.
- **Recommendation:** Generic order additions should be narrow: status, customer id, optional quote id, optional invoice id, idempotency key, and timestamps. Avoid merging Restaurant order tables into generic orders before Restaurant beta validation.
- **Recommendation:** Audit logging should extend to new write modules using the existing `audit_logs` table pattern in `backend/src/utils/audit.ts`.

## 11. Safe migration path from current verticals

- **Recommendation:** Preserve all existing Restaurant routes and API contracts while building shared modules alongside them.
- **Recommendation:** Treat Retail/Supermarket as UI consumers of shared Commerce modules, not as sources of separate domain models.
- **Recommendation:** Move Retail customers from browser-state-only to a shared Customers backend only after the customer model and tenant tests exist.
- **Recommendation:** Replace mock procurement UI with persistent purchase/order or supplier-order records only when the Commerce core needs it; until then, keep it clearly non-production.
- **Recommendation:** Keep Pharmacy behind visible limitation language and do not promote its mock store into generic inventory without a pharmacy-specific persistence design.
- **Recommendation:** Keep Services routed away from a dedicated production workspace until Customers, Quotes, Tasks, Materials, Invoices, and optional Projects are real shared modules.

## 12. Five phased milestones

### Milestone 1: Shared Commerce core workflow

- **Exact scope:** Build a backend-persistent Commerce template path around Customers + Products + Inventory + Quotes + Orders + Invoices, starting with the smallest missing pieces: customers, quotes/quote items, generic invoices/invoice items, and safer generic order status/linking.
- **What is reused:** Existing generic `inventory_items`, `products`, `orders`, `suppliers`, auth middleware, `businessId` tenant scoping, audit logs, `inventoryService`, `ordersService`, `procurementService`, Retail catalog/inventory/POS UI patterns, and Supermarket barcode POS pattern.
- **What is not yet built:** Projects, Services jobs, offline queue, Pharmacy persistence, WhatsApp follow-up, Business Pulse, final generic payment settlement, and complex procurement lifecycle.
- **Database impact:** Add only customer, quote, quote item, generic invoice, invoice item, and narrow order-link/status fields if needed. Do not alter Restaurant tables.
- **API impact:** Add tenant-scoped customer, quote, invoice APIs and narrow generic order status/read APIs. Keep `/api/restaurant/*` unchanged.
- **Tenant/security concerns:** Enforce `businessId` from JWT on all reads/writes; add role checks for write operations; never accept client-supplied tenant identity as authority.
- **Test requirements:** Unit/API coverage for tenant isolation, customer CRUD, quote lifecycle, invoice lifecycle, order-to-invoice linking, inventory stock correctness, oversell rejection, and audit logging. Keep existing Restaurant E2E and backend verification gates passing.
- **Beta-readiness criteria:** A Commerce beta business can create a customer, product/inventory item, quote, order, and invoice with server persistence and tenant isolation, without claiming real payment settlement.
- **Main reason not to overbuild:** Commerce needs a reliable operational spine before optional projects, AI, WhatsApp, or offline complexity.

### Milestone 2: Shared Services plus Projects workflow

- **Exact scope:** Add Services template composition and optional Projects module using shared Customers + Quotes + Tasks + Materials + Invoices. Projects groups customer work, milestones, tasks, material allocations, documents, quotes, orders, and invoices.
- **What is reused:** Commerce Customers, Quotes, Inventory / Materials, Invoices, tenant auth, audit logs, shared layout/module navigation patterns, and Personal task/invoice labels as UI naming references only.
- **What is not yet built:** Dedicated service vertical app, offline sync, Business Pulse, WhatsApp, advanced scheduling, field workforce routing, and pharmacy-specific workflows.
- **Database impact:** Add projects, tasks, milestones, material allocations, and document metadata. Keep Projects optional and tenant-scoped.
- **API impact:** Add project/task/milestone/material/document metadata APIs with role checks and audit logs.
- **Tenant/security concerns:** Enforce tenant scope on every relation, especially documents and material allocations. Ensure Projects cannot expose records across tenants through linked customer/order/invoice ids.
- **Test requirements:** Tenant isolation tests for project-linked entities, task status updates, material allocation validation, quote-to-project-to-invoice flow, and route access.
- **Beta-readiness criteria:** A Services beta business can manage a customer, quote, project, tasks, materials, and invoice using shared modules without a dedicated Services vertical.
- **Main reason not to overbuild:** Services should prove shared module composition before specialized job boards, scheduling, or industry variants.

### Milestone 3: Offline foundation for selected low-risk actions

- **Exact scope:** Add IndexedDB local cache and operation queue for drafts, recently viewed data, selected order drafts/submissions after idempotency support, and task updates. Include idempotency keys, sync status, retries, server-confirmed sync, conflict handling, and tenant-scoped local records.
- **What is reused:** Existing auth/session, `businessId` tenant identity, shared module APIs from milestones 1 and 2, audit log patterns, and client API wrapper.
- **What is not yet built:** Offline payment settlement, final payment confirmation, irreversible stock adjustments, pharmacy dispensing, generic stock reservation across devices, and AI sync summaries.
- **Database impact:** Add minimal idempotency/sync metadata if required server-side. Do not change Restaurant payment behavior.
- **API impact:** Add idempotency handling to selected low-risk write APIs and return sync/conflict metadata.
- **Tenant/security concerns:** Queue records must include `businessId` and be rejected if JWT tenant differs. Local database must partition data by tenant and clear/switch safely on logout or tenant change.
- **Test requirements:** Duplicate retry tests, wrong-tenant queue rejection, offline-to-online sync tests, conflict tests, IndexedDB persistence tests, and data-loss recovery behavior.
- **Beta-readiness criteria:** A user can safely draft work offline, view cached records, sync low-risk operations, and see conflict/sync status without corrupting payments or stock.
- **Main reason not to overbuild:** Offline is a data integrity feature, not just a cache; starting with low-risk operations avoids damaging money, stock, and tenant isolation.

### Milestone 4: Pharmacy persistence foundation after generic inventory/invoice capabilities are stable

- **Exact scope:** Replace Pharmacy mock/in-memory data with backend persistence for medicines, batches, expiry, prescriptions, dispensing events, and pharmacy audit records, using stable generic inventory/invoice/customer foundations where appropriate.
- **What is reused:** Shared Customers, Inventory / Materials, Invoices, audit logs, tenant auth, and selected document metadata if prescription documents are needed.
- **What is not yet built:** Offline dispensing, pharmacy payment settlement, insurance/claims, regulatory integrations, AI medication advice, and complex procurement.
- **Database impact:** Add pharmacy-specific medicine, batch, prescription, prescription item, and dispensing event tables. Do not retrofit this into generic inventory alone.
- **API impact:** Add pharmacy-specific APIs with strict validation and audit logging. Keep existing generic APIs untouched where possible.
- **Tenant/security concerns:** Prescription and dispensing data need strict tenant isolation, role checks, auditability, and careful exposure controls.
- **Test requirements:** Prescription lifecycle, batch decrement, expiry handling, tenant isolation, role authorization, audit log verification, and regression checks ensuring mock data is not presented as real.
- **Beta-readiness criteria:** Pharmacy can persist and reload medicine batches, prescriptions, and dispensing events under the correct tenant with audit evidence.
- **Main reason not to overbuild:** Pharmacy has higher correctness and compliance risk; generic Commerce stability should come first.

### Milestone 5: Optional Business Pulse only after structured operational data is reliable

- **Exact scope:** Add optional Business Pulse insights over reliable structured records from Customers, Quotes, Orders, Invoices, Tasks, Projects, Inventory, and Restaurant metrics.
- **What is reused:** Existing `SmeDashboard` presentation area, Restaurant dashboard data, shared module records, and audit-safe tenant data access.
- **What is not yet built:** Autonomous actions, payment confirmation, cross-tenant benchmarking, WhatsApp sending, and AI-generated financial truth without source records.
- **Database impact:** Prefer no new operational tables at first; add insight snapshots only if caching/auditability is required.
- **API impact:** Add read-only insight endpoints scoped to tenant and module permissions.
- **Tenant/security concerns:** AI/insight data must be tenant-scoped, source-linked, and avoid leaking records through prompts, logs, or cached responses.
- **Test requirements:** Permission tests, tenant isolation tests, source-record traceability, empty-data behavior, and stale/incorrect insight safeguards.
- **Beta-readiness criteria:** Business Pulse displays explainable, source-linked insights only when enough reliable operational data exists.
- **Main reason not to overbuild:** AI insights over mock or browser-only data would create false confidence and unsafe business recommendations.

## 13. Restaurant protection and regression gates

- **Recommendation:** Do not change Restaurant routes before Restaurant beta validation: `/app/restaurant/*` frontend routes and `/api/restaurant/*` backend contracts must remain stable. Evidence: `src/views/routes.tsx`, `src/modules/commerce/restaurant/manifest.ts`, `src/api/restaurant.api.ts`, and `backend/src/routes/restaurant.ts`.
- **Recommendation:** Do not change Restaurant payment transaction behavior, duplicate-payment rejection, or table release behavior. Evidence: `backend/src/routes/restaurant.ts` and `backend/src/scripts/verify_restaurant_core.ts`.
- **Recommendation:** Preserve `businessId` as tenant identity and JWT tenant scoping. Evidence: `backend/src/middleware/auth.ts`, `backend/src/utils/tenant.ts`, and `backend/src/scripts/verify_tenant_identity.ts`.
- **Recommendation:** Preserve current onboarding result for Restaurant. Evidence: `backend/src/routes/user.ts`, `src/modules/onboarding/SubSegmentView.tsx`, and `tests/e2e/02-onboarding.spec.ts`.
- **Recommendation:** Keep these gates required for any future shared-module work: `npm run build`, `npm run test:e2e`, `backend npm run verify:restaurant`, `backend npm run verify:tenant-identity`, plus focused tests for any new APIs.

## 14. Risks and edge cases

- **Verified:** Duplicate generic orders after retry are possible because generic order creation has no idempotency key today. Evidence: `backend/src/routes/orders.ts`.
- **Verified:** Stock oversell is rejected in a single online transaction, but offline devices could independently sell the same stock without a server reservation/confirmation step. Evidence: `backend/src/routes/orders.ts` and `scripts/e2e-verify.ts`.
- **Verified:** Generic POS payment labels are not backed by payment settlement. Evidence: `src/modules/commerce/supermarket/views/PosView.tsx`, `src/modules/commerce/retail/views/PosView.tsx`, and `backend/src/db/schema.ts`.
- **Verified:** Conflicting task/status changes are not handled because no task module or versioning model exists. Evidence: `backend/src/db/schema.ts` and `src/components/personal/PersonalStubViews.tsx`.
- **Verified:** Syncing to the wrong tenant is a major offline risk; current online APIs mitigate through JWT `businessId`, but local queues do not exist yet. Evidence: `backend/src/middleware/auth.ts`.
- **Verified:** Browser-only storage can be lost or tenant-mixed if not partitioned; Retail uses a single persisted key for customers/sales/settings. Evidence: `src/modules/commerce/retail/store/retail.store.ts`.
- **Recommendation:** Add server-side idempotency before allowing offline order submission.
- **Recommendation:** Add optimistic concurrency/version checks before offline task/project status sync.
- **Recommendation:** Treat local browser data as temporary until server-confirmed sync, never as source of truth for payments, irreversible stock, or tenant records.

## 15. What must not be built yet

- **Recommendation:** Do not build a new standalone Commerce app, Services app, or Projects workspace type.
- **Recommendation:** Do not build Projects as a top-level workspace or template.
- **Recommendation:** Do not build Pharmacy production persistence before generic inventory/invoice/customer foundations are stable.
- **Recommendation:** Do not build offline-first payment settlement, final payment confirmation, irreversible stock adjustments, or pharmacy dispensing in the first offline phase.
- **Recommendation:** Do not build WhatsApp follow-up before Customers, Invoices, Tasks, consent, and auditability exist.
- **Recommendation:** Do not build Business Pulse over mock-only, seed-only, or browser-state-only data.
- **Recommendation:** Do not redesign the whole schema before validating the minimal Commerce workflow.
- **Recommendation:** Do not change Restaurant API contracts, Restaurant payment behavior, duplicate-payment rejection, table release behavior, `businessId` tenant identity, JWT scoping, Restaurant onboarding result, or Restaurant verification gates before beta validation.

## 16. Next smallest implementation milestone

- **Recommendation:** The next smallest future implementation milestone is Milestone 1: Shared Commerce core workflow.
- **Recommendation:** Start with backend-persistent Customers, Quotes, and Generic Invoices that reuse existing `businessId`, audit logs, generic Products/Inventory/Orders, and role middleware.
- **Recommendation:** Keep the first UI thin and operational: customer list/detail, quote create/view, invoice create/view, and links to existing products/inventory/orders. Avoid dashboard, AI, WhatsApp, offline, projects, pharmacy, and payment settlement until the persistent Commerce spine is proven.
- **Recommendation:** The first implementation should include tenant isolation tests before any external beta exposure.
