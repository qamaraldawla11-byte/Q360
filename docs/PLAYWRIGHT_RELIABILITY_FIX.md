# Playwright Reliability Fix

## Root cause

The Playwright suite was configured with the HTML reporter as the default reporter and no explicit suite-level bound, so a local run could fail to produce useful terminal pass/fail output when it stalled. The frontend-flow mocks also allowed profile requests outside the expected GET path to fall through to the real API via `route.continue()`, which made mocked E2E tests depend on external backend/network behavior.

## Files changed

- `playwright.config.ts`
- `tests/e2e/fixtures.ts`
- `backend/src/scripts/verify_restaurant_core.ts`
- `docs/PLAYWRIGHT_RELIABILITY_FIX.md`

## Why the suite hung

The audit captured `npx playwright test` starting all five tests but not returning an actionable result. The current checkout did not reproduce a hard hang during individual or full-suite investigation, but the configuration and mocks still had the same reliability risks: terminal output defaulted to the HTML reporter, there was no explicit whole-suite timeout, and mocked API profile routes could leak to a live backend for non-GET methods. The fix makes suite execution bounded and terminal-first, and keeps mocked profile requests fully inside Playwright.

## Test execution results

- `npx playwright test tests/e2e/01-otp-login.spec.ts --workers=1 --reporter=list`: passed, 1 test, exit code 0.
- `npx playwright test tests/e2e/02-onboarding.spec.ts --workers=1 --reporter=list`: passed, 1 test, exit code 0.
- `npx playwright test tests/e2e/03-restaurant-loop.spec.ts --workers=1 --reporter=list`: passed, 1 test, exit code 0.
- `npx playwright test tests/e2e/04-personal-navigation.spec.ts --workers=1 --reporter=list`: passed, 1 test, exit code 0.
- `npx playwright test tests/e2e/05-sign-out.spec.ts --workers=1 --reporter=list`: passed, 1 test, exit code 0.
- `npm run build`: passed, exit code 0.
- `npm run lint`: passed, exit code 0.
- `cd backend && npm run build`: passed, exit code 0.
- `npx playwright test --workers=1 --reporter=list`: passed, 5 tests, exit code 0.
- `npx playwright test --reporter=list`: passed, 5 tests using 4 workers, exit code 0.

## Test reliability decisions

- Kept all five existing E2E journeys intact.
- Kept the tests as frontend-flow tests with mocked API responses; they do not validate the real backend or database.
- Added explicit Playwright bounds for the full suite, individual tests, assertions, and web-server startup.
- Switched default reporting to terminal `list` plus HTML report with `open: never`, so local and CI runs exit with clear pass/fail results.
- Retained screenshots only on failure and traces on failure without enabling routine video capture.
- Made profile route mocks fulfill expected GET and PUT requests, return explicit 401 responses for unauthorized requests, and abort unsupported methods.

## Remaining limitations

These tests still use mocked backend responses. They validate critical browser flows and route/UI behavior, but they do not prove live backend persistence, real OTP delivery, tenant isolation, or database correctness.
