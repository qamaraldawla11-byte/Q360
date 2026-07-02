import { expect, test } from '@playwright/test';
import {
  authenticate,
  expectPath,
  mockRestaurantApi,
  restaurantUser,
} from './fixtures';

test('TEST 3 - Restaurant POS to KDS to Billing full loop', async ({ page }) => {
  await authenticate(page, restaurantUser());
  const restaurantMock = await mockRestaurantApi(page);

  await page.goto('/app/restaurant/pos');
  await expectPath(page, '/app/restaurant/pos');
  await page.getByRole('button', { name: /Beef Burger/ }).click();
  await page.getByLabel('TABLE ASSIGNMENT').selectOption('table_1');
  await page.getByRole('button', { name: 'Send to Kitchen' }).click();
  await expect(page.getByText('#e2e_0001 sent to kitchen.')).toBeVisible();

  await page.getByRole('button', { name: 'Kitchen', exact: true }).click();
  await expectPath(page, '/app/restaurant/kitchen');
  await expect(page.getByText('Beef Burger')).toBeVisible();
  await expect(page.getByText('T1')).toBeVisible();
  await page.getByRole('button', { name: 'Mark Ready' }).click();
  await expect(page.getByText('No active orders in queue.')).toBeVisible();

  await page.getByRole('button', { name: 'Orders & Payments' }).click();
  await expectPath(page, '/app/restaurant/billing');
  const orderRow = page.getByRole('row', { name: /#e2e_0001/ });
  await expect(orderRow.getByText('Ready', { exact: true })).toBeVisible();
  await orderRow.getByRole('button', { name: 'Mark Delivered' }).click();
  await expect(orderRow.getByText('Delivered', { exact: true })).toBeVisible();
  await orderRow.getByPlaceholder('Cash received').fill('16');
  await orderRow.getByRole('button', { name: 'Confirm Payment' }).click();
  await expect(orderRow.getByText('Paid', { exact: true })).toBeVisible();
  await expect(orderRow.getByText('PAID', { exact: true })).toBeVisible();
  expect(restaurantMock.getPaymentRequests()).toEqual([{
    orderId: 'order_e2e_0001',
    amount: 16,
    method: 'cash',
  }]);
});
