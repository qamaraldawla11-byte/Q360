# Q360 Brand System v1 Implementation

## 1. Files changed

- `index.html`
- `src/modules/public/LandingView.tsx`
- `src/modules/public/PricingView.tsx`
- `src/modules/public/SupportView.tsx`
- `src/modules/public/DocsView.tsx`
- `src/modules/public/AiView.tsx`
- `docs/BRAND_SYSTEM_V1_IMPLEMENTATION.md`

## 2. Old public wording replaced

- Replaced AI operations workspace metadata with `Q360 | One Place for Your Business`.
- Replaced hero wording about running operations from one workspace with `One place for your business. Nothing falls through.`
- Replaced `Request beta access`, `Join the Q360 beta`, and related public access wording with `Request access`, `Talk to us`, `Explore workspaces`, and `See how Q360 works`.
- Replaced `Q AI` navigation/footer wording with `Q`.
- Replaced `AI operations teammate` with `business assistant`.
- Replaced public pricing and docs wording that referenced beta access or beta foundations.
- Removed public claims about selected beta workflow availability for Q.

## 3. New Q360 and Q wording applied

- Main promise: `One place for your business. Nothing falls through.`
- Slogan: `Less chasing. More clarity.`
- Short description: `Q360 helps businesses keep customers, work, orders, invoices, payments, and priorities in one place.`
- Q identity: `Q`
- Q role: `Your Business Assistant`
- Q benefit line: `Keeps track, so you do not have to.`
- Q explanation: Q helps spot what may need attention next using activity already recorded in the workspace.
- Q trust rule: `Q prepares insights and suggested next steps. You approve important actions.`

## 4. Every public beta reference removed

- Public landing, metadata, navigation, footer, CTAs, support form copy, pricing page copy, docs page copy, and Q page copy no longer use `beta`.
- A targeted scan of `src/modules/public` and `index.html` has no `beta` matches.

## 5. Wording intentionally retained because it is verified

- `Not currently marketed as prescription, clinical, or compliance software.` is retained for Q360 Pharmacy because it is the required limitation note and reduces public-risk ambiguity.
- Authenticated product modules still contain operational terms such as barcode, prescription, patient, and compliance because they are not public landing-page positioning copy and changing them would affect product/business logic outside this request.

## 6. Remaining founder review items

- Confirm whether `Request access` should continue routing to `/login` or move to a dedicated access request flow.
- Confirm whether `/pricing`, `/support`, `/docs`, and `/ai` should remain public routes or be folded into the main public landing experience.
- Review Pharmacy public positioning before any future healthcare-specific marketing.
