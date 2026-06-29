# Public Copy and Visual Deployment Scope

## Exact files recommended for commit

- `index.html`
- `src/modules/public/LandingView.tsx`
- `src/modules/public/PricingView.tsx`
- `src/modules/public/SupportView.tsx`
- `src/modules/public/DocsView.tsx`
- `src/modules/public/AiView.tsx`
- `docs/PUBLIC_COPY_AND_VISUAL_DEPLOYMENT_SCOPE.md`

## Exact files to exclude

- `src/index.css` - contains onboarding control styles, not public landing-page polish.
- `src/modules/onboarding/BusinessTypeView.tsx` - onboarding UI change; outside public copy/visual deployment scope.
- `docs/BRAND_SYSTEM_V1_IMPLEMENTATION.md` - supporting implementation note; useful context, but not required for the clean frontend deployment commit.
- `docs/LANDING_PAGE_VISUAL_POLISH.md` - supporting visual-polish note; useful context, but not required for the clean frontend deployment commit.
- `docs/LIVE_BETA_BROWSER_VERIFICATION.md` - live beta verification checklist; not part of the public copy/visual deployment.
- `docs/LIVE_RESTAURANT_BETA_VERIFICATION.md` - restaurant beta verification report; not part of the public copy/visual deployment.
- `docs/SHARED_MODULES_AND_OFFLINE_ARCHITECTURE_PLAN.md` - architecture planning; not part of the public copy/visual deployment.

## Summary of public wording changes

- Updated site metadata from AI-operations positioning to `Q360 | One Place for Your Business`.
- Updated the public hero to `One place for your business. Nothing falls through.`
- Updated primary public CTAs to `Request access`.
- Replaced public beta wording in pricing, docs, support, and Q pages with access/workflow language.
- Replaced `AI operations teammate` wording with business-assistant wording for Q.
- Added the Q heading `Keeps track, so you do not have to.`
- Added the Q explanation: `Q is your business assistant inside Q360. It helps you spot what may need attention next using the activity already recorded in your workspace.`
- Added the trust line: `Q prepares insights and suggested next steps. You approve important actions.`

## Summary of visual changes

- Reworked the landing page into a more product-like public experience with a stronger hero hierarchy.
- Replaced stock-photo workspace previews with clearly labelled sample interface visuals.
- Added workspace tabs and sample preview panels for Restaurant, Commerce, Services, Projects, and Pharmacy direction.
- Added workflow step cards, maturity notes, Q insight panel, trust strip, footer navigation, responsive layouts, hover/focus states, and reduced-motion handling.
- Updated the standalone Q page background treatment while preserving a simple centered public page.

## Prohibited-claim scan result

Command scope reviewed:

- `index.html`
- `public/manifest.json`
- `src/modules/public`
- `src/components/ui/Logo.tsx`

No remaining matches were found for:

- `beta`
- `Request beta access`
- `Join the Q360 beta`
- `AI operations teammate`
- `AI Mate`
- `co-pilot`
- `autonomous`
- `AI employee`
- fake testimonials
- fake customer counts
- unverified encryption, offline, speed, or autonomous-action claims

Remaining contextual matches:

- `Q360 Pharmacy`, `Future direction for medicine retail operations`, and `Retail stock` appear in the public landing workspace preview.
- `Not currently marketed as prescription, clinical, or compliance software.` appears as a limiting statement, not as a compliance claim.
- Public copy uses `customers` as an operational noun, not as a customer-count claim.

## Build/lint results

- `npm run build` passed.
- `npm run lint` passed.
- `git diff --check` passed after this document was added.

## Any ambiguity or risk

- The public landing page still includes a Pharmacy preview with explicit limitation language. This appears safer than a positive pharmacy/compliance claim, but it is the main wording area to review if the instruction is interpreted as banning all public Pharmacy references rather than banning unverified Pharmacy claims.
- The primary `Request access` CTA still routes to `/login`; no dedicated access-request flow was added.
- The excluded public-copy/visual supporting docs are relevant context but not required for deploying the frontend changes.
