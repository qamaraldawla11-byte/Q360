# Q360 AI-Assisted Onboarding Plan

## 1. Clear conclusion

- **Recommendation:** Use a hybrid onboarding model: let the user choose a workspace/template manually, or optionally describe their business to Q in natural language, then show a clear recommendation for owner confirmation before any setup is applied.
- **Recommendation:** Keep Q360 fully usable without AI. AI must improve interpretation and confidence, not become a required dependency for signup, workspace selection, or daily operations.
- **Recommendation:** Keep the first version cheap and simple for Sudan and weak-network environments: rules and local template mappings first, one optional AI call only when the user enters free text, cached recommendation results, and no autonomous actions.
- **Recommendation:** Business Pulse should remain the first real post-onboarding AI capability, but only after structured operational data exists. Onboarding AI should recommend a starting configuration; it should not run the business.
- **Constraint:** Do not build full autonomous AI, multi-agent orchestration, schema changes, route changes, auth changes, tenant identity changes, Restaurant changes, Customers changes, Quotes changes, Retail product form changes, or deployment changes in the first onboarding planning milestone.

## 2. User problem

Q360 is business-first and modular, but new owners may not know which workspace, template, or modules fit their business. A shop owner might say "I sell sports equipment and sometimes repair bicycles" rather than knowing whether to choose Retail, Services, Commerce, Projects, or a specific template.

The onboarding problem has three parts:

- Users need a fast manual path when they already know what they want.
- Users need a friendly guided path when they can describe their business but not map it to Q360's internal vocabulary.
- Q360 needs a safe, low-cost way to recommend useful modules without making unapproved changes or depending on AI availability.

The solution should reduce confusion without hiding control from the owner. Q can suggest, explain, and ask one follow-up question, but the owner must confirm the final setup.

## 3. Recommended onboarding flow

### Manual path

The user chooses the business category directly, such as Restaurant, Retail, Services, Pharmacy preview, or another available template. Q360 then shows the recommended default modules for that template and asks for confirmation.

Manual path should be the fastest route:

1. User selects "Choose manually."
2. User selects workspace/template.
3. Q360 shows modules that will be enabled.
4. User confirms.
5. Q360 completes setup using existing onboarding behavior.

This path must work when AI is disabled, unavailable, too slow, or unaffordable.

### Q-assisted path

The user chooses "Ask Q to recommend" and describes the business in plain language. Q interprets the description and returns one structured recommendation.

Q-assisted path:

1. User enters a short description, for example "I run a shop selling football boots, gym equipment, and team jerseys."
2. Rules classify obvious cases first.
3. AI is called only if free-text interpretation is needed.
4. Q returns a recommendation object with workspace, modules, reason, confidence, and one follow-up question if needed.
5. Q360 shows the recommendation in normal UI.
6. User confirms, edits, or switches to manual choice.

Q should not auto-create records, send messages, change payments, or alter stock. It only recommends the starting workspace and modules.

### Hybrid path

The recommended path combines both approaches:

1. Start with simple choices: "Choose manually" or "Tell Q about my business."
2. If the user chooses manually, keep AI out of the way.
3. If the user asks Q, use AI only to interpret the free text.
4. Always show editable recommended modules before setup.
5. Require owner confirmation before completing onboarding.

Hybrid onboarding respects confident users, helps uncertain users, and keeps the product resilient in weak-network environments.

## 4. Should Q appear before or after workspace selection?

### Q first: "Tell us about your business"

Q first is friendly for new users who do not know Q360's categories. It matches how owners naturally talk: "I run a small cafe," "I repair air conditioners," or "I sell sports products."

Benefits:

- Reduces jargon.
- Helps users who do not know whether they are Retail, Services, Restaurant, or another template.
- Creates a warm first impression.

Risks:

- Can feel slow if the network is weak.
- Can make AI look required if not designed carefully.
- Can waste cost on users who already know their workspace.

### Workspace first, then Q asks details

Workspace first is simpler and cheaper. The user selects Restaurant, Retail, Services, or Pharmacy preview, then Q asks only clarifying questions for that area.

Benefits:

- Lower AI cost.
- Faster for users who already know what they need.
- Easier to keep deterministic and offline-friendly.

Risks:

- Users may choose the wrong workspace because they do not know Q360's vocabulary.
- Services and hybrid businesses may be misclassified.
- It feels less intelligent if Q only appears after the main decision.

### Hybrid recommended approach

Use a hybrid entry screen:

- Primary option: "Choose workspace manually."
- Secondary option: "Tell Q about my business."

If the user starts manually, Q can remain optional after workspace selection as "Help me choose modules." If the user starts with Q, Q recommends a workspace and modules, then the user confirms manually.

This gives the best balance for Q360: friendly, cheap, optional, and practical for Sudan and weak-network conditions.

## 5. Example conversations

### Sport products retail shop

User: "I sell football boots, jerseys, gym equipment, and sports accessories. Sometimes customers ask for team orders."

Q: "This looks like a Retail commerce business. I recommend the Retail workspace with Products, Inventory, Customers, Orders, Quotes, and Invoices. Team orders may use Quotes before becoming Orders. Do you also repair equipment or only sell products?"

Recommendation: Retail workspace, Commerce template, enable Products, Inventory, Customers, Orders, Quotes, Invoices. Keep Projects disabled unless the owner confirms custom team-order projects are common.

### Small cafe

User: "I have a small cafe with tables, coffee, snacks, and daily cash sales."

Q: "This looks like a Restaurant/Cafe setup. I recommend the Restaurant workspace because you need menu items, tables, orders, kitchen/service status, and billing. Do you serve customers at tables, takeaway, or both?"

Recommendation: Restaurant workspace, enable Restaurant modules such as POS, Menu, Tables/Floor, Kitchen where relevant, Billing, and Dashboard. Do not enable generic Retail product flows as the main experience.

### Maintenance/repair service

User: "We repair air conditioners and do home maintenance. Customers call us, we inspect, send a price, then schedule the job."

Q: "This looks like a Services business. I recommend a Services template with Customers, Quotes, Tasks/Jobs, Materials, Invoices, and optional Projects. Do you usually finish jobs in one visit or manage longer projects?"

Recommendation: Services workspace/template when available, enable Customers, Quotes, Tasks/Jobs, Materials, Invoices. Enable Projects only if multi-step jobs are common. Until Services is production-ready, mark it as preview or route to a safe manual alternative instead of silently pretending it is Personal.

### Pharmacy preview

User: "I run a pharmacy and need medicine stock, expiry dates, suppliers, and prescriptions."

Q: "This sounds like Pharmacy, but Pharmacy should be treated as a preview until medicine batches, expiry, prescriptions, and dispensing are backed by safe persistent workflows. I can recommend the Pharmacy preview only if you understand it is not the same as a fully validated production pharmacy system."

Recommendation: Pharmacy preview, with clear limitation language. Enable only modules that are actually safe for the current product maturity. Do not imply regulated dispensing, prescription management, or expiry-safe stock control is production-ready before the backend supports it.

## 6. Recommendation object design

Q should produce a strict structured object that the frontend can validate and display. It should not return commands, route mutations, database writes, or hidden side effects.

```json
{
  "recommendedWorkspace": "restaurant|retail|services|pharmacy_preview|personal|unknown",
  "enabledModules": ["products", "inventory", "customers", "orders", "quotes", "invoices"],
  "disabledModules": ["projects", "whatsapp_follow_up", "business_pulse"],
  "reason": "The business sells physical products and may need quotes for team orders.",
  "confidence": 0.82,
  "followUpQuestion": "Do you also repair equipment, or only sell products?",
  "ownerConfirmationRequired": true
}
```

Field rules:

- `recommendedWorkspace` must be one known workspace/template option, not free-form prose.
- `enabledModules` must contain only known module IDs from the product catalog.
- `disabledModules` should explain what is not being enabled yet.
- `reason` should be short, plain, and user-facing.
- `confidence` should be a number from `0` to `1`.
- `followUpQuestion` should be one question only, and should be `null` when not needed.
- `ownerConfirmationRequired` must always be `true`.

If confidence is low, Q should not pretend certainty. It should ask one clarifying question or route the user to manual selection.

## 7. Cost-effective AI strategy

Q360 should use rules first, AI second.

Rules should handle obvious selections:

- "restaurant", "cafe", "coffee shop", "tables", "kitchen" -> Restaurant/Cafe.
- "shop", "sell products", "stock", "barcode" -> Retail/Commerce.
- "repair", "maintenance", "installation", "service calls" -> Services.
- "pharmacy", "medicine", "prescription", "expiry" -> Pharmacy preview with caution.

AI should be used only for free-text interpretation when rules are not confident enough or when the business spans multiple categories. Do not call AI repeatedly for every screen, button, or module toggle.

Cost controls:

- One AI call per free-text onboarding attempt.
- Cache the recommendation result for the user's current onboarding session.
- Reuse the cached result when the user goes back and forward.
- Do not call AI for manual selection.
- Do not use AI for route selection after the owner has confirmed.
- Keep prompts short and send no unnecessary personal or operational data.
- Prefer a small, inexpensive model for classification and recommendation.
- Fall back to manual onboarding if AI times out or the network is weak.

AI must not perform autonomous actions. It only returns a recommendation object for the app to show.

## 8. Safety and approval rules

- User can skip AI entirely.
- User must confirm the recommendation before setup.
- Q cannot send WhatsApp, email, SMS, or any external message during onboarding.
- Q cannot change payments, stock, orders, customers, quotes, Restaurant records, product forms, tenant identity, auth state, or deployment settings.
- Q cannot create a workspace silently.
- Q cannot enable sensitive modules without explicit confirmation.
- Q cannot treat a route path, selected UI option, or natural-language description as tenant authority.
- Q cannot make financial, legal, medical, compliance, employment, or regulatory decisions.
- No sensitive action should happen without approval, role validation, and existing backend support.

The owner-facing language should be clear: "Q recommends this setup. Please review and confirm." It should never say "Q has set up your business" before confirmation.

## 9. Technical architecture

This is a future architecture direction only. It does not require implementation now.

Frontend responsibilities:

- Offer manual, Q-assisted, and hybrid entry paths.
- Capture optional business description.
- Show loading, timeout, and offline fallback states.
- Display the structured recommendation.
- Let the user edit workspace/module selection before confirmation.
- Submit only the confirmed selection through the existing onboarding flow when implementation is later approved.

Backend responsibilities:

- Authenticate the user before accepting onboarding recommendation requests.
- Derive tenant/user context from auth, not from the prompt.
- Apply rules-first classification.
- Call an AI provider only when free-text interpretation is needed.
- Validate the AI response against the strict recommendation object.
- Return a safe recommendation, low-confidence clarification, or manual fallback.
- Log provider errors safely without storing unnecessary prompt data.

Boundaries:

- The AI provider receives no database credentials, API keys, JWTs, OTPs, payment data, stock mutation authority, or internal tool access.
- The recommendation endpoint should be read-only.
- Confirmed onboarding remains a normal Q360 product flow, not an AI action.
- Business Pulse remains separate and should only come after structured records exist.

## 10. Data/privacy considerations

The onboarding prompt should contain only what is needed to classify the business:

- Business description.
- Optional country/currency if already provided.
- Optional selected manual category if the user asked for module help.

Do not send:

- Passwords or OTP data.
- Raw JWTs or session tokens.
- Payment details.
- Customer lists.
- Stock records.
- Restaurant operational records.
- Personal documents.
- Data from any other business.

Privacy rules:

- Keep prompts short.
- Avoid long-term storage of raw natural-language descriptions unless there is a clear product need and user-visible policy.
- Store or cache only the validated recommendation where possible.
- Redact provider logs.
- Make AI optional so privacy-sensitive users can complete onboarding manually.

## 11. What to build now vs later

Build now:

- This planning document.
- Product agreement on the hybrid flow.
- A stable recommendation object shape for future implementation.
- Clear safety rules: AI optional, owner confirmation required, no autonomous actions.

Build later, after approval:

- A rules-only recommendation prototype.
- Optional Q-assisted free-text interpretation behind a feature flag.
- A frontend recommendation review screen.
- A read-only backend recommendation endpoint.
- Response validation and cached onboarding recommendation state.
- Low-confidence fallback to manual selection.

Do not build now:

- Full autonomous AI.
- Multi-agent orchestration.
- Schema changes.
- Onboarding route changes.
- Auth or tenant identity changes.
- Restaurant changes.
- Customers or Quotes changes.
- Retail product form changes.
- Deployment changes.
- WhatsApp sending.
- Payment, stock, order, or customer mutations through Q.
- Business Pulse onboarding automation.

## 12. Acceptance criteria

- The plan keeps Q360 usable without AI.
- The recommended flow includes manual, Q-assisted, and hybrid paths.
- The recommendation requires explicit owner confirmation before setup.
- The recommendation object includes `recommendedWorkspace`, `enabledModules`, `disabledModules`, `reason`, `confidence`, `followUpQuestion`, and `ownerConfirmationRequired`.
- The strategy uses rules first and AI only for optional free-text interpretation.
- The strategy avoids repeated AI calls and caches the result.
- The plan does not recommend autonomous AI.
- The plan does not recommend multi-agent orchestration now.
- The plan keeps the first version cheap and simple.
- The plan is practical for Sudan and weak-network environments.
- The plan keeps Business Pulse as the first real post-onboarding AI capability after structured data exists.
- The plan does not require code, schema, route, auth, tenant identity, Restaurant, Customers, Quotes, Retail product form, or deployment changes.

## 13. Final recommendation

Q should appear as an optional assistant at the start, alongside manual selection, not as a mandatory gate. The best first experience is:

```text
Choose manually
or
Tell Q about your business
```

Manual selection should always work. Q-assisted selection should produce one structured recommendation, ask one follow-up question only when needed, and require owner confirmation before setup.

The first future implementation should be rules-first, cheap, read-only, and easy to bypass. AI should classify messy natural language, not operate the business. Business Pulse should remain the first meaningful post-onboarding AI capability once Q360 has reliable structured data to analyze.
