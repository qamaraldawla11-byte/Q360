# Shared Quotes Backend Implementation

## Files changed

- `backend/src/routes/quotes.ts`
- `backend/src/index.ts`
- `backend/src/scripts/verify_quotes.ts`
- `backend/package.json`
- `docs/SHARED_QUOTES_BACKEND_IMPLEMENTATION.md`

## Endpoints added

All endpoints require the existing auth middleware and use the stable authenticated `businessId` from the JWT context.

- `GET /api/quotes`
  - Returns quote rows for the authenticated business.
- `GET /api/quotes/:id`
  - Returns one tenant-scoped quote with its `items`.
  - Returns `404` when the quote is missing or belongs to another business.
- `POST /api/quotes`
  - Creates a draft quote with quote items.
  - Returns the created quote with `items`.
- `PATCH /api/quotes/:id`
  - Updates supported fields on draft quotes only.
  - Returns the updated quote with `items`.
  - Returns `404` for missing or cross-tenant quotes.

## Request and response shape summary

`POST /api/quotes` accepts:

```json
{
  "customerId": "cust_...",
  "currency": "USD",
  "validUntil": "2026-08-01T00:00:00.000Z",
  "notes": "Optional notes",
  "items": [
    {
      "productId": "prod_...",
      "description": "Optional override",
      "quantity": 2,
      "unitPrice": 15
    },
    {
      "description": "Custom service",
      "quantity": 3,
      "unitPrice": 20
    }
  ]
}
```

`PATCH /api/quotes/:id` accepts the same supported mutable fields: `customerId`, `currency`, `validUntil`, `notes`, and `items`.

Responses include the persisted quote fields and, for detail/create/update, an `items` array with `description`, `quantity`, `unitPrice`, and `lineTotal`.

## Status behavior

- New quotes are created as `draft`.
- `PATCH /api/quotes/:id` only updates `draft` quotes.
- Non-draft quote updates are rejected.
- No status transition endpoint was added.
- `converted` remains a schema value but conversion is postponed.

## Total calculation behavior

- Quote totals are calculated on the server.
- Client-submitted totals are ignored.
- Each line uses `lineTotal = quantity * unitPrice`, rounded to two decimals.
- `subtotal` is the sum of line totals.
- `discountTotal` is `0`.
- `taxTotal` is `0`.
- `total = subtotal - discountTotal + taxTotal`.
- Product-backed items validate the product under the authenticated business and use product name/price defaults when description or unit price are omitted.

## Tenant isolation behavior

- Quote routes read tenant scope only from `c.get('businessId')`.
- `primaryWorkspace`, request body tenant fields, route workspace strings, and query-string tenant values are not used for quote scope.
- Customer validation requires `customers.id` and `customers.businessId` to match the authenticated business.
- Product validation requires `products.id` and `products.businessId` to match the authenticated business.
- Quote detail and update use both `quotes.id` and `quotes.businessId`.
- Quote item reads and replacement use both `quoteItems.quoteId` and `quoteItems.businessId`.
- Cross-tenant quote detail/update is hidden as `404`.
- Workspace-route tenant tokens continue to be rejected by auth middleware with `401`.

## What is postponed

- Quotes frontend
- Quote-to-order conversion
- Invoices
- Payments
- PDF/export
- Email or WhatsApp sending
- AI features
- Delete endpoints
- Status transition endpoint
- Schema changes

## Verification results

The requested verification commands passed:

- `npm run build`
- `npm run lint`
- `cd backend && npm run build`
- `cd backend && npm run verify:quotes`
- `cd backend && npm run verify:customers`
- `cd backend && npm run verify:tenant-identity`
- `cd backend && npm run verify:restaurant`

The DB-backed verification commands required network escalation because the sandbox blocks direct Postgres connections.

`verify:quotes` proves:

- Valid same-tenant customer quote creation
- Quote listing
- Quote detail with items
- Draft quote update
- Server-side total calculation
- Missing and invalid customer rejection
- Cross-tenant customer rejection
- Cross-tenant quote read/update isolation
- Invalid item quantity, price, and name rejection
- Cross-tenant product rejection
- Stable authenticated `businessId` is used instead of `primaryWorkspace` or request body tenant values
- Non-draft quote update rejection
- Quote CRUD does not create orders
- Quote CRUD does not decrement inventory
