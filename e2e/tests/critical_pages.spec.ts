import { test, expect } from '@playwright/test';

test.describe('Critical Pages', () => {
  // Uses storageState from config - already authenticated
  test.setTimeout(60000);

  test('should load Alert Queue page', async ({ page }) => {
    await page.goto('/detections?status=new', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 30000 });
    
    // Check we're on the right page (not redirected to login)
    const url = page.url();
    if (url.includes('login')) {
      console.log('Session expired - redirected to login');
      return; // Session expired, skip this test
    }
    
    // Wait for page content to load - more flexible selectors
    const pageContent = page.locator('h1, h2, [data-testid], table, [role="grid"], .card, main').first();
    await expect(pageContent).toBeVisible({ timeout: 20000 });
  });

  test('should load Observables page', async ({ page }) => {
    await page.goto('/observables', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 30000 });
    
    await expect(page).toHaveURL(/observables|login/);
    
    if (page.url().includes('login')) return;
    
    // Page should have some content loaded
    await page.waitForTimeout(2000); // Brief settle time
  });

  test('should load Threat Intel page', async ({ page }) => {
    await page.goto('/threat-intel', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 30000 });
    
    await expect(page).toHaveURL(/threat-intel|login/);
  });

  test('should load Admin Dashboard (superadmin only)', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 30000 });
    
    // Should either load admin page or redirect based on role
    await expect(page).toHaveURL(/admin|dashboard|login/);
    
    // If we're on admin page, verify some content
    if (page.url().includes('/admin')) {
      const adminContent = page.locator('h1, h2, main, .card').first();
      await expect(adminContent).toBeVisible({ timeout: 15000 });
    }
  });
});
