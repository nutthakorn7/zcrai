import { test, expect } from '@playwright/test';

// Test credentials - use environment variables or test account
const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Admin123!';

test.describe('Dashboard (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(/dashboard|\/$/);
  });

  test('should display dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard|\/$/);
    
    // Dashboard should have key elements
    await expect(page.locator('text=/dashboard|แดชบอร์ด/i').first()).toBeVisible({ timeout: 15000 });
  });

  test('should display security metrics cards', async ({ page }) => {
    // Look for severity cards or metrics
    const criticalCard = page.locator('text=/critical|วิกฤต/i').first();
    const highCard = page.locator('text=/high|สูง/i').first();
    
    // At least one metric should be visible
    await expect(criticalCard.or(highCard)).toBeVisible({ timeout: 10000 });
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
