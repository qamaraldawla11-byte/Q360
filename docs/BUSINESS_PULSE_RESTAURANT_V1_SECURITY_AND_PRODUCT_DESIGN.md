# Business Pulse Restaurant v1 Security and Product Design

Business Pulse v1 is a safe Restaurant-only Q360 assistant surface. It helps an authenticated restaurant owner or team understand operational signals through structured, evidence-backed insights and owner-approved drafts. It must not act autonomously, must not connect any AI provider or model directly to the database, and must never mix data from multiple businesses.

Every model request contains data from exactly one JWT-derived business. Model providers receive no database credentials or internal API access. `restaurantOrderItems` are loaded only through an already tenant-scoped parent order or KDS ticket. Q cannot perform autonomous external, financial, order, stock, payment, refund, deletion, or KDS actions.

Required architecture:

```text
React Restaurant Q panel
-> backend AI route
-> JWT and role validation
-> tenant-scoped backend tool functions
-> model-provider adapter
-> strict JSON response
-> evidence cards
-> owner/admin approval modal
-> existing Q360 API/service performs approved action
-> audit log
```

## 1. Restaurant user flows

Owner opens the Restaurant workspace Q panel and asks, "What needs attention right now?" The frontend sends only the authenticated request and user prompt. It does not send, choose, or imply a `businessId`.

Backend validates JWT/session, derives `businessId` from authenticated context, validates role, and confirms the active workspace is Restaurant. The backend gathers a tenant-scoped Restaurant Pulse snapshot using server-side read-only tools.

Q returns evidence-backed insights, such as delayed kitchen tickets, open unpaid orders, table payment attention, daily sales, top-selling items, and simple operational priorities.

Owner requests a daily report draft. Q prepares a draft backed by evidence cards. The draft remains inert until an owner/admin approves it.

Owner/admin approves a draft or rejects it. Approval is logged. Any approved action must be performed by an existing Q360 route or service, not by the model provider.

Manager or staff can view limited insights only if product policy allows it. Manager and staff cannot approve external actions, payment actions, refunds, stock changes, order changes, or KDS changes through Q.

## 2. What Q can and cannot do

Q can:

- Summarize delayed KDS tickets.
- Identify open or unpaid orders.
- Highlight occupied tables that may need payment attention.
- Summarize daily sales from existing order and payment records.
- Identify top-selling menu items from existing order items loaded through tenant-scoped orders.
- Suggest simple operational priorities.
- Prepare customer follow-up drafts.
- Prepare manager task drafts.
- Prepare daily report drafts.
- Prepare receipt or invoice summary drafts only where existing data supports them.
- Show evidence cards for every material claim.

Q cannot:

- Mark payments paid.
- Create refunds.
- Alter stock.
- Create, modify, or delete orders.
- Change KDS status.
- Delete data.
- Send WhatsApp, email, SMS, push, or any external message.
- Make financial, legal, employment, medical, compliance, or regulatory decisions.
- Perform any external action without explicit owner/admin approval.
- Access the database directly through a model provider.
- Use frontend-provided tenant identifiers as tenant authority.
- Combine records from more than one business in a model request.

## 3. Exact tenant-isolation design

The frontend must never choose, send, or be trusted for a `businessId`.

The backend derives `businessId` only from authenticated JWT/session context, such as `c.get('businessId')` after auth middleware has verified the token. Route paths, workspace paths, query strings, request bodies, local storage, selected UI state, route params, order IDs, tenant IDs, or workspace IDs are never tenant authority.

Every backend AI route must follow this sequence:

1. Authenticate JWT/session.
2. Reject invalid tenant identity, including route-like workspace values such as `/app/restaurant`.
3. Derive `businessId` from the verified auth context.
4. Validate role.
5. Validate Restaurant workspace eligibility from authenticated profile/business data.
6. Call only backend read-only tools that require the verified `businessId`.
7. Build one model request containing data from exactly one JWT-derived business.
8. Validate strict JSON response.
9. Scope insights, evidence cards, drafts, chat context, and audit records to that same business.

Every backend data tool/query must filter by verified `businessId`. Never accept a business ID, workspace ID, route path, tenant ID, order ID, or user-provided filter as a substitute for authenticated tenant identity.

`restaurantOrderItems` do not carry their own `businessId` in the current schema. They must be loaded only through already tenant-scoped parent records:

- Tenant-scoped `restaurantOrders` selected with `restaurantOrders.businessId = verifiedBusinessId`.
- Tenant-scoped `kdsTickets` selected with `kdsTickets.businessId = verifiedBusinessId`, then joined back to a tenant-scoped order.

Never load `restaurantOrderItems` from a raw order ID supplied by the frontend, user prompt, model output, route param, or draft reference unless the parent order has first been verified under the authenticated `businessId`.

No model request may contain records from more than one business. No aggregation prompt may batch tenants. No provider-side tool may fetch more data after the request is created.

## 4. Business profile data Q needs

Q should receive the smallest useful profile needed to interpret Restaurant data:

- Business name.
- Segment: `restaurant`.
- Country.
- Currency.
- Optional operating day/timezone if already available.
- Optional owner/admin display name for draft tone if already available.

Q should not receive:

- Database credentials.
- API tokens.
- Passwords or OTP data.
- Raw JWTs.
- Full user records.
- Unnecessary emails, phone numbers, or addresses.
- Data for non-Restaurant workspaces.
- Data from any other business.

## 5. Restaurant data tools

Restaurant Business Pulse v1 should use backend-only read-only tool functions. These are internal server functions, not model-provider tools with database access.

Recommended tools:

```text
getRestaurantPulseSnapshot(authContext)
getDelayedKdsTickets(authContext)
getOpenOrUnpaidOrders(authContext)
getTableAttention(authContext)
getDailySalesSummary(authContext)
getTopSellingMenuItems(authContext)
getRecentRestaurantAuditContext(authContext)
```

Each tool accepts only an authenticated context:

```json
{
  "userId": "jwt-subject",
  "userRole": "owner",
  "businessId": "jwt-derived-business-id",
  "workspace": "restaurant"
}
```

Each tool must:

- Ignore frontend-provided tenant IDs.
- Filter all tenant-owned tables by verified `businessId`.
- Load order items only through scoped parent orders or scoped KDS tickets.
- Return minimal, normalized evidence data.
- Return timestamps and freshness metadata.
- Avoid returning unrelated PII.
- Avoid mutation.

Allowed data sources for v1:

- `businesses`
- authenticated user's Restaurant profile fields
- `restaurantOrders`
- `restaurantOrderItems` through scoped parent orders/tickets only
- `kdsTickets`
- `restaurantTables`
- `restaurantPayments`
- `menuItems`
- `menuCategories`
- `auditLogs` scoped to the same business where needed for Q audit context

## 6. Permission matrix for owner, admin, manager, staff

| Capability | Owner | Admin | Manager | Staff |
| --- | --- | --- | --- | --- |
| Open Q panel | Yes | Yes | Optional | Optional |
| View Restaurant Pulse summary | Yes | Yes | Yes, if enabled | Limited, if enabled |
| View evidence cards | Yes | Yes | Yes, if enabled | Limited, if enabled |
| Request insight refresh | Yes | Yes | Yes, if enabled | No by default |
| Prepare customer follow-up draft | Yes | Yes | Optional | No |
| Prepare manager task draft | Yes | Yes | Yes, if enabled | No |
| Prepare daily report draft | Yes | Yes | Optional | No |
| Prepare receipt/invoice summary draft | Yes | Yes | Optional | No |
| Approve a draft for action | Yes | Yes | No | No |
| Reject a draft | Yes | Yes | Optional | No |
| Send external message through Q | Only after explicit approval and existing service support | Only after explicit approval and existing service support | No | No |
| Mark payment paid through Q | No | No | No | No |
| Refund through Q | No | No | No | No |
| Change stock through Q | No | No | No | No |
| Change order through Q | No | No | No | No |
| Change KDS status through Q | No | No | No | No |
| Delete data through Q | No | No | No | No |

## 7. Structured JSON schemas

The model-provider adapter must require strict JSON and validate before returning data to the frontend.

Pulse response schema:

```json
{
  "summary": "string",
  "insights": [
    {
      "id": "string",
      "severity": "info|attention|urgent",
      "title": "string",
      "recommendation": "string",
      "evidenceIds": ["string"],
      "allowedActions": ["prepare_draft"]
    }
  ],
  "evidenceCards": [
    {
      "id": "string",
      "type": "order|kds_ticket|table|payment|menu_item|daily_summary|audit",
      "label": "string",
      "facts": ["string"],
      "sourceIds": ["string"],
      "freshness": {
        "generatedAt": "ISO-8601 timestamp",
        "dataWindowStart": "ISO-8601 timestamp or null",
        "dataWindowEnd": "ISO-8601 timestamp or null"
      }
    }
  ],
  "drafts": [
    {
      "id": "string",
      "type": "customer_follow_up|manager_task|daily_report|receipt_invoice_summary",
      "title": "string",
      "body": "string",
      "requiresApproval": true,
      "evidenceIds": ["string"]
    }
  ]
}
```

Draft approval request schema:

```json
{
  "draftId": "string",
  "decision": "approve|reject",
  "ownerEditedBody": "string or null",
  "approvalNote": "string or null"
}
```

Audit event schema:

```json
{
  "action": "Q_PULSE_REQUESTED|Q_INSIGHT_GENERATED|Q_DRAFT_PREPARED|Q_DRAFT_APPROVED|Q_DRAFT_REJECTED|Q_ACTION_DISPATCHED|Q_RESPONSE_REJECTED",
  "entity": "Q_BUSINESS_PULSE",
  "entityId": "pulse-or-draft-id",
  "details": {
    "businessId": "jwt-derived-business-id",
    "userRole": "owner|admin|manager|staff",
    "provider": "provider-name",
    "model": "model-name",
    "evidenceIds": ["string"],
    "validationStatus": "passed|failed",
    "rejectionReason": "string or null"
  }
}
```

Reject any model response that contains unsupported actions, unrecognized fields that imply action execution, missing evidence references, cross-tenant source IDs, raw SQL, tool-call instructions, or claims not grounded in evidence cards.

## 8. Evidence and anti-hallucination rules

Every material insight must cite at least one evidence card. Every draft must cite evidence cards. Evidence cards must be built from backend tool results scoped to the authenticated business.

Q must distinguish facts from suggestions:

- Fact: "Ticket KDS-123 has been open for 27 minutes."
- Suggestion: "Consider asking the kitchen lead to check this ticket."

Q must not invent:

- Missing customer names.
- Payment status.
- Refund eligibility.
- Legal or compliance obligations.
- Staff performance judgments.
- Future sales.
- External message delivery status.
- Inventory availability beyond available data.

If evidence is missing, Q must say the data is unavailable or insufficient. It must not fill gaps with assumptions.

Any response must be rejected if:

- It includes evidence IDs not present in the scoped payload.
- It references another business.
- It references an order, table, payment, KDS ticket, menu item, draft, chat context, or audit record not present in the scoped payload.
- It recommends a prohibited autonomous action.
- It states an action has been completed when only a draft was prepared.

## 9. Model-provider abstraction

The model-provider adapter is the only layer that talks to external AI providers.

The adapter receives:

- System instructions for read-only Restaurant Business Pulse behavior.
- A sanitized, tenant-scoped business profile.
- A sanitized, tenant-scoped Restaurant Pulse snapshot.
- A strict JSON schema.

The adapter must not receive:

- Database credentials.
- Database connection strings.
- Internal API tokens.
- Raw JWTs.
- Provider-side tools that can call the database or internal APIs.
- Data from multiple businesses.

The adapter must enforce:

- One provider call per authenticated business context.
- Strict JSON response format.
- Schema validation.
- Refusal or rejection of unsupported actions.
- Logging of provider name/model and validation result.
- Timeout and error handling that returns a safe empty/error state, not partial unvalidated output.

Provider portability should be maintained through an interface such as:

```text
generateRestaurantPulse(input) -> validatedPulseResponse
generateRestaurantDraft(input) -> validatedDraftResponse
```

The rest of the app should not depend on provider-specific request or response formats.

## 10. Data minimization and privacy rules

Send the smallest useful dataset to the model. Prefer counts, totals, durations, statuses, labels, and item names over raw records.

Minimize or omit:

- Customer contact details unless specifically needed for an owner-approved draft.
- Staff personal data.
- Full payment method details beyond method category and status.
- Long notes unless needed as evidence.
- Historical data outside the requested window.
- Raw audit details unrelated to Q safety or draft approval.

Default data windows:

- Current operating day for daily sales and table/order attention.
- Active or recently completed KDS tickets for kitchen delays.
- Recent order/payment records only where required for open/unpaid order analysis.
- Configurable but bounded lookback for top-selling menu items.

Privacy-preserving transformations:

- Use internal evidence IDs rather than exposing raw database IDs in model-visible prose where possible.
- Redact unnecessary personal identifiers.
- Keep raw prompts and raw model responses out of long-term logs unless explicitly needed for debugging and safely redacted.

## 11. Draft approval flow

Q may prepare drafts only. Drafts have no side effects.

Flow:

1. User requests a draft or Q suggests one.
2. Backend gathers tenant-scoped evidence.
3. Model returns a draft with `requiresApproval: true`.
4. Backend validates the draft and evidence references.
5. Frontend displays draft, evidence cards, and approval controls.
6. Owner/admin reviews and may edit the draft.
7. Owner/admin approves or rejects.
8. Backend validates role and authenticated business again.
9. Existing Q360 API/service performs any approved supported action.
10. Audit log records the decision and resulting dispatch, if any.

Drafts must never imply they have been sent, executed, paid, refunded, updated, deleted, or applied. They are pending owner/admin approval until explicitly approved.

If an approved action is not supported by an existing Q360 service, the system should record approval intent but not perform an external action.

## 12. Audit-log requirements

Audit every Q Business Pulse event under the authenticated business:

- `Q_PULSE_REQUESTED`
- `Q_INSIGHT_GENERATED`
- `Q_DRAFT_PREPARED`
- `Q_DRAFT_APPROVED`
- `Q_DRAFT_REJECTED`
- `Q_ACTION_DISPATCHED`
- `Q_RESPONSE_REJECTED`
- `Q_PROVIDER_ERROR`

Audit records must include:

- Authenticated `userId`.
- JWT-derived `businessId`.
- User role.
- Action.
- Entity.
- Entity ID where available.
- Provider and model where applicable.
- Evidence IDs.
- Draft ID or pulse request ID.
- Validation status.
- Approval/rejection decision.
- Safe error or rejection reason.

Audit records must not include:

- Database credentials.
- API keys.
- Raw JWTs.
- OTPs.
- Unredacted unnecessary PII.
- Cross-tenant records.

Audit queries shown in Q must also be scoped to authenticated `businessId`.

## 13. Cross-tenant test plan

Create explicit tests proving Business A cannot receive Business B:

- Orders.
- KDS tickets.
- Tables.
- Payments.
- Menu items.
- Insights.
- Drafts.
- Chat context.
- Audit records.

Test setup:

1. Seed Business A and Business B with distinct Restaurant records.
2. Include unique labels and amounts that make leakage obvious.
3. Authenticate as Business A.
4. Call Business Pulse routes.
5. Assert no Business B IDs, table labels, order totals, order item names, menu item names, payment amounts, KDS ticket IDs, draft evidence, chat context, or audit rows appear.
6. Repeat while authenticated as Business B.

Malicious input cases:

- Body contains Business B `businessId`.
- Query string contains Business B `tenantId`.
- Route param contains Business B order ID.
- Prompt asks for another business.
- Prompt includes `/app/restaurant` or another route path as a tenant identity.
- Draft approval references Business B draft ID.
- Chat context ID belongs to Business B.
- Audit lookup references Business B record.

Expected result:

- Backend ignores or rejects user-supplied tenant identity.
- Backend uses only JWT-derived `businessId`.
- Foreign scoped records return not found or forbidden.
- Model request contains only authenticated business data.
- Audit records are written only under authenticated business.

Special edge test:

- Attempt to load `restaurantOrderItems` for Business B by passing a known Business B order ID while authenticated as Business A. The system must first tenant-scope the parent order and therefore return no order items.

## 14. Empty-data and stale-data behavior

If the restaurant has no data, Q should return a calm empty state:

- "No active KDS tickets found."
- "No open or unpaid orders found."
- "No completed sales found for the selected period."
- "No top-selling items yet because no completed orders were found."

Q must not fabricate operational advice from absent data. It may suggest setting up menu items, tables, or order flow only as product guidance, not as an insight from evidence.

If data is stale:

- Show `generatedAt`.
- Show data window start/end.
- Warn that the snapshot may be outdated.
- Invite refresh.
- Avoid urgent claims based on stale data unless the stale status itself is the warning.

If backend tools fail:

- Return a safe partial or unavailable state only if validation can prove no cross-tenant mixing occurred.
- Otherwise return an error and audit `Q_PROVIDER_ERROR` or tool failure.
- Never ask the model to infer missing records.

## 15. Rollout plan for three founder-supported Restaurant demos

Demo 1: Operational attention

- Show delayed KDS tickets.
- Show open or unpaid orders.
- Show occupied tables needing attention.
- Show evidence cards with exact source facts.
- No actions beyond suggestions.

Demo 2: Daily owner report

- Show daily sales summary.
- Show top-selling menu items.
- Show simple priorities for the next shift.
- Prepare a daily report draft.
- Owner/admin approval required before any sharing or external action.

Demo 3: Safe draft workflow

- Prepare customer follow-up draft from existing order/payment evidence.
- Prepare manager task draft from delayed KDS or table attention evidence.
- Prepare receipt/invoice summary draft only from existing supported data.
- Demonstrate approval modal.
- Demonstrate audit log entries for preparation, approval, rejection, and dispatch where supported.

Rollout gates:

- Cross-tenant tests pass for all required entities.
- Response schema validation rejects unsupported action output.
- Owner/admin approval is enforced.
- No provider has database credentials or internal API access.
- No model request contains records from more than one JWT-derived business.
- Empty and stale data states are verified.
- Founder demo datasets contain only consented, demo-safe data.
