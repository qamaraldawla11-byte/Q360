import { expect, test } from '@playwright/test';
import { authenticate, expectPath, personalUser } from './fixtures';

test('TEST 4 - Personal OS navigation', async ({ page }) => {
  await authenticate(page, personalUser());
  await page.goto('/app/personal');

  await expect(page.getByRole('heading', { name: /Jordan/ })).toBeVisible();
  const destinations = [
    ['Invoices', '/app/personal/invoices'],
    ['Clients', '/app/personal/clients'],
    ['Expenses', '/app/personal/expenses'],
    ['Tasks', '/app/personal/tasks'],
  ] as const;

  for (const [label, path] of destinations) {
    await page.getByRole('link', { name: label }).click();
    await expectPath(page, path);
    await expect(page.getByRole('heading', { name: label })).toBeVisible();
  }

  await page.getByRole('link', { name: 'Home' }).click();
  await expectPath(page, '/app/personal');
  await expect(page.getByText('Recent invoices')).toBeVisible();
});
