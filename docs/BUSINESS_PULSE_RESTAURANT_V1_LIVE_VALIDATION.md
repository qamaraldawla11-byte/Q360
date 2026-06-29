# Business Pulse Restaurant Live Validation

## Deployment commit

Record the commit hash deployed to the controlled environment before testing. Do not treat this document as evidence that deployment or live validation has already completed.

## Route verification method

Call `GET /api/restaurant/business-pulse/snapshot` with an authenticated Restaurant tenant session. Confirm unauthenticated requests return `401` and authenticated requests return `200` with JSON only.

## Snapshot fields to compare

Compare `generatedAt`, `openOrderCount`, `unpaidOrderCount`, `delayedKdsTicketCount`, `oldestDelayedKdsDurationMinutes`, `tablePaymentAttentionCount`, `todaySalesSummary`, `topSellingMenuItems`, and `priorities` against the Restaurant dashboard, orders, KDS, payments, and tables data for the same tenant and same day.

## Restaurant UI versus snapshot comparison checklist

Verify open order count, unpaid order count, delayed KDS count, oldest delayed ticket age, tables needing payment attention, today's paid sales, completed payment count, paid order count, and top-selling item order match the Restaurant UI or source records.

## Owner-feedback questions

Ask whether the priority titles are understandable, whether the urgency levels match operational expectations, whether any label sounds misleading, and whether the snapshot omits a field needed for daily review.

## Data-label risks to validate

Confirm `grossSales` is understood as completed same-day paid order payments in cents, `topSellingMenuItems` is based on same-day non-cancelled order items, delayed KDS uses a 15-minute threshold, and empty data is shown as zero counts rather than inferred guidance.

## Pass criteria

The deployed commit matches the reviewed commit, authentication and tenant isolation hold, snapshot values match same-tenant Restaurant records, no raw IDs or secrets are exposed, audit records are written for successful views, and no write actions are triggered by viewing the snapshot.

## Known limitations

This validation covers the read-only snapshot route only. It does not validate AI providers, chat, frontend Q panel, PDF export, charts, drafts, approvals, customer creation, invoice creation, task creation, external messaging, or autonomous actions.
