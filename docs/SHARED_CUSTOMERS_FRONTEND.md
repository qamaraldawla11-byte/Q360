# Shared Customers Frontend

## Screens added

- Retail Customers screen at `/app/retail/customers`.
- Shared Commerce Customers view under `src/modules/commerce/shared/customers/CustomersView.tsx`.
- Customer list with desktop table and phone-friendly card list.
- Create customer modal.
- Customer detail panel loaded from the backend detail endpoint.

## API endpoints used

- `GET /api/customers` for the customer list.
- `POST /api/customers` for customer creation.
- `GET /api/customers/:id` for the detail panel.

The UI uses the existing authenticated `http` client. Tenant isolation is left to the backend auth context; the frontend does not pass workspace route values as tenant IDs.

## Routing and navigation changes

- No new route path was added in this step.
- The existing Retail route `/app/retail/customers` continues to render `src/modules/commerce/retail/views/CustomersView.tsx`.
- The Retail customers view re-exports the shared Commerce Customers view.
- No Restaurant, POS, KDS, payments, lifecycle, auth, or tenant identity route was changed.

## Intentionally postponed

- Customer edit because the backend Customers route does not currently expose a `PUT` or `PATCH` endpoint.
- Customer delete, merge, import, tags, loyalty, and CRM pipeline behavior.
- Quotes UI and quote workflow.
- Services/Projects customers mounting.
- Quote-to-order conversion.
- Any mock-only customer behavior.

## Protected areas untouched

- Restaurant frontend and backend routes.
- POS, payments, KDS, lifecycle flows.
- Tenant identity.
- OTP/auth.
- Railway/deployment files.
- Database schema and migrations.

## Commands run and results

- `npm run build`
  - Result: passed, exit code `0`.
  - Key output: `1886 modules transformed` and `built in 5.84s`.
- `npm run lint`
  - Result: passed, exit code `0`.
  - Key output: `eslint .`.
- `cd backend && npm run build`
  - Result: passed, exit code `0`.
  - Key output: `tsc`.
- `cd backend && npm run verify:customers`
  - Result: passed, exit code `0`.
  - Key output: `Customers verification passed: create, list, cross-tenant isolation, missing-name rejection, workspace-route tenant rejection.`
- `cd backend && npm run verify:tenant-identity`
  - Result: passed, exit code `0`.
  - Key output: `sameBusinessIdAfterRelogin: true`, `menuItemVisible: true`, `tableVisible: true`, `orderVisible: true`.
- `cd backend && npm run verify:restaurant`
  - Result: passed, exit code `0`.
  - Key output: order lifecycle statuses included `pending`, `ready`, `delivered`, and `paid`; tenant isolation passed with `foreignOrderHiddenFromA: true`; duplicate payment returned `409`.

`db:push` was not run.
