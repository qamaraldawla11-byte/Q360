# Q360 Calm Blueprint Tech Review

## 1. Files reviewed

- `src/modules/public/LandingView.tsx`
- `docs/CALM_BLUEPRINT_IMPLEMENTATION.md`
- `src/index.css`
- `src/modules/onboarding/BusinessTypeView.tsx`
- `docs/BRAND_SYSTEM_V1_IMPLEMENTATION.md`
- `docs/LANDING_PAGE_VISUAL_POLISH.md`
- `public/brand/q360-mark.png`
- `public/brand/q360-logo.png`
- `dist/brand/q360-mark.png`
- `dist/brand/q360-logo.png`

## 2. Verified strengths

- The landing page keeps Restaurant, Commerce, Services, Projects, and Pharmacy as distinct workspace concepts.
- Pharmacy is presented as a future direction and includes a limitation that it is not currently sold or supported for clinical or prescription compliance.
- Primary CTAs and workspace tabs use buttons with concrete behavior: scrolling to sections, navigating to `/login`, navigating to `/support`, or updating local preview state.
- Reduced-motion handling is present in the landing stylesheet via `@media (prefers-reduced-motion: reduce)`.
- Logo references use Vite public-folder absolute paths (`/brand/q360-mark.png` and `/brand/q360-logo.png`). The source files exist under `public/brand`, and `npm run build` copied them into `dist/brand`, which is compatible with Vite and Vercel production builds.
- No new dependencies were added, and the tracked diff does not include backend, auth, API, database, or deployment changes.

## 3. Issues found

- `src/modules/public/LandingView.tsx` labels CSS-built mockups as `Real product screenshot representation` while showing constructed sample data, not screenshots. This appears in the hero and workspace previews and is repeated in `docs/CALM_BLUEPRINT_IMPLEMENTATION.md`.
- The page includes fake customer-like names, record IDs, dollar values, and operational numbers such as `Sarah Jenkins`, `Lisa Wong`, `Quote Q-1089`, `$4,850.00`, `12 active tables`, `5 open quotes`, `100% inventory sync`, assigned names, and stock quantities. Because some of these sit under labels saying real screenshot representation, they risk reading as real customer/product data.
- The Q timeline says `Q identified this payment matches open order ORD-4089. Suggest updating status and archiving invoice.` That implies unverified cross-module matching and record-update/archive actions. The approval UI reinforces this by presenting the action as an update workflow.
- `docs/CALM_BLUEPRINT_IMPLEMENTATION.md` says the Q timeline displays `automated steps`, which conflicts with the product-truth constraint that Q should not be presented as acting autonomously.
- `docs/CALM_BLUEPRINT_IMPLEMENTATION.md` contains an incorrect file URL pointing to `D:/VS CODE App/Q360/...` instead of this repository and contains mojibake in quoted text.
- The landing-specific CSS does not define explicit `:focus-visible` states for its custom buttons/tabs. Native focus behavior remains available, but the redesign does not provide a consistent visible focus treatment matching the custom UI.
- A rendered desktop smoke check found no horizontal overflow and confirmed logo image loading. Mobile rendered verification could not be completed because browser automation timed out twice, so mobile layout should still receive a manual viewport pass before merge.

## 4. Required fixes, if any

- Replace `Real product screenshot representation` with a truthful label such as `Sample product mockup`, or replace the CSS mockups with actual approved product screenshots.
- Remove fake customer/person names and real-looking record data, or make every mock dataset explicitly sample-only in the visible UI.
- Reword the Q timeline so Q only surfaces an insight or suggestion for human review, without implying automatic record updates, cross-module matching, archiving, or autonomous action.
- Update `docs/CALM_BLUEPRINT_IMPLEMENTATION.md` to remove `automated steps`, fix the repository path, and correct the mojibake.
- Add explicit landing-page `:focus-visible` styles for nav buttons, CTAs, hero/workspace tabs, Q approval control, and footer buttons.
- Complete a manual or automated mobile viewport check before merge.

## 5. Product-truth risks, if any

- High: The combination of `Real product screenshot representation` labels with synthetic customer-style data can be interpreted as real customer/product evidence.
- High: The Q payment-match/update/archive copy implies unbuilt autonomous or cross-module behavior.
- Medium: The implementation doc's `automated steps` wording can become misleading if reused in public or internal release material.

## 6. Build/lint result

- `npm run build`: passed.
- `npm run lint`: passed.

## 7. Merge recommendation

Approve with fixes.
