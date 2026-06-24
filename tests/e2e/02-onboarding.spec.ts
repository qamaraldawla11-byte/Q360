import { expect, test } from '@playwright/test';
import { completeOtpLogin, expectPath, mockOtp, newUser } from './fixtures';

test('TEST 2 - onboarding SME to Restaurant selection', async ({ page }) => {
  const user = newUser('restaurant.owner@example.com');
  await mockOtp(page, user);
  await page.route('**/api/user/profile', async route => {
    if (route.request().method() === 'PUT') {
      const profile = route.request().postDataJSON();
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ...user,
          ...profile,
          onboardingCompleted: true,
          primaryWorkspace: '/app/restaurant',
        }),
      });
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(user) });
  });
  await page.route('**/api/restaurant/dashboard', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        total_revenue_today: 0,
        active_orders_count: 0,
        avg_prep_time_minutes: 0,
        live_diners_count: 0,
      }),
    }),
  );

  await completeOtpLogin(page, user.email);
  await page.getByLabel('Full Name').fill('Taylor Owner');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Business Restaurant/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Restaurant POS, kitchen, tables/ }).click();
  await page.getByRole('button', { name: 'Continue with Restaurant' }).click();
  await page.getByLabel('Business Name').fill('Taylor Test Bistro');
  await page.getByRole('button', { name: 'Launch My Workspace' }).click();

  await expectPath(page, '/app/restaurant');
  await expect(page.getByText('Taylor Test Bistro')).toBeVisible();
});
