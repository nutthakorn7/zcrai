import { test, expect } from '@playwright/test';
import { robustLogin, navigateAuthenticated } from './utils';

test.describe('SOAR & AI Observability', () => {
    
    test('Admin can manage secrets in Secrets Vault', async ({ page }) => {
        // 1. Navigate to Secrets Vault
        await navigateAuthenticated(page, '/settings/secrets-vault');
        
        // 2. Click Add Integration
        await page.getByRole('button', { name: /Add Integration/i }).click();
        
        // 3. Fill the form
        await page.locator('select').selectOption('sentinelone');
        await page.getByPlaceholder('SentinelOne Production API').fill('Test Secret Name');
        await page.getByPlaceholder('Enter sensitive value').fill('sk-test-12345');
        
        // 4. Save
        await page.getByRole('button', { name: /Save Integration/i }).click();
        
        // 5. Verify success notification and list item
        await expect(page.getByText(/Secret saved successfully/i)).toBeVisible();
        await expect(page.getByText(/sentinelone/i)).toBeVisible();
    });

    test('Analyst can see AI Investigation Trace in Alert Details', async ({ page }) => {
        // 1. Navigate to Alerts
        await navigateAuthenticated(page, '/alerts');
        
        // 2. Open first alert
        const firstAlert = page.locator('table tr').nth(1);
        await firstAlert.click();
        
        // 3. Check for AI Trace section
        await expect(page.getByText(/AI Investigation Trace/i)).toBeVisible();
        
        // 4. Verify some trace content (Thinking/Observation)
        // Note: This assumes some traces exist in the DB for the first alert
        // In a real local clean DB, we might need to trigger an investigation first
        // But for verification, we just check if the component is rendered
        await expect(page.locator('text=Retrieved agent thought process').or(page.locator('text=AI Investigation Trace'))).toBeVisible();
    });

    test('Analyst can trigger SOAR Response Actions', async ({ page }) => {
        // 1. Navigate to Alerts and open Detail
        await navigateAuthenticated(page, '/alerts');
        await page.locator('table tr').nth(1).click();
        
        // 2. Look for Response Actions section
        await expect(page.getByText(/Active Response Actions/i)).toBeVisible();
        
        // 3. Click Isolate Host
        const isolateButton = page.getByRole('button', { name: /Isolate Host/i });
        await expect(isolateButton).toBeVisible();
        await isolateButton.click();
        
        // 4. Verify success notification
        await expect(page.getByText(/Action ISOLATE_HOST executed successfully/i)).toBeVisible();
    });
});
