# Shared Customers Update

## Files changed

- `backend/src/routes/customers.ts`
- `backend/src/scripts/verify_customers.ts`
- `src/api/customers.api.ts`
- `src/modules/commerce/shared/customers/CustomersView.tsx`
- `docs/SHARED_CUSTOMERS_UPDATE.md`

## Endpoint added

- `PATCH /api/customers/:id`

## Fields supported

- `name`
- `phone`
- `email`
- `companyName`
- `address`
- `notes`

`name` must be a non-empty string when provided. Optional text fields can be updated with trimmed strings and can be cleared with an empty string or `null`. Unsupported fields are not written.

## Tenant-scope behavior

The endpoint uses the authenticated stable `businessId` from auth middleware. It does not use `primaryWorkspace` or workspace route strings for tenant scope.

Updates are constrained by both customer `id` and authenticated `businessId`, so a different tenant receives `404` and cannot mutate the record. Workspace-route tenant misuse is rejected by auth before the customer route runs.

## Frontend behavior

The Retail Customers UI at `/app/retail/customers` now supports editing the selected customer from the detail panel. The edit modal uses the same supported fields as create, calls the real backend `PATCH /api/customers/:id` endpoint, shows saving and API error states, and reloads the customer list and detail after a successful update.

Customer delete, import/export, mock-only edit state, and browser storage as customer source of truth were not added.

## What remains postponed

- Customer delete.
- Customer merge.
- Customer import/export.
- Tags, loyalty, CRM pipeline, and follow-up automation.
- Quotes UI and quote workflow.
- Services/Projects customer mounting.

## Commands run and results

- `npm run build`
  - Result: passed, exit code `0`.
  - Key output: `1886 modules transformed` and `built in 3.38s`.
- `npm run lint`
  - Result: passed, exit code `0`.
  - Key output: `eslint .`.
- `cd backend && npm run build`
  - Result: passed, exit code `0`.
  - Key output: `tsc`.
- `cd backend && npm run verify:customers`
  - Result: passed, exit code `0`.
  - Key output: `Customers verification passed: create, list, detail, update, missing/empty-name rejection, cross-tenant update isolation, workspace-route tenant rejection.`
- `cd backend && npm run verify:tenant-identity`
  - Result: passed, exit code `0`.
  - Key output: `sameBusinessIdAfterRelogin: true`, `menuItemVisible: true`, `tableVisible: true`, `orderVisible: true`.
- `cd backend && npm run verify:restaurant`
  - Result: passed, exit code `0`.
  - Key output: statuses included `pending`, `ready`, `delivered`, and `paid`; tenant isolation passed with `foreignOrderHiddenFromA: true`; duplicate payment returned `409`.

`db:push` was not run.
