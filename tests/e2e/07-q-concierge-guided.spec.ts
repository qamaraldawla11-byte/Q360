import { expect, test, type Page, type Route } from '@playwright/test';
import { expectPath, mockOtp, newUser, type MockUser } from './fixtures';

test.describe.configure({ mode: 'serial' });

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const HERO_PROMPT = 'I want to set up a restaurant.';
const USER_EMAIL = 'guided@noor.test';
const BRIEF_TOKEN = 'e2e-guided-brief-token';

const mockGuidedConcierge = (page: Page) => {
  let messages: string[] = [];
  return page.route('**/api/public/q-concierge', (route) => {
    const body = route.request().postDataJSON() as { message?: string; draft?: Record<string, unknown> };
    const message = (body.message || '').trim();
    messages.push(message);

    // First message: extract business type only, leave service mode for the guided flow.
    if (messages.length === 1) {
      return json(route, {
        mode: 'guided',
        reply: 'Great, let us set up your restaurant. How will customers be served?',
        updates: { businessType: 'restaurant' },
        suggestedReplies: ['Dine-in only', 'Takeaway only', 'Both'],
        recommendedModules: ['Dashboard', 'Sales', 'Q Assistant'],
        readyForSignIn: false,
      });
    }

    // Email reply must be checked before any name/country text that an email may contain.
    if (/@/.test(message)) {
      return json(route, {
        mode: 'guided',
        reply: 'Thanks — I have everything I need.',
        updates: { email: USER_EMAIL },
        suggestedReplies: [],
        recommendedModules: ['Dashboard', 'Sales', 'Tables', 'Q Assistant'],
        readyForSignIn: true,
      });
    }

    // Service mode reply from quick reply.
    if (/dine-in only/i.test(message)) {
      return json(route, {
        mode: 'guided',
        reply: 'Dine-in only it is.',
        updates: { services: ['dine-in'] },
        suggestedReplies: [],
        recommendedModules: ['Dashboard', 'Sales', 'Tables', 'Q Assistant'],
        readyForSignIn: false,
      });
    }

    // Business name reply.
    if (/noor/i.test(message)) {
      return json(route, {
        mode: 'guided',
        reply: 'Nice to meet Noor. Which country will it operate in?',
        updates: { businessName: 'Noor' },
        suggestedReplies: ['Sudan', 'Egypt', 'Saudi Arabia'],
        recommendedModules: ['Dashboard', 'Sales', 'Tables', 'Q Assistant'],
        readyForSignIn: false,
      });
    }

    // Country reply.
    if (/sudan/i.test(message)) {
      return json(route, {
        mode: 'guided',
        reply: 'Sudan noted. Which email should receive the secure sign-in code?',
        updates: { country: 'Sudan' },
        suggestedReplies: [],
        recommendedModules: ['Dashboard', 'Sales', 'Tables', 'Q Assistant'],
        readyForSignIn: false,
      });
    }

    // Priority reply.
    if (/fast checkout/i.test(message)) {
      return json(route, {
        mode: 'guided',
        reply: 'Fast checkout noted. Any other setup preferences?',
        updates: { priorities: ['Fast checkout'] },
        suggestedReplies: [],
        recommendedModules: ['Dashboard', 'Sales', 'Tables', 'Q Assistant', 'Customers'],
        readyForSignIn: false,
      });
    }

    // Fallback.
    return json(route, {
      mode: 'guided',
      reply: 'Tell me a bit more, or choose one of the options above.',
      updates: {},
      suggestedReplies: [],
      recommendedModules: ['Dashboard', 'Sales', 'Q Assistant'],
      readyForSignIn: false,
    });
  });
};

const mockBriefApis = async (page: Page) => {
  const briefRequests: Record<string, unknown>[] = [];
  await page.route('**/api/public/q-concierge/brief', (route) => {
    briefRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    return json(route, { briefToken: BRIEF_TOKEN, activeExpiresAt: '2026-07-23T00:00:00.000Z' }, 201);
  });
  await page.route('**/api/q/guest-briefs/claim', (route) =>
    json(route, {
      outcome: 'claimed',
      brief: {
        id: 'brief_e2e_guided',
        state: 'claimed',
        payload: {
          version: 1,
          businessSummary: 'Noor is a restaurant in Sudan.',
          recommendation: {
            intent: 'restaurant',
            businessType: 'restaurant',
            recommendedWorkspace: 'restaurant',
            recommendedModules: ['pos', 'tables'],
            priorities: [],
            rationale: 'Restaurant with dine-in service.',
            requiresApproval: true,
          },
          prefill: { businessName: 'Noor', country: 'Sudan', currency: 'USD' },
          answers: [
            { question: 'business_type', answer: 'restaurant' },
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
      },
    }),
  );
  await page.route('**/api/q/guest-briefs/current', (route) => json(route, { brief: null }));
  await page.route('**/api/q/guest-briefs/current/dismiss', (route) => json(route, { outcome: 'dismissed' }));
  await page.route('**/api/q/guest-briefs/current/confirm', (route) =>
    json(route, {
      success: true,
      outcome: 'confirmed',
      workspace: 'restaurant',
      destination: '/app/restaurant',
      tablesEnsured: 0,
      tablesCreated: 0,
    }),
  );
  return briefRequests;
};

test('TEST 7.1 - guided concierge collects service mode, name, country, priorities and skips bookings before unlocking Continue', async ({ page }) => {
  const user = newUser(USER_EMAIL);
  await mockOtp(page, user);
  await mockGuidedConcierge(page);
  const briefRequests = await mockBriefApis(page);

  await page.goto('/');
  await page.locator('#d2-hero-input').fill(HERO_PROMPT);
  await page.locator('#d2-hero-input').press('Enter');

  // Public Q opens and asks for service mode.
  await expect(page.getByRole('dialog', { name: 'Q Concierge' })).toBeVisible();
  await expect(page.getByText('How will customers be served?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dine-in only' })).toBeVisible();

  // Live draft shows the progressing workspace.
  await expect(page.getByText('Your workspace draft')).toBeVisible();
  await expect(page.getByText('Type')).toBeVisible();
  await expect(page.locator('.guest-q-draft-value').getByText('restaurant')).toBeVisible();
  await expect(page.getByText('Service mode').first()).toBeVisible();

  // Choose service mode.
  await page.getByRole('button', { name: 'Dine-in only' }).click();
  await expect(page.getByText('Dine-in only it is.')).toBeVisible();

  // Continue is still disabled because required fields are not all confirmed.
  await expect(page.getByRole('button', { name: 'Continue securely' })).toBeDisabled();

  // Provide business name.
  await expect(page.getByText('What is the name of your restaurant?')).toBeVisible();
  await page.getByLabel('Message Q').fill('Noor');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Nice to meet Noor. Which country will it operate in?')).toBeVisible();

  // Provide country.
  await page.getByLabel('Message Q').fill('Sudan');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Which email should receive the secure sign-in code?')).toBeVisible();

  // Provide email.
  await page.getByLabel('Message Q').fill(USER_EMAIL);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Thanks — I have everything I need.')).toBeVisible();

  // Skip optional fields until bookings.
  await expect(page.getByText('How many tables do you expect to manage?')).toBeVisible();
  await page.getByLabel('Message Q').fill('skip');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('How many team members do you expect at the start?')).toBeVisible();
  await page.getByLabel('Message Q').fill('skip');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Do you want to track stock and inventory from day one?')).toBeVisible();
  await page.getByLabel('Message Q').fill('skip');
  await page.getByRole('button', { name: 'Send message' }).click();

  // Bookings is asked once, then skipped and never asked again.
  await expect(page.getByText('Will you take table or appointment bookings?')).toBeVisible();
  await page.getByLabel('Message Q').fill('skip');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Will you take table or appointment bookings?')).toHaveCount(1);

  // Provide priority.
  await expect(page.getByText('What matters most for your setup right now?')).toBeVisible();
  await page.getByLabel('Message Q').fill('fast checkout');
  await page.getByRole('button', { name: 'Send message' }).click();

  // Skip other preferences and finish.
  await expect(page.getByText('Fast checkout noted. Any other setup preferences?')).toBeVisible();
  await page.getByLabel('Message Q').fill('skip');
  await page.getByRole('button', { name: 'Send message' }).click();

  // Review is ready and plan shows the three required values.
  await expect(page.getByText('Your Q360 setup brief is ready')).toBeVisible();
  await expect(page.locator('.guest-q-plan-title')).toContainText('Noor');
  await expect(page.locator('.guest-q-meta-item').getByText('Sudan')).toBeVisible();
  await expect(
    page.locator('.guest-q-draft-row').filter({ hasText: 'Priorities' }).locator('.guest-q-draft-value'),
  ).toHaveText('Fast checkout');

  // Continue securely is enabled and the live summary is ready.
  const continueButton = page.getByRole('button', { name: 'Continue securely' });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  // Handoff creates the guest brief and navigates to login.
  await expectPath(page, '/login');
  expect(briefRequests).toHaveLength(1);
  expect(briefRequests[0]).toMatchObject({
    businessType: 'restaurant',
    businessName: 'Noor',
    country: 'Sudan',
    currency: 'USD',
    services: ['dine-in'],
    priorities: ['Fast checkout'],
    recommendedModules: expect.arrayContaining(['Dashboard', 'Sales', 'Tables', 'Q Assistant']),
    initialRequest: HERO_PROMPT,
  });
  await expect(page.evaluate(() => sessionStorage.getItem('q360_guest_brief_token'))).resolves.toBe(BRIEF_TOKEN);
});

test('TEST 7.2 - optional fields can be skipped and Use defaults and continue finishes the journey', async ({ page }) => {
  const user = newUser('defaults@noor.test');
  await mockOtp(page, user);
  await page.route('**/api/public/q-concierge', (route) => {
    const body = route.request().postDataJSON() as { message?: string };
    const message = (body.message || '').trim();
    if (/@/.test(message)) {
      return json(route, {
        mode: 'guided',
        reply: 'Thanks — I have everything I need.',
        updates: { email: user.email },
        suggestedReplies: [],
        recommendedModules: ['Dashboard', 'Sales', 'Q Assistant'],
        readyForSignIn: true,
      });
    }
    // First exchange provides all required facts except email.
    return json(route, {
      mode: 'guided',
      reply: 'Got it. Which email should receive the secure sign-in code?',
      updates: {
        businessType: 'restaurant',
        businessName: 'Noor',
        country: 'Spain',
        services: ['dine-in'],
      },
      suggestedReplies: [],
      recommendedModules: ['Dashboard', 'Sales', 'Q Assistant'],
      readyForSignIn: false,
    });
  });
  const briefRequests = await mockBriefApis(page);

  await page.goto('/');
  await page.locator('#d2-hero-input').fill('Restaurant Noor in Spain');
  await page.locator('#d2-hero-input').press('Enter');

  // Wait until all required fields are collected and the defaults button appears.
  await expect(page.getByText('Which email should receive the secure sign-in code?')).toBeVisible();
  await page.getByLabel('Message Q').fill(user.email);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Thanks — I have everything I need.')).toBeVisible();

  // Use defaults and continue should complete the journey.
  await page.getByRole('button', { name: 'Use defaults and continue' }).click();
  await expectPath(page, '/login');

  // Brief creation received the modules passed by the concierge.
  expect(briefRequests).toHaveLength(1);
  expect(briefRequests[0]).toMatchObject({
    businessType: 'restaurant',
    businessName: 'Noor',
    country: 'Spain',
    services: ['dine-in'],
    recommendedModules: expect.arrayContaining(['Dashboard', 'Sales', 'Q Assistant']),
  });
});

test('TEST 7.3 - repeated backend questions for confirmed fields are not shown again', async ({ page }) => {
  let askCount = 0;
  await page.route('**/api/public/q-concierge', (route) => {
    const body = route.request().postDataJSON() as { message?: string };
    const message = (body.message || '').trim();
    if (message.toLowerCase().includes('restaurant')) {
      askCount += 1;
      return json(route, {
        mode: 'guided',
        reply: askCount === 1
          ? 'What kind of business do you run?'
          : 'You already told me it is a restaurant. Which country will it operate in?',
        updates: { businessType: 'restaurant' },
        suggestedReplies: [],
        recommendedModules: ['Dashboard', 'Q Assistant'],
        readyForSignIn: false,
      });
    }
    return json(route, {
      mode: 'guided',
      reply: 'Got it.',
      updates: {},
      suggestedReplies: [],
      recommendedModules: ['Dashboard', 'Q Assistant'],
      readyForSignIn: false,
    });
  });

  await page.goto('/');
  await page.locator('#d2-hero-input').fill('Restaurant');
  await page.locator('#d2-hero-input').press('Enter');

  // The backend tries to re-ask the business type, but it is already confirmed from the
  // user's first message, so the frontend suppresses it and asks the next intended field.
  await expect(page.getByText('What kind of business do you run?')).toHaveCount(0);
  await expect(page.getByText(/How will customers be served/)).toBeVisible();

  // A subsequent backend reply that tries to re-ask the already-confirmed business type
  // must not add another visible copy of that question.
  await page.getByLabel('Message Q').fill('Restaurant');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('What kind of business do you run?')).toHaveCount(0);
});

test('TEST 7.4 - owner name is clarified and country quick reply does not repeat the country question', async ({ page }) => {
  const user = newUser('egypt@noor.test');
  await mockOtp(page, user);
  const briefRequests = await mockBriefApis(page);

  await page.route('**/api/public/q-concierge', (route) => {
    const body = route.request().postDataJSON() as {
      message?: string;
      draft?: Record<string, unknown>;
    };
    const message = (body.message || '').trim().toLowerCase();
    const draft = body.draft || {};

    if (message.includes('restaurant') && !draft.businessType) {
      return json(route, {
        mode: 'guided',
        reply: 'Great, let us set up your restaurant. How will customers be served?',
        updates: { businessType: 'restaurant' },
        suggestedReplies: ['Dine-in only', 'Takeaway only', 'Both'],
        recommendedModules: ['Dashboard', 'Sales', 'Q Assistant'],
        readyForSignIn: false,
      });
    }

    if (message.includes('dine-in only')) {
      return json(route, {
        mode: 'guided',
        reply: 'Dine-in only it is.',
        updates: { services: ['dine-in'] },
        suggestedReplies: [],
        recommendedModules: ['Dashboard', 'Sales', 'Tables', 'Q Assistant'],
        readyForSignIn: false,
      });
    }

    // Email must be checked before name/country text that an email may contain.
    if (/@/.test(message)) {
      return json(route, {
        mode: 'guided',
        reply: 'Thanks — I have everything I need.',
        updates: { email: user.email },
        suggestedReplies: [],
        recommendedModules: ['Dashboard', 'Sales', 'Tables', 'Q Assistant'],
        readyForSignIn: true,
      });
    }

    if (message.includes('noor')) {
      return json(route, {
        mode: 'guided',
        reply: 'Nice to meet Noor. Which country will it operate in?',
        updates: { businessName: 'Noor' },
        suggestedReplies: ['Egypt', 'Saudi Arabia', 'United Arab Emirates'],
        recommendedModules: ['Dashboard', 'Sales', 'Tables', 'Q Assistant'],
        readyForSignIn: false,
      });
    }

    if (message.includes('egypt')) {
      return json(route, {
        mode: 'guided',
        reply: 'Egypt noted. Which email should receive the secure sign-in code?',
        updates: { country: 'Egypt' },
        suggestedReplies: [],
        recommendedModules: ['Dashboard', 'Sales', 'Tables', 'Q Assistant'],
        readyForSignIn: false,
      });
    }

    return json(route, {
      mode: 'guided',
      reply: 'Tell me a bit more, or choose one of the options above.',
      updates: {},
      suggestedReplies: [],
      recommendedModules: ['Dashboard', 'Sales', 'Q Assistant'],
      readyForSignIn: false,
    });
  });

  await page.goto('/');
  await page.locator('#d2-hero-input').fill('I want to set up a restaurant.');
  await page.locator('#d2-hero-input').press('Enter');

  await expect(page.getByRole('dialog', { name: 'Q Concierge' })).toBeVisible();
  await expect(page.getByText(/How will customers be served/)).toBeVisible();

  // Choose service mode.
  await page.getByRole('button', { name: 'Dine-in only' }).click();

  // A personal-name answer must not become the business name.
  await expect(page.getByText('What is the name of your restaurant?')).toBeVisible();
  await page.getByLabel('Message Q').fill('my name is Muhanad');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Is Muhanad your business name, or your personal name?')).toBeVisible();
  await expect(page.locator('.guest-q-plan-title')).not.toContainText('Muhanad');

  // Provide the real business name.
  await page.getByLabel('Message Q').fill('Noor');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Nice to meet Noor. Which country will it operate in?')).toBeVisible();
  await expect(page.locator('.guest-q-plan-title')).toContainText('Noor');

  // Select Egypt from the quick replies.
  await page.getByRole('button', { name: 'Egypt' }).click();
  // The country question must not be asked again.
  await expect(page.getByText('Which country will it operate in?')).toHaveCount(1);
  await expect(page.getByText('Which email should receive the secure sign-in code?')).toBeVisible();
  await expect(page.locator('.guest-q-plan-title')).toContainText('Noor');
  await expect(page.locator('.guest-q-meta-item').getByText('Egypt')).toBeVisible();

  // Continue to the next required field (email).
  await page.getByLabel('Message Q').fill(user.email);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Thanks — I have everything I need.')).toBeVisible();
  const continueButton = page.getByRole('button', { name: 'Continue securely' });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expectPath(page, '/login');

  expect(briefRequests).toHaveLength(1);
  expect(briefRequests[0]).toMatchObject({
    businessType: 'restaurant',
    businessName: 'Noor',
    country: 'Egypt',
    services: ['dine-in'],
  });
});
