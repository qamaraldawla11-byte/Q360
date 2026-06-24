import { expect, test } from '@playwright/test';
import { completeOtpLogin, expectPath, mockOtp, newUser } from './fixtures';

test('TEST 1 - OTP login flow', async ({ page }) => {
  const user = newUser('otp.user@example.com');
  await mockOtp(page, user);

  await completeOtpLogin(page, user.email);

  await expectPath(page, '/onboarding/identity');
  await expect(page.getByRole('heading', { name: 'Set Up Your Profile' })).toBeVisible();
  await expect(page.evaluate(() => localStorage.getItem('auth_token'))).resolves.toBe('e2e-token');
});
