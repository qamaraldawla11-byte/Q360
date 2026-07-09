# Shared Quotes Frontend

## Files changed

- `src/api/quotes.api.ts`
- `src/modules/commerce/retail/views/QuotesView.tsx`
- `src/modules/commerce/retail/manifest.ts`
- `src/modules/commerce/retail/retail.css`
- `src/views/routes.tsx`
- `docs/SHARED_QUOTES_FRONTEND.md`

## Route added

- `/app/retail/quotes`

The route is mounted under the existing Retail workspace and added to the Retail navigation manifest as `Quotes`.

## APIs used

- `GET /api/quotes`
- `GET /api/quotes/:id`
- `POST /api/quotes`
- `PATCH /api/quotes/:id`
- `GET /api/customers`

The frontend wrappers call `/quotes` and `/customers` through the shared `http` client, which maps them to the backend `/api` routes.

## What is real

- Quotes are loaded from the real Quotes API.
- Customers are loaded from the real Customers API and are required before creating a quote.
- Quote create and draft edit use the real Quotes API.
- The selected customer is a persisted customer id from `GET /api/customers`.
- Quote detail uses `GET /api/quotes/:id`.
- Displayed line totals, subtotal, and total come from the saved backend quote response.
- The backend creates quotes as `draft` and calculates totals server-side.
- The UI does not use mock quote data.

## What remains partial

- Quote items are minimal free-text rows with quantity and unit price.
- The frontend does not yet provide a product selector, even though the backend can accept product-backed items.
- Tax and discount fields are displayed from backend totals but are not editable in this UI.
- Status is displayed, and draft quotes can be edited, but there is no status transition UI.
- List responses do not include item detail; the UI fetches detail when a quote is selected.

## What is postponed

- Quotes outside Retail navigation
- Product-backed quote item selector
- Quote status transitions
- Quote-to-order conversion
- Invoices
- Payments
- PDF/export
- Email or WhatsApp sending
- AI features
- Delete/archive behavior
- Advanced discounts or taxes

## Testing results

- `npm run build`: passed.
- `npm run lint`: passed.
- `cd backend && npm run build`: passed.
- `cd backend && npm run verify:customers`: passed.
- `cd backend && npm run verify:tenant-identity`: passed.
- `cd backend && npm run verify:restaurant`: passed.
- `cd backend && npm run verify:quotes`: passed; script exists in `backend/package.json`.

## Manual browser test checklist

- Sign in to a Retail workspace.
- Open `/app/retail/quotes`.
- Confirm the Retail sidebar shows `Quotes`.
- Confirm loading resolves to either a quote list or the empty state.
- If no customers exist, create a customer at `/app/retail/customers`.
- Open `New quote`.
- Select a real customer.
- Add one item with name, quantity, and unit price.
- Save the quote.
- Confirm the quote appears in the list.
- Select the quote and confirm the detail panel shows items, subtotal, and total from the backend response.
- Edit the draft quote.
- Change item quantity or unit price.
- Save and confirm the backend-calculated total changes.
- Try an empty item name, zero quantity, or negative price and confirm an error appears.
- Resize to phone width and confirm cards, detail, and modal remain usable.
