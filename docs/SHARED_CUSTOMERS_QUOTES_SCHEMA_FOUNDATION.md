# Shared Customers + Quotes Schema Foundation

## Tables added

- `customers`
- `quotes`
- `quote_items`

## Fields added

`customers`:

- `id`
- `businessId`
- `name`
- `phone`
- `email`
- `companyName`
- `address`
- `notes`
- `createdAt`
- `updatedAt`

`quotes`:

- `id`
- `businessId`
- `customerId`
- `quoteNumber`
- `status`
- `subtotal`
- `discountTotal`
- `taxTotal`
- `total`
- `currency`
- `validUntil`
- `notes`
- `createdAt`
- `updatedAt`

`quote_items`:

- `id`
- `businessId`
- `quoteId`
- `productId`
- `description`
- `quantity`
- `unitPrice`
- `lineTotal`
- `createdAt`
- `updatedAt`

## Relationships

- `quotes.customerId` optionally links a quote to a customer record.
- `quote_items.quoteId` links each quote item to a quote.
- `quote_items.productId` optionally links a quote line to an existing product.
- No database foreign keys were added in this additive foundation step.
- No Drizzle `relations(...)` definitions were added because the current schema file does not use Drizzle relations.

## Tenant isolation approach

`businessId` is the tenant boundary for customers, quotes, and quote items. This follows the stable backend business identity pattern already used by shared Q360 tables such as inventory, products, orders, suppliers, and Restaurant tables.

`primaryWorkspace` is not used for tenant isolation. It is a workspace/navigation concept and must not be treated as the backend tenant boundary.

Customers and quotes are shared reusable foundations for Commerce and future Services. They are intentionally not Restaurant-specific.

Indexes added for tenant-scoped and common lookup access:

- `customers_business_id_idx`
- `quotes_business_id_idx`
- `quotes_customer_id_idx`
- `quotes_status_idx`
- `quote_items_quote_id_idx`

## Quote status lifecycle

The smallest safe quote status lifecycle is:

- `draft`
- `sent`
- `accepted`
- `rejected`
- `expired`
- `converted`

The schema follows the existing project style for status fields: `text(...).$type<...>()` with a default value. No PostgreSQL enum was added.

## What was intentionally postponed

- API routes.
- Frontend UI.
- Restaurant changes.
- KDS changes.
- Payment changes.
- Tenant identity changes.
- OTP/auth changes.
- Railway/deployment changes.
- Playwright changes.
- Quote-to-order conversion.
- Services implementation.
- Projects implementation.
- Jobs, tasks, materials, invoices, quote PDFs, quote templates, or approval flows.
- Status transition enforcement.
- Database foreign keys.
- Customer migration from Retail local storage.

No APIs or UI were implemented in this step.

## Commands run and results

- `npm run build`: passed with exit code `0`. Key output: `1886 modules transformed` and `built in 29.20s`.
- `npm run lint`: passed with exit code `0`. Key output: `eslint .` completed with no diagnostics.
- `cd backend && npm run build`: passed with exit code `0`. Key output: `tsc`.
- `cd backend && npm run db:push`: not run. `DATABASE_URL` safety was not confirmed for an isolated staging or beta database during this backend-only schema step.

## Risks and notes

- Money fields use the existing shared Commerce convention from `orders`: `doublePrecision`.
- `quote_items.businessId` is included in addition to `quoteId` so future queries can enforce tenant scope directly on line items.
- Quote totals can drift if future APIs update item rows without recalculating quote totals consistently.
- Product-linked quote items still allow free-text descriptions so Commerce and future Services can quote custom work or non-catalog items.
- Restaurant remains untouched.
