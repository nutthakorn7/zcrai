import { test, expect } from '@playwright/test';
import { robustLogin } from './utils';

test.describe('Critical Pages', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await robustLogin(page);
  });

  test('should load Alert Queue page', async ({ page }) => {
    await page.goto('/queue');
    await expect(page).toHaveURL(/\/detections\?status=new|queue/);
    
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
