import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Use environment variables or default to hardcoded credentials (for now)
  // Ideally, these should come from process.env.TEST_USER / TEST_PASSWORD
  const email = 'superadmin@zcr.ai';
  const password = 'SuperAdminQ123!';

  await page.goto('/login');
  
  await page.getByPlaceholder('name@company.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for navigation to dashboard or some authenticated state
  await page.waitForURL(/dashboard|\/$/);
  
  // Save storage state to be used in subsequent tests
  await page.context().storageState({ path: authFile });
});
