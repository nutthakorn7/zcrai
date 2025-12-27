import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

// Use existing superadmin account
const email = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const password = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

setup('authenticate', async ({ page }) => {
  setup.setTimeout(90000); // 90 second timeout for auth setup
  
  // Go to login page
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait for login form to be ready (use load instead of networkidle)
  await page.waitForLoadState('load', { timeout: 30000 });
  
  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 30000 });
  await emailInput.fill(email);
  
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(password);
  
  // Submit login and wait for navigation (not response)
  await page.locator('button[type="submit"]').click();
  
  // Wait for redirect away from login - this is more reliable than waiting for specific API response
  await page.waitForURL((url) => !url.pathname.includes('/login'), { 
    timeout: 60000, 
    waitUntil: 'domcontentloaded' 
  });
  
  // Give time for cookies to be set
  await page.waitForTimeout(2000);
  
  // Debug: Log cookies before saving
  const cookies = await page.context().cookies();
  console.log('🍪 Captured Cookies count:', cookies.length);
  cookies.forEach(c => {
    console.log(`- ${c.name} (${c.domain}, secure: ${c.secure}, sameSite: ${c.sameSite})`);
  });
  
  // Verify we have auth cookies
  const hasAuthCookie = cookies.some(c => c.name === 'access_token' || c.name === 'refresh_token');
  if (!hasAuthCookie) {
    console.log('⚠️ Warning: No auth cookies found, but continuing...');
  }
  
  // Save storage state to be used in subsequent tests
  await page.context().storageState({ path: authFile });
  
  console.log('✅ Auth setup completed successfully');
});
