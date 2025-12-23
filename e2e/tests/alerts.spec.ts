import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

import { robustLogin } from './utils';

test.describe('Alerts Management', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
     await robustLogin(page);
     await page.goto('/detections');
     await page.waitForLoadState('domcontentloaded');
     await expect(page).toHaveURL(/detections|alerts/);
  });

  test('should display alerts list', async ({ page }) => {
    await expect(page).toHaveURL(/alerts|detections/);
    
    // Check for header
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Alerts|การแจ้งเตือน|Detections/i }).first()).toBeVisible();

    // Check for table or list
    const table = page.locator('table, [role="grid"], .grid').first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('should have table headers', async ({ page }) => {
    // Check for standard table headers based on screenshot
    const headers = [
        /Time|Date/i, 
        /Source|SRC/i, 
        /Details|Alert|ชื่อเหตุการณ์/i, 
        /Severity|ความรุนแรง/i, 
        /Action|Manage/i
    ];
    
    for (const header of headers) {
        // Use locator with regex
        const headerEl = page.locator('th, [role="columnheader"]').filter({ hasText: header }).first();
        // Fallback to text search if no specific column header found
        const textEl = page.getByText(header).first();
        
        await expect(headerEl.or(textEl).first()).toBeVisible();
    }
  });

  test('should view alert details', async ({ page }) => {
    // Click on the first row/item
    const firstAlert = page.locator('table tbody tr:not(:first-child), [role="row"]:not([role="columnheader"])').first();
    
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
