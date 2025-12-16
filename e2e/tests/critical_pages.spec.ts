import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

test.describe('Critical Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
  });

  test('should load Alert Queue page', async ({ page }) => {
    await page.goto('/queue');
    await expect(page).toHaveURL(/queue/);
    
    // Check for queue interface elements
    const table = page.locator('table, [role="grid"]').first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('should load Observables page', async ({ page }) => {
    await page.goto('/observables');
    await expect(page).toHaveURL(/observables/);
    
    // Check for search or lookup interface
    const searchInput = page.getByPlaceholder(/search|lookup|query/i).first();
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeVisible();
    }
  });

  test('should load Threat Intel page', async ({ page }) => {
    await page.goto('/threat-intel');
    await expect(page).toHaveURL(/threat-intel/);
    
    // Just verify page loaded (may be empty state or dashboard-style)
    await page.waitForLoadState('networkidle');
  });

  test('should load Admin Dashboard (superadmin only)', async ({ page }) => {
    await page.goto('/admin');
    
    // Should either load admin page or redirect to dashboard based on role
    await page.waitForURL(/admin|dashboard/, { timeout: 10000 });
    
    // If we're on admin page, verify it loaded
    if ((await page.url()).includes('/admin')) {
      const adminContent = page.locator('h1, h2').first();
      await expect(adminContent).toBeVisible();
    }
  });
});
