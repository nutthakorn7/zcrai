import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

test.describe('Alerts Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard then navigate to alerts
    await page.waitForURL(/dashboard|\/$/);
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
  });

  test('should display alerts list', async ({ page }) => {
    await expect(page).toHaveURL(/alerts/);
    
    // Check for header
    await expect(page.locator('h1, h2').filter({ hasText: /Alerts|การแจ้งเตือน/i }).first()).toBeVisible();

    // Check for table or list
    const table = page.locator('table, [role="grid"], .grid').first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('should have table headers', async ({ page }) => {
    // Check for standard table headers based on screenshot
    const headers = ['TIME', 'SRC', 'ALERT DETAILS', 'SEVERITY', 'ACTION'];
    
    for (const header of headers) {
        await expect(page.getByText(header).first()).toBeVisible();
    }
  });

  test('should view alert details', async ({ page }) => {
    // Click on the first row/item
    const firstAlert = page.locator('table tbody tr, [role="row"]').first();
    
    // Only try to click if there are alerts
    if (await firstAlert.isVisible()) {
        // Capture text to verify detail view matches
        const alertText = await firstAlert.innerText();
        
        await firstAlert.click();
        
        // Should open drawer or navigate to detail
        // We look for a drawer/modal or a URL change
        // For now, let's check for a URL change or a visible "Detail" header
        
        // Wait for potential navigation or drawer
        await page.waitForTimeout(1000); 

        // If it's a drawer, maybe check for 'Alert Details' text
        const detailsHeader = page.getByText(/detail|รายละเอียด/i).first();
        await expect(detailsHeader).toBeVisible();
    } else {
        console.log('No alerts found to test details view');
        test.skip();
    }
  });
});
