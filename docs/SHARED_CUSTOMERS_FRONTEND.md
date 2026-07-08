# Shared Customers Frontend

## Files changed

- `src/api/customers.api.ts`
- `src/modules/commerce/shared/customers/CustomersView.tsx`
- `src/modules/commerce/retail/views/CustomersView.tsx`
- `docs/SHARED_CUSTOMERS_FRONTEND.md`

## Routes added

No new route path was added. The existing Retail route `/app/retail/customers` now renders the reusable shared Customers page.

No Customer detail route was added in this step because the existing routing shape can support it later, but a list/create surface is the smallest safe frontend integration.

## API endpoints used

- `GET /api/customers`
- `POST /api/customers`

`GET /api/customers/:id` remains available in the backend but is not used by this first UI.

## What is reusable

- The shared page lives under `src/modules/commerce/shared/customers/` so it can later be mounted by Services or Projects without using the Retail browser store.
- The API wrapper in `src/api/customers.api.ts` uses the existing authenticated `http` client and the verified Customers backend routes.
- Customer data comes from the backend API, not `localStorage`.

## What is postponed

- Quotes frontend.
- Customer detail route.
- Customer edit/delete.
- Customer merge.
- Customer import.
- Tags, loyalty, CRM pipelines, and advanced search.
- Services or Projects navigation.
- Any Restaurant changes.

## Testing results

- Passed: `npm run build`
  - Result: exit code `0`
  - Key output: `1875 modules transformed` and `built in 11.25s`
- Passed: `npm run lint`
  - Result: exit code `0`
  - Key output: `eslint .`
- Passed: `cd backend && npm run build`
  - Result: exit code `0`
  - Key output: `tsc`
- Passed: `cd backend && npm run verify:customers`
  - Result: exit code `0`
  - Key output: `Customers verification passed: create, list, cross-tenant isolation, missing-name rejection, workspace-route tenant rejection.`
- Passed: `cd backend && npm run verify:tenant-identity`
  - Result: exit code `0`
  - Key output: `sameBusinessIdAfterRelogin: true`, `menuItemVisible: true`, `tableVisible: true`, and `orderVisible: true`
- Passed: `cd backend && npm run verify:restaurant`
  - Result: exit code `0`
  - Key output: Restaurant verification completed order, KDS, payment, duplicate-payment, takeaway, dashboard, and tenant-isolation checks.

## Restaurant status

Restaurant files were not modified for this frontend step.

## Data source

Customers are loaded from and created through the shared backend Customers API. The UI does not use `localStorage` as the source of truth for customers.
