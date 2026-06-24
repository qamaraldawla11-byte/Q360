import { expect, test } from '@playwright/test';
import { authenticate, expectPath, personalUser } from './fixtures';

test('TEST 5 - sign out redirects to login', async ({ page }) => {
  await authenticate(page, personalUser());
  await page.goto('/app/personal');

  await page.getByRole('button', { name: 'Sign out' }).click();

  await expectPath(page, '/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.evaluate(() => localStorage.getItem('auth_token'))).resolves.toBeNull();
});
