import { expect, test, type Page, type Route } from '@playwright/test';
import {
  expectPath,
  mockOtp,
  mockRestaurantApi,
  newUser,
  restaurantUser,
  type MockUser,
} from './fixtures';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// Drives the OTP form on the already-open /login page without reloading, so the
// sessionStorage handoff from the landing flow survives.
const completeOtpInline = async (page: Page, email: string) => {
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
};

const BRIEF_TOKEN = 'e2e-cafe-brief-token';
const HERO_PROMPT = 'I run a café called Luna in Granada with 4 tables.';

const cafeBriefView = () => ({
  id: 'brief_e2e_cafe_1',
  state: 'claimed',
  payload: {
    version: 1,
    businessSummary: 'Luna is a cafe in Granada, Spain with 4 tables and dine-in service.',
    recommendation: {
      intent: 'restaurant',
      businessType: 'restaurant',
      recommendedWorkspace: 'restaurant',
      recommendedModules: ['pos', 'kds', 'menu', 'tables'],
      priorities: [],
      rationale: 'A cafe with dine-in service is part of the Restaurant workspace family.',
      requiresApproval: true,
    },
    prefill: { businessName: 'Luna', country: 'Spain', currency: 'EUR' },
    answers: [
      { question: 'business_type', answer: 'restaurant' },
      { question: 'table_count', answer: '4' },
      { question: 'service_modes', answer: 'dine-in' },
    ],
    clientMetadata: { source: 'e2e-cafe' },
  },
  claimedByUserId: 'usr_new',
  claimedAt: '2026-07-22T00:00:00.000Z',
  confirmedAt: null,
  confirmedFields: [],
  activeExpiresAt: '2026-07-23T00:00:00.000Z',
  createdAt: '2026-07-22T00:00:00.000Z',
});

const mockCafeConciergeChat = (page: Page, email: string) =>
  page.route('**/api/public/q-concierge', route => {
    const body = route.request().postDataJSON() as { message?: string };
    const isEmail = /@/.test(body.message || '');
    return json(route, {
      mode: 'guided',
      reply: isEmail ? 'Thanks — I have everything I need.' : 'I drafted a plan for Luna.',
      updates: isEmail
        ? { email }
        : {
            businessType: 'cafe',
            businessName: 'Luna',
            country: 'Spain',
            services: ['dine-in'],
            tables: 4,
            priorities: [],
          },
      suggestedReplies: [],
      recommendedModules: ['pos', 'kds', 'menu', 'tables'],
      readyForSignIn: isEmail,
    });
  });

const mockCafeBriefReadApis = async (page: Page) => {
  const claimRequests: unknown[] = [];
  await page.route('**/api/q/guest-briefs/claim', route => {
    claimRequests.push(route.request().postDataJSON());
    return json(route, { outcome: 'claimed', brief: cafeBriefView() });
  });
  await page.route('**/api/q/guest-briefs/current', route => json(route, { brief: cafeBriefView() }));
  await page.route('**/api/q/guest-briefs/current/dismiss', route => json(route, { outcome: 'dismissed' }));
  return claimRequests;
};

const mockCafeRestaurantDashboard = (page: Page) =>
  page.route('**/api/restaurant/dashboard', route =>
    json(route, {
      total_revenue_today: 0,
      active_orders_count: 0,
      avg_prep_time_minutes: 0,
      live_diners_count: 0,
    }),
  );

const continueCafeFromLanding = async (page: Page, email: string) => {
  await page.goto('/');
  await page.locator('#d2-hero-input').fill(HERO_PROMPT);
  await page.locator('#d2-hero-input').press('Enter');
  await expect(page.getByText('I drafted a plan for Luna.')).toBeVisible();
  await page.getByLabel('Message Q').fill(email);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Thanks — I have everything I need.')).toBeVisible();
  // Backend-inferred fields remain captured until the user explicitly accepts the defaults.
  const defaultsButton = page.getByRole('button', { name: 'Use defaults and continue' });
  await expect(defaultsButton).toBeVisible();
  await defaultsButton.click();
};

const mockCafeProfileCompletion = async (page: Page, user: MockUser, isCompleted: () => boolean) => {
  const completedProfile: MockUser = {
    ...restaurantUser(),
    email: user.email,
    name: 'Luna Owner',
    businessName: 'Luna Café',
    country: 'ES',
    currency: 'EUR',
  };
  await page.route('**/api/user/profile', route => {
    if (route.request().method() !== 'GET') return route.fallback();
    return json(route, isCompleted() ? completedProfile : user);
  });
};

test('TEST M7.1 - Café secure handoff through Restaurant workspace contract', async ({ page }) => {
  const user = newUser('owner@luna.test');
  await mockOtp(page, user);
  let profileCompleted = false;
  await mockCafeProfileCompletion(page, user, () => profileCompleted);
  await mockCafeConciergeChat(page, user.email);

  const briefRequests: Record<string, unknown>[] = [];
  await page.route('**/api/public/q-concierge/brief', route => {
    briefRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    return json(route, { briefToken: BRIEF_TOKEN, activeExpiresAt: '2026-07-23T00:00:00.000Z' }, 201);
  });

  const claimRequests = await mockCafeBriefReadApis(page);
  const confirmRequests: Record<string, unknown>[] = [];
  await page.route('**/api/q/guest-briefs/current/confirm', route => {
    confirmRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    profileCompleted = true;
    return json(route, {
      success: true,
      outcome: 'confirmed',
      workspace: 'restaurant',
      destination: '/app/restaurant',
      tablesEnsured: 4,
      tablesCreated: 4,
    });
  });
  await mockRestaurantApi(page);
  await mockCafeRestaurantDashboard(page);

  // Public Q setup: landing concierge -> Continue creates a cafe brief.
  await continueCafeFromLanding(page, user.email);
  await expectPath(page, '/login');
  expect(briefRequests).toHaveLength(1);
  expect(briefRequests[0]).toMatchObject({
    businessType: 'cafe',
    businessName: 'Luna',
    country: 'Spain',
    currency: 'EUR',
    services: ['dine-in'],
    tables: 4,
    priorities: [],
    recommendedModules: ['pos', 'kds', 'menu', 'tables'],
    initialRequest: HERO_PROMPT,
  });
  await expect(page.evaluate(() => sessionStorage.getItem('q360_guest_brief_token'))).resolves.toBe(BRIEF_TOKEN);

  // OTP verified: sign-in claims the brief and routes to owner review.
  await completeOtpInline(page, user.email);
  await expectPath(page, '/onboarding/brief');
  expect(claimRequests).toHaveLength(1);
  expect(claimRequests[0]).toEqual({ briefToken: BRIEF_TOKEN });
  await expect(page.evaluate(() => sessionStorage.getItem('q360_guest_brief_token'))).resolves.toBeNull();

  // Owner review appears before provisioning.
  await expect(page.getByRole('heading', { name: 'Review your workspace plan' })).toBeVisible();
  await expect(page.getByText('Prepared by Q. Nothing happens without you.')).toBeVisible();
  await expect(page.getByLabel('Business name')).toHaveValue('Luna');
  await expect(page.getByLabel('Currency')).toHaveValue('EUR');
  await expect(page.getByText('4 tables (Table 1–Table 4)')).toBeVisible();

  // Confirm provisions the Restaurant workspace.
  await page.getByLabel('Business name').fill('Luna Café');
  await page.getByRole('button', { name: 'Confirm and create workspace' }).click();
  await expectPath(page, '/app/restaurant');
  expect(confirmRequests).toHaveLength(1);
  expect(confirmRequests[0]).toEqual({
    acceptedFields: ['businessName', 'country', 'currency'],
    corrections: { businessName: 'Luna Café' },
  });
  await expect(page.evaluate(() => sessionStorage.getItem('q360_guest_setup'))).resolves.toBeNull();
});
