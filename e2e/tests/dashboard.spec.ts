import { test, expect } from '@playwright/test';

// Test credentials - use environment variables or test account
const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

test.describe('Dashboard (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard and ensure header is visible (SPA loaded)
    await page.waitForURL(/dashboard|\/$/);
    await expect(page.locator('text=Security Dashboard')).toBeVisible({ timeout: 20000 });
  });

  test('should display dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard|\/$/);
    
    // Dashboard should have key elements
    await expect(page.locator('text=Security Dashboard')).toBeVisible();
  });

  test('should display security metrics cards', async ({ page }) => {
    // Look for severity cards or metrics
    const totalEvents = page.getByText('Total Events', { exact: false }).first();
    const criticalText = page.getByText('Critical', { exact: false }).first();
    
    // At least one metric should be visible
    await expect(totalEvents.or(criticalText).first()).toBeVisible({ timeout: 10000 });
  });

  test('should have navigation sidebar', async ({ page }) => {
    // Check for navigation items
    const sidebar = page.locator('nav, [role="navigation"]').first();
    await expect(sidebar).toBeVisible();
  });

  test('should navigate to cases page', async ({ page }) => {
    await page.click('text=/cases|เคส/i');
    await expect(page).toHaveURL(/cases/);
  });

  test('should navigate to alerts page', async ({ page }) => {
    await page.click('text=/alerts|การแจ้งเตือน/i');
    await expect(page).toHaveURL(/alerts/);
  });

  test('should navigate to logs page', async ({ page }) => {
    await page.click('text=/logs|บันทึก/i');
    await expect(page).toHaveURL(/logs/);
  });
});
