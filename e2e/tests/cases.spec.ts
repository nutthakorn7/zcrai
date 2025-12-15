import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Admin123!';

test.describe('Cases Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Navigate to cases
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
  });

  test('should display cases list', async ({ page }) => {
    await expect(page).toHaveURL(/cases/);
    
    // Should have a table or list view
    const table = page.locator('table, [role="grid"]').first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('should have create case button', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /create|new|สร้าง|เพิ่ม/i });
    await expect(createBtn).toBeVisible();
  });

  test('should open create case modal', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /create|new|สร้าง|เพิ่ม/i });
    await createBtn.click();
    
    // Modal should appear
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('should have filter options', async ({ page }) => {
    // Look for filter/search elements
    const filters = page.locator('input[type="search"], [placeholder*="search"], [placeholder*="filter"]');
    await expect(filters.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Case Detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
  });

  test('should navigate to case detail when clicking a case', async ({ page }) => {
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    
    // Click first case row if exists
    const caseRow = page.locator('table tbody tr, [role="row"]').first();
    if (await caseRow.isVisible()) {
      await caseRow.click();
      await expect(page).toHaveURL(/cases\/[a-f0-9-]+/);
    }
  });
});
