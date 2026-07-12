# Restaurant Milestone 1 Usability Fix

## Outcome

Milestone 1 fixes the first verified Restaurant usability defects without changing backend lifecycle behavior.

## Changes

- Dashboard `View Reports` now navigates to `/app/restaurant/reports`.
- Dashboard loads the persisted daily report alongside operational metrics.
- Dashboard shows total orders, paid orders, unpaid/open orders, and paid revenue.
- White Restaurant cards use explicit readable foreground colours in dark and light themes.
- Reports, Inventory, Staff, Settings, Modules, and Dashboard activity surfaces have corrected contrast.
- Shared page headers and affected Restaurant grids adapt for phone-width layouts.

## Protected boundaries

This milestone does not change database schema, tenant identity, authentication, KDS lifecycle, order state transitions, payment behavior, table release, module persistence, or deployment configuration.

## Verification

- Frontend production build
- Frontend lint
- Backend TypeScript build
- Restaurant core verification, including tenant isolation, payment timing, duplicate-payment HTTP 409, single persisted payment, KDS completion, table release, and daily report results
- Deployed desktop and phone-width browser checks
