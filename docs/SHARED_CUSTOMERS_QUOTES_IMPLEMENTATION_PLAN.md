# Shared Customers + Quotes Implementation Plan

## 1. Clear conclusion

The smallest safe implementation is to add a shared, tenant-scoped Customers + Quotes foundation without changing existing Restaurant, Services, routing, deployment, authentication, or production schema flow.

The current repository already has reusable Commerce pieces for products, inventory, orders, suppliers, procurement, Retail customer UI state, and several Commerce screens. It does not have shared persisted customers, quotes, or quote item tables, and it does not have shared customer or quote API routes.

The first implementation step should be database schema only for `customers`, `quotes`, and `quote_items`, plus backend route skeletons only if they can be added without behavior changes. Frontend UI should wait until schema and route contracts are reviewed.

## 2. Current repository evidence

- `backend/src/db/schema.ts` defines shared `inventory_items`, `products`, `orders`, `suppliers`, `businesses`, `users`, `audit_logs`, and Restaurant-specific tables.
- `backend/src/db/schema.ts` does not define shared `customers`, `quotes`, `quote_items`, `invoices`, `payments`, `projects`, `jobs`, `tasks`, or service material allocation tables.
- `backend/src/routes/inventory.ts` exposes tenant-scoped inventory routes under `/api/inventory`.
- `backend/src/routes/orders.ts` exposes `/api/products/search`, `POST /api/orders`, and `GET /api/orders/:id`.
- `backend/src/routes/suppliers.ts` exposes `/api/suppliers` and `/api/suppliers/procurement/orders`.
- `backend/src/index.ts` mounts auth, inventory, orders/products, suppliers, admin, user, and Restaurant routes. It does not mount customers or quotes routes.
- `src/core/services/inventory.service.ts`, `src/core/services/orders.service.ts`, and `src/core/services/procurement.service.ts` provide frontend service wrappers for existing shared Commerce APIs.
- `src/modules/commerce/retail/store/retail.store.ts` defines browser-persisted `RetailCustomer` and `RetailSale` state under the `one-os-retail` storage key.
- `src/modules/commerce/retail/views/CustomersView.tsx` provides a Retail customer list and add-customer modal backed by the Retail local store, not a shared backend API.
- `src/views/routes.tsx` includes Retail, Supermarket, Pharmacy, Restaurant, School, and Personal route branches.
- `src/views/routes.tsx` includes Personal stub routes for `invoices`, `clients`, `expenses`, `tasks`, and `settings`.
- `src/components/personal/PersonalStubViews.tsx` confirms those Personal pages are placeholder screens displaying "This feature is coming soon".
- `src/modules/onboarding/SubSegmentView.tsx` lists Services as a segment with "Quotes, jobs, invoicing" but currently routes it to `/app/personal` as a TODO fallback.
- `src/modules/onboarding/SubSegmentView.tsx` lists Auto Parts as a segment but currently routes it to `/app/retail` as a TODO fallback.
- `src/modules/commerce/retail/manifest.ts` includes modules for dashboard, POS, catalog, inventory, customers, procurement, reports, and settings.
- `src/modules/commerce/supermarket/manifest.ts` includes modules for dashboard, POS, catalog, inventory, procurement, suppliers, offers, staff, reports, and settings.
- `backend/src/db/schema.ts` includes `restaurant_orders.paymentStatus` and `restaurant_payments`, but there is no shared invoice or payment status model.

## 3. Existing reusable modules

- Inventory: backend schema `inventory_items`, route `backend/src/routes/inventory.ts`, frontend service `src/core/services/inventory.service.ts`, and Commerce inventory screens.
- Products: backend schema `products`, product barcode search in `backend/src/routes/orders.ts`, and catalog/POS screens in Retail, Supermarket, and Pharmacy.
- Orders: backend schema `orders`, generic POS order creation in `backend/src/routes/orders.ts`, and frontend order service `src/core/services/orders.service.ts`.
- Suppliers: backend schema `suppliers`, supplier/procurement routes in `backend/src/routes/suppliers.ts`, and supplier/procurement screens in Supermarket, Retail, and Pharmacy.
- Procurement UI: `src/modules/commerce/shared/procurement/ProcurementView.tsx` exists as a shared-ish UI surface, although it currently contains mock purchase order data.
- Retail customers: `src/modules/commerce/retail/store/retail.store.ts` and `src/modules/commerce/retail/views/CustomersView.tsx` contain a local customer concept. This is reusable as product evidence, but not as persisted backend infrastructure.
- Personal service-like placeholders: Personal has stub screens for invoices, clients, expenses, and tasks, but no persisted Services module.

## 4. Missing database tables

- Shared `customers` table is missing.
- Shared `quotes` table is missing.
- Shared `quote_items` table is missing.
- Shared quote status history table is missing, but it is not required for the smallest first implementation.
- Shared invoice table is missing.
- Shared payment status table is missing outside Restaurant.
- Services-specific `jobs`, `projects`, `tasks`, and `materials` tables are missing and should not be added in this first scope.

## 5. Missing API routes

- No `/api/customers` route is mounted in `backend/src/index.ts`.
- No `/api/quotes` route is mounted in `backend/src/index.ts`.
- No shared customer CRUD route exists.
- No shared quote CRUD route exists.
- No shared quote status update route exists.
- No shared quote item route exists.
- No shared invoice or payment route exists and should not be added in this first scope.

## 6. Proposed smallest schema additions

Add only these shared tenant-scoped tables:

- `customers`
  - `id`
  - `businessId`
  - `name`
  - `email`
  - `phone`
  - `companyName`
  - `notes`
  - `status`
  - `createdAt`
  - `updatedAt`
- `quotes`
  - `id`
  - `businessId`
  - `customerId`
  - `quoteNumber`
  - `status`
  - `subtotal`
  - `tax`
  - `total`
  - `currency`
  - `validUntil`
  - `notes`
  - `createdAt`
  - `updatedAt`
- `quote_items`
  - `id`
  - `businessId`
  - `quoteId`
  - `productId`
  - `description`
  - `quantity`
  - `unitPrice`
  - `lineTotal`
  - `sortOrder`

Minimum quote status values:

- `draft`
- `sent`
- `accepted`
- `declined`
- `expired`
- `cancelled`

Do not add projects, jobs, tasks, materials, invoices, payments, delivery, procurement, accounting, CRM pipeline, discount rules, quote templates, approvals, or document generation yet.

## 7. Proposed API endpoints

Minimum customer endpoints:

- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/:id`
- `PATCH /api/customers/:id`
- `DELETE /api/customers/:id`

Minimum quote endpoints:

- `GET /api/quotes`
- `POST /api/quotes`
- `GET /api/quotes/:id`
- `PATCH /api/quotes/:id`
- `DELETE /api/quotes/:id`
- `PATCH /api/quotes/:id/status`

Minimum rules:

- All endpoints require existing auth middleware.
- All records must be scoped by `businessId` from the JWT context.
- Quote item creation should happen inside quote creation for the first version.
- Quote item replacement can be handled by `PATCH /api/quotes/:id` in the first version.
- No order conversion, invoice creation, payment collection, Services job creation, or Restaurant integration in this step.

## 8. Proposed frontend screens

Keep frontend screens simple and add them only after backend contracts are stable:

- Customers list
- Customer create/edit
- Quotes list
- Quote create
- Quote detail

Do not add dashboards, analytics, quote templates, PDF export, invoice conversion, Services jobs, project boards, WhatsApp flows, or payment collection in the first UI pass.

## 9. How this serves Commerce

- Retail shops can keep reusable customer records instead of browser-only Retail customer state.
- Auto parts businesses can quote multi-line part lists for B2B customers before converting anything into sales or invoices later.
- Water pump sellers can quote pumps, accessories, installation-related line descriptions, and replacement parts without requiring a Services build yet.
- Industrial supplies businesses can prepare quote lists for repeat buyers with quantities, unit prices, and validity dates.
- Wholesale sellers can manage customer accounts and draft quotes for larger orders before stock, order, or invoice integration is added.
- Online sellers can track customer inquiries and quote totals before a future online order or payment flow exists.

This foundation complements existing products, inventory, orders, and suppliers without changing those modules in the first implementation step.

## 10. How this serves Services later

The same customer and quote foundation can later connect to Services without being Services-specific on day one:

- Jobs can reference an accepted quote.
- Projects can reference a customer and optionally a quote.
- Tasks can be created from accepted quote scope later.
- Materials can reuse quote item concepts or link to products/inventory where appropriate.
- Invoices can later be generated from accepted quotes, jobs, or projects.

Do not build Services routes, projects, jobs, tasks, material allocation, invoice conversion, or payment collection during the first implementation step.

## 11. What must remain untouched

- Restaurant routes.
- Restaurant payments.
- KDS lifecycle.
- Tenant identity.
- OTP auth.
- Railway deployment.
- Existing Playwright tests.
- Restaurant schema and migrations.
- Restaurant frontend views.
- Restaurant API contracts.
- Generic inventory/order/supplier behavior.
- Existing frontend routes.
- Existing production verification scripts.

## 12. Risks and edge cases

- Tenant isolation must be enforced on every customer, quote, and quote item query.
- Quote totals can drift if item values are edited without recalculating totals consistently.
- Product-linked quote items must still allow free-text descriptions for Services and custom Commerce quotes.
- Deleting customers with quotes may break history; the first version should prefer soft status changes or reject deletes when quotes exist.
- Quote status updates should prevent invalid transitions only after product rules are clear; the first version can keep simple status validation.
- Retail local customers may not map one-to-one to future shared customers, so migration should not be automatic without review.
- Existing generic orders do not include customer links, quote conversion, invoice status, or idempotency for quote conversion. Do not force those concerns into the first schema addition.
- Services currently route to Personal as a placeholder, so frontend assumptions about a Services workspace would be premature.

## 13. Acceptance criteria

- A planning-only document exists at `docs/SHARED_CUSTOMERS_QUOTES_IMPLEMENTATION_PLAN.md`.
- The document identifies current repository evidence for customers, products, inventory, orders, suppliers, invoices or payment status, retail/commerce screens, and services/projects screens.
- The plan proposes only the minimum schema for customers, quotes, quote items, and quote status.
- The plan proposes only minimum CRUD and quote status update endpoints.
- The plan proposes only simple frontend screens: Customers list, Customer create/edit, Quotes list, Quote create, and Quote detail.
- The plan explicitly explains Commerce coverage for retail shops, auto parts, water pumps, industrial supplies, wholesale, and online sellers.
- The plan explicitly explains later Services connections to jobs, projects, tasks, materials, and invoices.
- The plan explicitly lists untouched areas including Restaurant routes, Restaurant payments, KDS lifecycle, tenant identity, OTP auth, Railway deployment, and existing Playwright tests.
- No code, schema, API, route, frontend, migration, seed, commit, or push changes are made as part of this planning task.

## 14. Testing checklist

For this planning-only task, run only:

- `npm run build`
- `npm run lint`
- `cd backend && npm run build`

Do not run:

- `db:push`
- migrations
- seed scripts
- production verification
- Restaurant verification scripts
- Playwright tests

For the future first implementation task, add tests only around new shared customers and quotes behavior:

- Backend build passes.
- Frontend build still passes.
- Lint still passes.
- Customer and quote schema types compile.
- Customer and quote route skeletons compile if added.
- Tenant-scoped query patterns are reviewed before any runtime database command is used.

## 15. Exact next implementation prompt

Pause Restaurant performance work.

Do not continue timing optimization.
Do not change Restaurant lifecycle, KDS, payments, tenant identity, deployment, OTP auth, Playwright tests, frontend routes, or schema preparation flow.
Do not refactor Restaurant.

Implement only the first narrow step for shared Customers + Quotes:

- Add database schema definitions for `customers`, `quotes`, and `quote_items` in `backend/src/db/schema.ts`.
- Include only minimum fields for tenant-scoped customers, quotes, quote items, and quote status.
- Export the new Drizzle select/insert types.
- Add backend route skeleton files for customers and quotes only if safe, with auth middleware and tenant-scoped placeholders or minimal CRUD structure.
- Do not run `db:push`, migrations, seed scripts, production verification, or Playwright tests.
- Do not build frontend UI.
- Do not add Services jobs, projects, tasks, materials, invoices, payments, quote conversion, PDF generation, or dashboards.
- Do not change existing Restaurant files or behavior.

After implementation, run only:

- `npm run build`
- `npm run lint`
- `cd backend && npm run build`
