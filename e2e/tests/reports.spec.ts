import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

test.describe('Reports Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard then navigate to reports
    await page.waitForURL(/dashboard|\/$/);
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
  });

  test('should display reports list', async ({ page }) => {
    await expect(page).toHaveURL(/reports/);
    
    // Check for header
    await expect(page.locator('h1, h2').filter({ hasText: /report|รายงาน/i }).first()).toBeVisible();

    // Check for table or grid
    const list = page.locator('table, [role="grid"], .grid, .report-card').first();
    await expect(list).toBeVisible({ timeout: 10000 });
  });

  test('should display report tabs and export', async ({ page }) => {
    // Check for "Export PDF" button
    const exportBtn = page.getByRole('button', { name: /export pdf/i }).first();
    await expect(exportBtn).toBeVisible();

    // Check for Tabs
    const dashboardTab = page.getByText('Dashboard Report').first();
    const scheduledTab = page.getByText('Scheduled Reports').first();
    
    await expect(dashboardTab).toBeVisible();
    await expect(scheduledTab).toBeVisible();
  });
});
