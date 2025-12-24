import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

// Use existing superadmin account
const email = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const password = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

setup('authenticate', async ({ page }) => {
  // Go to login page
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  
  // Wait for login form to be ready
  await page.waitForLoadState('networkidle');
  
  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 30000 });
  await emailInput.fill(email);
  
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(password);
  
  // Submit login
  const loginResponse = page.waitForResponse(r => r.url().includes('/auth/login') && r.status() === 200);
  await page.locator('button[type="submit"]').click();
  await loginResponse;
  
  // Wait for redirect to dashboard
  await page.waitForURL(/dashboard|\//, { timeout: 60000, waitUntil: 'domcontentloaded' });
  
  // Ensure we're logged in and data starts loading
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Give it a bit more time

  
  // Debug: Log cookies before saving
  const cookies = await page.context().cookies();
  console.log('🍪 Captured Cookies count:', cookies.length);
  cookies.forEach(c => {
    console.log(`- ${c.name} (${c.domain}, secure: ${c.secure}, sameSite: ${c.sameSite})`);
  });
  
  // Save storage state to be used in subsequent tests
  await page.context().storageState({ path: authFile });
  
  console.log('✅ Auth setup completed successfully');
});
