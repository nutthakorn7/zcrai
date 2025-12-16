import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Generate random credentials to avoid account lockout
  const timestamp = Date.now();
  const email = `test.admin-${timestamp}@zcr.ai`;
  const password = 'SuperAdmin@123!';
  const tenantName = `Test Tenant ${timestamp}`;

  await page.goto('/register');
  
  // Fill Registration Form
  await page.getByPlaceholder('Acme Corporation').fill(tenantName);
  await page.getByPlaceholder('admin@company.com').fill(email);
  await page.getByPlaceholder('Create a strong password').fill(password);
  
  // Agree to terms
  await page.getByRole('checkbox').check();
  
  // Submit
  await page.locator('button[type="submit"]').click();
  
  // Wait for success alert/redirect and then Login
  // Note: Registration currently redirects to /login with specific behavior
  await expect(page).toHaveURL(/login/);

  // Now perform Login with the new account
  await page.getByPlaceholder('example@company.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.locator('button[type="submit"]').click();

  // Wait for either dashboard OR error
  try {
      await Promise.race([
          page.waitForURL(/dashboard|\/$/),
          page.waitForSelector('.text-red-400', { timeout: 10000 }).then(async el => {
              const err = await el?.textContent();
              throw new Error(`Login Failed: ${err}`);
          })
      ]);
  } catch (e) {
      if (e.message.includes('Login Failed')) throw e;
      throw e;
  }
   
  // Save storage state to be used in subsequent tests
  await page.context().storageState({ path: authFile });
});
