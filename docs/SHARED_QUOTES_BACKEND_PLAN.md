# Shared Quotes Backend Plan

## 1. Current schema reality

The real schema already has a shared Commerce/Services quotes foundation in `backend/src/db/schema.ts`.

`QuoteStatus` exists as:

- `draft`
- `sent`
- `accepted`
- `rejected`
- `expired`
- `converted`

`quotes` exists with:

- `id` primary key
- `businessId` as tenant field, defaulting to `biz_main`, not nullable
- `customerId` nullable text link
- `quoteNumber` required text
- `status` using `QuoteStatus`, default `draft`
- `subtotal` required number
- `discountTotal` required number, default `0`
- `taxTotal` required number, default `0`
- `total` required number
- `currency` required text, default `USD`
- `validUntil` nullable timestamp
- `notes` nullable text
- `createdAt` and `updatedAt`
- indexes on `businessId`, `customerId`, and `status`

`quoteItems` exists with:

- `id` primary key
- `businessId` as tenant field, defaulting to `biz_main`, not nullable
- `quoteId` required text
- `productId` nullable text
- `description` required text
- `quantity` required number
- `unitPrice` required number
- `lineTotal` required number
- `createdAt` and `updatedAt`
- index on `quoteId`

`customers` exists with `id`, `businessId`, `name`, optional contact fields, notes, and timestamps. It is already used by the tenant-scoped Customers API.

`products` exists with `id`, `name`, `barcode`, `price`, `category`, and `businessId`. Product rows are created when inventory items are created with a barcode.

`inventoryItems` exists with `id`, `name`, stock fields, `price`, and `businessId`. In current Commerce flows, the inventory item id and product id are the same for barcode-created items.

`orders` exists with `id`, JSON `items`, `subtotal`, `tax`, `total`, `createdAt`, and `businessId`. It does not currently store `customerId`, `quoteId`, order status, invoice linkage, or payment status. Those are future workflow gaps and should not be changed in the first Quotes backend API task.

No schema change is required for a first backend-only Quotes API that creates, lists, reads, and updates quote status/items against the existing fields. A later quote-to-order conversion task may prove missing `orders.customerId`, `orders.quoteId`, status, invoice, or payment fields, but that is explicitly out of scope here.

## 2. Existing reusable APIs

Customers:

- `GET /api/customers`
- `GET /api/customers/:id`
- `POST /api/customers`
- `PATCH /api/customers/:id`

These routes are authenticated and scoped by the stable auth `businessId`. They reject workspace-route tenant misuse through auth middleware.

Inventory:

- `GET /api/inventory`
- `GET /api/inventory/:id`
- `POST /api/inventory`
- `PATCH /api/inventory/:id/stock`

Inventory routes use authenticated `businessId`. Create and stock mutation require owner/admin/manager roles.

Products:

- `GET /api/products/search?barcode=...`

This route is mounted through `backend/src/routes/orders.ts`, uses authenticated `businessId`, and returns one tenant-scoped product or `null`.

Orders:

- `POST /api/orders`
- `GET /api/orders/:id`

Order creation validates product and inventory rows under the authenticated `businessId`, checks stock, calculates subtotal/tax/total, inserts the order, and decrements stock. This should not be reused by Quotes yet because quote creation must not mutate inventory or create orders.

## 3. Missing backend API contracts

Minimum backend-only Quotes API:

- `GET /api/quotes`
  - List quotes for authenticated `businessId`.
  - Include quote rows and optionally item summaries. The smallest first implementation can return quote rows only.
- `GET /api/quotes/:id`
  - Return one quote with its `quoteItems`, scoped by `id` and authenticated `businessId`.
- `POST /api/quotes`
  - Create a draft quote with one or more items.
  - Accept optional `customerId`, optional `validUntil`, optional `notes`, optional `currency`, and required `items`.
  - Each item should accept optional `productId`, required `description` unless product-derived, required positive `quantity`, and optional `unitPrice` if product is not provided.
  - Validate customer and product ids against the same authenticated `businessId`.
  - Calculate totals server-side.
  - Persist quote and items in one transaction.
- `PATCH /api/quotes/:id`
  - Update only draft quote fields and items in the first implementation.
  - Supported fields: `customerId`, `validUntil`, `notes`, `currency`, `items`.
  - Recalculate totals server-side.
  - Reject edits to non-draft quotes until status workflow is implemented.
- `PATCH /api/quotes/:id/status`
  - Minimal status transitions only: `draft -> sent`, `sent -> accepted`, `sent -> rejected`, and any non-converted quote -> `expired` when explicitly requested or when `validUntil` has passed.
  - Do not implement conversion to order in this task.

Do not add delete, import/export, invoices, payments, AI, frontend, or quote-to-order conversion in the first backend task.

## 4. Tenant isolation design

Quotes must follow the Customers API tenant pattern:

- Mount a new `quotes` route under `/api/quotes`.
- Apply `authMiddleware` to all quote routes.
- Read tenant identity only from `c.get('businessId')`.
- Never read `primaryWorkspace`, workspace route paths, request body tenant ids, query-string tenant ids, or customer-provided business ids for quote scope.
- Every quote query must include `eq(quotes.businessId, businessId)`.
- Every quote item query must either join through a tenant-scoped quote or include `eq(quoteItems.businessId, businessId)`.
- Customer validation must query `customers` by both `customerId` and `businessId`.
- Product and inventory validation must query `products` and/or `inventoryItems` by both id and `businessId`.

Cross-tenant access should return `404` for quote detail/update/status operations. Auth middleware should continue rejecting workspace-route tenant tokens with `401`.

## 5. Quote item and total calculation design

Totals should be calculated only on the backend.

For product-backed items:

- Validate `productId` belongs to authenticated `businessId`.
- Use the current product `name` as the default `description`.
- Use the current product `price` as `unitPrice` unless the API deliberately supports a quoted override.
- Check matching `inventoryItems` stock under the same `businessId` for availability warnings or hard rejection.
- Do not decrement stock during quote creation.

For custom service/manual items:

- Require non-empty `description`.
- Require finite positive `quantity`.
- Require finite non-negative `unitPrice`.
- Allow `productId` to be omitted.

Calculation:

- `lineTotal = quantity * unitPrice` for each item.
- `subtotal = sum(lineTotal)`.
- `discountTotal = 0` in the first implementation because no per-quote discount input exists yet.
- `taxTotal = subtotal * 0.1` only if matching the existing generic Orders tax behavior is acceptable for Commerce MVP.
- `total = subtotal - discountTotal + taxTotal`.

The current schema supports quote-level discount and tax totals but not line-level tax/discount. Keep the first API simple and avoid adding schema for line-level adjustments until a real workflow proves the need.

## 6. Status model

Use the existing `QuoteStatus` values, but expose only a minimal workflow:

- `draft`: quote can be created and edited.
- `sent`: quote is customer-facing and cannot have items changed in the first implementation.
- `accepted`: customer accepted the quote; conversion remains postponed.
- `rejected`: customer rejected the quote.
- `expired`: quote is no longer valid.

Keep `converted` in the type because the schema already has it, but do not expose a conversion endpoint yet. Avoid approval chains, internal review, signatures, deposits, partial acceptance, and payment workflows in this backend foundation task.

## 7. Risks and edge cases

Cross-tenant customers:

- A quote must not link to a customer from another tenant. Validate `customers.id` with `customers.businessId`.

Cross-tenant products:

- A quote item must not reference a product from another tenant. Validate `products.id` with `products.businessId`.

Stale prices:

- Product prices can change after a quote is created. Store the selected `unitPrice`, `description`, and `lineTotal` in `quoteItems` so the quote remains a historical snapshot.
- Detail responses can optionally expose current product price later, but must not silently recalculate persisted quotes.

Stock availability:

- Quotes should not decrement stock.
- First implementation can reject product-backed quote quantities that exceed current inventory to keep the promise realistic, or return a clear availability warning. The safer MVP is to reject impossible quantities with `409` because there is no reservation model.
- Later conversion must re-check stock because availability can change after quote creation.

Quote expiry:

- `validUntil` is nullable in schema.
- Reject invalid date values.
- For status updates, prevent accepting an expired quote when `validUntil` is in the past.
- Automatic expiry can be postponed; `verify:quotes` can prove explicit expiry behavior.

Conversion later:

- Do not create orders from quotes yet.
- Conversion will need a separate plan because current `orders` lacks `customerId`, `quoteId`, status, invoice linkage, and payment status.
- Conversion must revalidate tenant, customer, product, inventory, current stock, and persisted quote status.

## 8. Smallest safe implementation task

Implement only the backend Quotes CRUD foundation:

- Add `backend/src/routes/quotes.ts`.
- Mount it in `backend/src/index.ts` as `/api/quotes`.
- Add `backend/src/scripts/verify_quotes.ts`.
- Add `verify:quotes` to `backend/package.json`.
- Support `GET /api/quotes`, `GET /api/quotes/:id`, `POST /api/quotes`, and draft-only `PATCH /api/quotes/:id`.
- Create quote and quote items in one transaction.
- Validate tenant-scoped customers and products.
- Calculate totals server-side.
- Do not implement status transitions except default `draft` unless needed to prevent editing non-draft records in verification.

This is the best first task because it proves persistence, tenant isolation, item validation, and total calculation without touching Restaurant, Customers, Orders, Invoices, Payments, schema, or frontend.

## 9. Acceptance criteria

- No Restaurant files changed.
- No frontend files changed.
- No schema files changed unless a documented blocker is found before implementation.
- No deployment, OTP/auth, or tenant identity files changed.
- Quotes API uses authenticated stable `businessId` only.
- `primaryWorkspace` is never used for quote tenant scope.
- Cross-tenant quote, customer, and product access is rejected or hidden.
- Quote creation requires at least one valid item.
- Product-backed quote items validate tenant-scoped product and inventory rows.
- Custom quote items require description, quantity, and unit price.
- Totals are calculated by the backend and match persisted quote and item rows.
- Quote detail returns the quote with its items.
- Draft-only update recalculates totals and replaces or updates items safely.
- No quote delete behavior.
- No quote-to-order conversion.
- No invoice or payment behavior.

## 10. Verification plan

Add `cd backend && npm run verify:quotes` to prove:

- Auth is required for all quote routes.
- Workspace-route tenant tokens are rejected with `401`.
- Business A can create a customer, inventory-backed product, and quote.
- Created quote is persisted under Business A `businessId`.
- Quote detail returns the quote and quote items.
- Quote list returns only Business A quotes.
- Business B cannot list, detail, or update Business A quote.
- Business B customer cannot be attached to Business A quote.
- Business B product cannot be attached to Business A quote.
- Missing items are rejected.
- Empty description is rejected for custom items.
- Non-positive or non-finite quantity is rejected.
- Negative or non-finite unit price is rejected.
- Product quantity above current stock is rejected with `409` if the implementation chooses hard stock validation.
- Backend-calculated `lineTotal`, `subtotal`, `taxTotal`, and `total` are persisted and returned.
- Draft update replaces/recalculates items and totals.
- Unsupported fields are ignored or rejected consistently.
- No order rows are created and no inventory stock is decremented during quote creation/update.

Implementation validation should also run:

- `npm run build`
- `npm run lint`
- `cd backend && npm run build`
- `cd backend && npm run verify:customers`
- `cd backend && npm run verify:quotes`
- `cd backend && npm run verify:tenant-identity`
- `cd backend && npm run verify:restaurant`

Do not run `db:push`.
