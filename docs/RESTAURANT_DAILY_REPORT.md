# Restaurant Daily Report

## Files changed

- `backend/src/routes/restaurant.ts`
- `backend/src/scripts/verify_restaurant_core.ts`
- `src/api/restaurant.api.ts`
- `src/modules/commerce/restaurant/views/ReportsView.tsx`
- `docs/RESTAURANT_DAILY_REPORT.md`

## Data source used

The report uses existing persisted Restaurant tables only:

- `restaurant_orders`
- `restaurant_order_items`
- `restaurant_payments`

Rows are tenant-scoped with the authenticated stable `businessId` from the backend auth context. The report does not use `primaryWorkspace` as tenant identity and does not use mock data.

## Backend endpoint

- `GET /api/restaurant/reports/daily?date=YYYY-MM-DD`

The endpoint is read-only. It selects orders created during the requested local day, attaches persisted items and payments for those orders, and returns summary counts, a simple status breakdown, and recent orders. It does not mutate orders, payments, KDS tickets, tables, or statuses.

## Revenue definition

Revenue is `paidRevenueCents`, calculated from completed persisted `restaurant_payments` rows whose `paidAt` timestamp falls inside the selected day and whose order was created inside the selected day.

This is not a full accounting report. It does not include taxes, refunds, discounts, service charges, orders created on another day but paid on the selected day, or cash drawer reconciliation.

## UI location

The report replaces the placeholder Restaurant Reports content at:

- `/app/restaurant/reports`

The UI includes a date selector, summary cards, dine-in/takeaway counts, a status breakdown, recent orders, loading/error states, and an empty day state.

## Limitations

- Read-only only.
- No export.
- No top items.
- No refunds, tax, payroll, shifts, duties, inventory, or settings.
- Revenue is limited to the persisted payment rows described above.
- Existing `GET /api/restaurant/orders` remains today-only and unchanged.

## Protected areas untouched

- No schema changes.
- No `db:push`.
- No payment mutation behavior changes.
- No Restaurant lifecycle changes.
- No KDS behavior changes.
- No tenant identity changes.
- No OTP/auth changes.
- No deployment file changes.

## Commands run and results

- `npm run build`
  - Result: passed, exit code `0`.
  - Key output: `1875 modules transformed` and `built in 2.98s`.
- `npm run lint`
  - Result: passed, exit code `0`.
  - Key output: `eslint .`.
- `cd backend && npm run build`
  - Result: passed, exit code `0`.
  - Key output: `tsc`.
- `cd backend && npm run verify:restaurant`
  - Result: passed, exit code `0`.
  - Key output: daily report assertion passed with `totalOrders: 2`, `paidOrders: 1`, `unpaidOpenOrders: 1`, `paidRevenueCents: 2000`, `dineInOrders: 1`, and `takeawayOrders: 1`.
- `cd backend && npm run verify:tenant-identity`
  - Result: passed, exit code `0`.
  - Key output: `sameBusinessIdAfterRelogin: true`, `menuItemVisible: true`, `tableVisible: true`, and `orderVisible: true`.

`db:push` was not run.
