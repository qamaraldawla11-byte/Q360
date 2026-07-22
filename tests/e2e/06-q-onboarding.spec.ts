import { expect, test, type Page, type Route } from '@playwright/test';
import {
  completeOtpLogin,
  expectPath,
  mockOtp,
  mockRestaurantApi,
  newUser,
  restaurantUser,
  type MockUser,
} from './fixtures';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const BRIEF_TOKEN = 'e2e-brief-token';
const HERO_PROMPT = 'I run a restaurant called Noor in Granada with 6 tables.';

const claimedBriefView = () => ({
  id: 'brief_e2e_1',
  state: 'claimed',
  payload: {
    version: 1,
    businessSummary: 'Noor is a restaurant in Granada, Spain with 6 tables and dine-in service.',
    recommendation: {
      intent: 'restaurant',
      businessType: 'restaurant',
      recommendedWorkspace: 'restaurant',
      recommendedModules: ['pos', 'kds', 'menu', 'tables'],
      priorities: [],
      rationale: 'A restaurant with dine-in service needs POS, kitchen and table management.',
      requiresApproval: true,
    },
    prefill: { businessName: 'Noor', country: 'Spain', currency: 'EUR' },
    answers: [
      { question: 'table_count', answer: '6' },
      { question: 'service_modes', answer: 'dine-in' },
    ],
    clientMetadata: { source: 'e2e' },
  },
  claimedByUserId: 'usr_new',
  claimedAt: '2026-07-22T00:00:00.000Z',
  confirmedAt: null,
  confirmedFields: [],
  activeExpiresAt: '2026-07-23T00:00:00.000Z',
  createdAt: '2026-07-22T00:00:00.000Z',
});

// The concierge chat endpoint: the first message returns the extracted facts, a message
// containing an email address completes the draft and unlocks Continue.
const mockConciergeChat = (page: Page, email: string) =>
  page.route('**/api/public/q-concierge', route => {
    const body = route.request().postDataJSON() as { message?: string };
    const isEmail = /@/.test(body.message || '');
    return json(route, {
      mode: 'guided',
      reply: isEmail ? 'Thanks — I have everything I need.' : 'I drafted a plan for Noor.',
      updates: isEmail
        ? { email }
        : {
            businessType: 'restaurant',
            businessName: 'Noor',
            country: 'Spain',
            services: ['dine-in'],
            tables: 6,
            priorities: [],
          },
      suggestedReplies: [],
      recommendedModules: ['pos', 'kds', 'menu', 'tables'],
      readyForSignIn: isEmail,
    });
  });

// Seeds the handoff state a successful landing flow would have produced. Register AFTER
// mockOtp so this init script runs after the fixtures' storage reset on every page load.
const seedGuestBrief = (page: Page) =>
  page.addInitScript(([token, prompt]) => {
    sessionStorage.setItem('q360_guest_brief_token', token);
    sessionStorage.setItem('q360_guest_setup', JSON.stringify({
      initialRequest: prompt,
      businessType: 'restaurant',
      businessName: 'Noor',
      country: 'Spain',
      services: ['dine-in'],
      tables: 6,
      priorities: [],
      email: '',
    }));
  }, [BRIEF_TOKEN, HERO_PROMPT]);

// Claim/current/dismiss endpoints. Returns the captured claim request bodies.
const mockBriefReadApis = async (page: Page) => {
  const claimRequests: unknown[] = [];
  await page.route('**/api/q/guest-briefs/claim', route => {
    claimRequests.push(route.request().postDataJSON());
    return json(route, { outcome: 'claimed', brief: claimedBriefView() });
  });
  await page.route('**/api/q/guest-briefs/current', route => json(route, { brief: claimedBriefView() }));
  await page.route('**/api/q/guest-briefs/current/dismiss', route => json(route, { outcome: 'dismissed' }));
  return claimRequests;
};

const mockRestaurantDashboard = (page: Page) =>
  page.route('**/api/restaurant/dashboard', route =>
    json(route, {
      total_revenue_today: 0,
      active_orders_count: 0,
      avg_prep_time_minutes: 0,
      live_diners_count: 0,
    }),
  );

// Drives the landing concierge from the hero prompt to the Continue click.
const continueFromLanding = async (page: Page, email: string) => {
  await page.goto('/');
  await page.locator('#d2-hero-input').fill(HERO_PROMPT);
  await page.locator('#d2-hero-input').press('Enter');
  await expect(page.getByText('I drafted a plan for Noor.')).toBeVisible();
  await page.getByLabel('Message Q').fill(email);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Thanks — I have everything I need.')).toBeVisible();
  const continueButton = page.getByRole('button', { name: 'Continue securely' });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
};

// Drives the OTP form on the already-open /login page. Unlike completeOtpLogin this does
// not reload the page, so the sessionStorage handoff from the landing flow survives.
const completeOtpInline = async (page: Page, email: string) => {
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
};

// Keeps the profile a fresh (not onboarded) user until the brief is confirmed, then turns
// it into the completed restaurant owner profile. Registered after mockOtp so it wins.
const mockProfileCompletion = async (page: Page, user: MockUser, isCompleted: () => boolean) => {
  const completedProfile: MockUser = {
    ...restaurantUser(),
    email: user.email,
    name: 'Noor Owner',
    businessName: 'Noor Grill',
    country: 'ES',
    currency: 'EUR',
  };
  await page.route('**/api/user/profile', route => {
    if (route.request().method() !== 'GET') return route.fallback();
    return json(route, isCompleted() ? completedProfile : user);
  });
};

test('TEST 6.1 - Q onboarding journey from concierge brief to confirmed workspace', async ({ page }) => {
  const user = newUser('owner@noor.test');
  await mockOtp(page, user);
  let profileCompleted = false;
  await mockProfileCompletion(page, user, () => profileCompleted);
  await mockConciergeChat(page, user.email);

  const briefRequests: Record<string, unknown>[] = [];
  await page.route('**/api/public/q-concierge/brief', route => {
    briefRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    return json(route, { briefToken: BRIEF_TOKEN, activeExpiresAt: '2026-07-23T00:00:00.000Z' }, 201);
  });

  const claimRequests = await mockBriefReadApis(page);
  const confirmRequests: Record<string, unknown>[] = [];
  await page.route('**/api/q/guest-briefs/current/confirm', route => {
    confirmRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    profileCompleted = true;
    return json(route, {
      success: true,
      outcome: 'confirmed',
      workspace: 'restaurant',
      destination: '/app/restaurant',
      tablesEnsured: 6,
      tablesCreated: 6,
    });
  });
  await mockRestaurantApi(page);
  await mockRestaurantDashboard(page);

  // 1-2. Landing concierge -> Continue creates the brief exactly once and stores the token.
  await continueFromLanding(page, user.email);
  await expectPath(page, '/login');
  expect(briefRequests).toHaveLength(1);
  expect(briefRequests[0]).toMatchObject({
    businessType: 'restaurant',
    businessName: 'Noor',
    country: 'Spain',
    currency: 'EUR',
    services: ['dine-in'],
    tables: 6,
    priorities: [],
    recommendedModules: ['pos', 'kds', 'menu', 'tables'],
    initialRequest: HERO_PROMPT,
  });
  await expect(page.evaluate(() => sessionStorage.getItem('q360_guest_brief_token'))).resolves.toBe(BRIEF_TOKEN);

  // 3. OTP sign-in claims the brief with the stored token and lands on the review step.
  await completeOtpInline(page, user.email);
  await expectPath(page, '/onboarding/brief');
  expect(claimRequests).toHaveLength(1);
  expect(claimRequests[0]).toEqual({ briefToken: BRIEF_TOKEN });
  await expect(page.evaluate(() => sessionStorage.getItem('q360_guest_brief_token'))).resolves.toBeNull();

  // 4. The review renders the claimed plan first, not the manual identity form.
  await expect(page.getByRole('heading', { name: 'Review your workspace plan' })).toBeVisible();
  await expect(page.getByText('Prepared by Q. Nothing happens without you.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Set Up Your Profile' })).toHaveCount(0);
  await expect(page.getByLabel('Business name')).toHaveValue('Noor');
  await expect(page.getByLabel('Currency')).toHaveValue('EUR');
  await expect(page.getByText('6 tables (Table 1–Table 6)')).toBeVisible();

  // 5. Correcting the name sends only the changed fields; success lands on the workspace.
  await page.getByLabel('Business name').fill('Noor Grill');
  await page.getByRole('button', { name: 'Confirm and create workspace' }).click();
  await expectPath(page, '/app/restaurant');
  expect(confirmRequests).toHaveLength(1);
  expect(confirmRequests[0]).toEqual({
    acceptedFields: ['businessName', 'country', 'currency'],
    corrections: { businessName: 'Noor Grill' },
  });
  await expect(page.getByText('Noor Grill')).toBeVisible();
  await expect(page.evaluate(() => sessionStorage.getItem('q360_guest_setup'))).resolves.toBeNull();
  await expect(page.evaluate(() => sessionStorage.getItem('q360_guest_brief_token'))).resolves.toBeNull();
});

test('TEST 6.2 - Q onboarding replay: already confirmed brief still lands on the workspace', async ({ page }) => {
  const user = newUser('replay@noor.test');
  await mockOtp(page, user);
  await seedGuestBrief(page);
  let profileCompleted = false;
  await mockProfileCompletion(page, user, () => profileCompleted);
  const claimRequests = await mockBriefReadApis(page);
  const confirmRequests: Record<string, unknown>[] = [];
  await page.route('**/api/q/guest-briefs/current/confirm', route => {
    confirmRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    profileCompleted = true;
    return json(route, {
      success: true,
      outcome: 'already_confirmed',
      workspace: 'restaurant',
      destination: '/app/restaurant',
      tablesEnsured: 6,
      tablesCreated: 0,
    });
  });
  await mockRestaurantApi(page);
  await mockRestaurantDashboard(page);

  await completeOtpLogin(page, user.email);
  await expectPath(page, '/onboarding/brief');
  expect(claimRequests).toEqual([{ briefToken: BRIEF_TOKEN }]);

  await page.getByRole('button', { name: 'Confirm and create workspace' }).click();
  await expectPath(page, '/app/restaurant');
  // Without edits no corrections are sent, and the confirm call is issued exactly once.
  expect(confirmRequests).toHaveLength(1);
  expect(confirmRequests[0]).toEqual({ acceptedFields: ['businessName', 'country', 'currency'] });
  await expect(page.evaluate(() => sessionStorage.getItem('q360_guest_setup'))).resolves.toBeNull();
});

test('TEST 6.3 - Q onboarding fallback: brief creation failure keeps manual onboarding', async ({ page }) => {
  const user = newUser('fallback@noor.test');
  await mockOtp(page, user);
  await mockConciergeChat(page, user.email);
  const briefRequests: unknown[] = [];
  await page.route('**/api/public/q-concierge/brief', route => {
    briefRequests.push(route.request().postDataJSON());
    return json(route, { error: 'not_implemented' }, 404);
  });
  const claimRequests = await mockBriefReadApis(page);

  await continueFromLanding(page, user.email);
  await expectPath(page, '/login');
  expect(briefRequests).toHaveLength(1);
  await expect(page.evaluate(() => sessionStorage.getItem('q360_guest_brief_token'))).resolves.toBeNull();

  // Sign-in still works and falls back to the standard manual onboarding path.
  await completeOtpInline(page, user.email);
  await expectPath(page, '/onboarding/identity');
  await expect(page.getByRole('heading', { name: 'Set Up Your Profile' })).toBeVisible();
  expect(claimRequests).toHaveLength(0);
});

test('TEST 6.4 - Q onboarding: workspace_exists conflict routes the owner away', async ({ page }) => {
  const user: MockUser = { ...newUser('conflict@noor.test'), primaryWorkspace: '/app/restaurant' };
  await mockOtp(page, user);
  await seedGuestBrief(page);
  await mockBriefReadApis(page);
  const confirmRequests: unknown[] = [];
  await page.route('**/api/q/guest-briefs/current/confirm', route => {
    confirmRequests.push(route.request().postDataJSON());
    return json(route, { error: 'workspace_exists' }, 409);
  });

  await completeOtpLogin(page, user.email);
  await expectPath(page, '/onboarding/brief');
  await page.getByRole('button', { name: 'Confirm and create workspace' }).click();

  await expect(page.getByText('You already have a workspace — taking you there.')).toBeVisible();
  expect(confirmRequests).toHaveLength(1);
  // The client navigates to the stored primary workspace; because this mocked user is not
  // yet persisted as onboarded, ProtectedRoute settles on the manual onboarding start.
  await expectPath(page, '/onboarding/identity');
});
