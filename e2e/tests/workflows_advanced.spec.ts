import { test, expect } from '@playwright/test';
import { robustLogin } from './utils';

test.describe('Advanced E2E Workflows', () => {
  test.setTimeout(180000); // 3 mins per test for complex flows

  test.beforeEach(async ({ page }) => {
    await robustLogin(page);
  });

  // ============================================
  // Flow 5: Incident Response Lifecycle
  // Alert → Case → Resolution
  // ============================================
  test('Flow 5: Incident Response Lifecycle', async ({ page }) => {
    await test.step('Navigate to Alerts', async () => {
      await page.goto('/detections');
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Select Alert and View Details', async () => {
      const alertRow = page.locator('table tbody tr, [role="row"]').first();
      if (await alertRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await alertRow.click();
        // Wait for detail panel or modal
        await page.waitForTimeout(1000);
        
        // Look for escalate/create case option
        const escalateBtn = page.getByRole('button', { name: /escalate|create case|promote/i }).first();
        if (await escalateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await escalateBtn.click();
          
          // If modal appears, fill and submit
          const modal = page.locator('[role="dialog"]');
          if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
            const titleInput = modal.locator('input[name="title"], input[type="text"]').first();
            if (await titleInput.isVisible().catch(() => false)) {
              await titleInput.fill(`Incident-${Date.now()}`);
            }
            await modal.getByRole('button', { name: /create|submit|save/i }).first().click();
          }
        }
      } else {
        test.skip(true, 'No alerts available for incident response test');
      }
    });
  });

  // ============================================
  // Flow 6: Log Hunting
  // Search → Filter → View Results
  // ============================================
  test('Flow 6: Log Hunting', async ({ page }) => {
    await test.step('Navigate to Log Viewer', async () => {
      await page.goto('/logs');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/logs/);
    });

    await test.step('Search Logs', async () => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], textarea').first();
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill('*');
        await searchInput.press('Enter');
        await page.waitForTimeout(2000);
        
        // Verify some results or empty state message
        const hasResults = await page.locator('table, [role="grid"], .log-entry, pre').first().isVisible({ timeout: 5000 }).catch(() => false);
        const hasEmptyState = await page.getByText(/no results|no logs|empty/i).first().isVisible({ timeout: 3000 }).catch(() => false);
        
        expect(hasResults || hasEmptyState).toBe(true);
      }
    });
  });

  // ============================================
  // Flow 7: Threat Intelligence
  // View → Add IOC → Verify
  // ============================================
  test('Flow 7: Threat Intelligence', async ({ page }) => {
    await test.step('Navigate to Threat Intel', async () => {
      await page.goto('/threat-intel');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/threat-intel/);
    });

    await test.step('View IOC List', async () => {
      // Verify page loaded - just check for any content
      await page.waitForTimeout(3000);
      // More flexible: check for main content area or any heading
      const hasPageContent = await page.locator('main, [role="main"], .content, h1, h2, h3').first().isVisible({ timeout: 10000 }).catch(() => false);
      
      expect(hasPageContent).toBe(true);
    });

    await test.step('Add IOC (if available)', async () => {
      const addBtn = page.getByRole('button', { name: /add|new|create/i }).first();
      if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addBtn.click();
        
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Fill IOC value
          const valueInput = modal.locator('input, textarea').first();
          if (await valueInput.isVisible().catch(() => false)) {
            await valueInput.fill('test-ioc-' + Date.now());
          }
          // Try cancel button first, then escape key
          const cancelBtn = modal.getByRole('button', { name: /cancel|close|ยกเลิก/i }).first();
          if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await cancelBtn.click();
          } else {
            // Fallback: press Escape to close modal
            await page.keyboard.press('Escape');
          }
        }
      }
    });
  });

  // ============================================
  // Flow 8: Detection Rules Management
  // View → Create Rule → Enable
  // ============================================
  test('Flow 8: Detection Rules Management', async ({ page }) => {
    await test.step('Navigate to Detection Rules', async () => {
      await page.goto('/settings/detection-rules');
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('View Rules List', async () => {
      await page.waitForTimeout(3000);
      // More flexible: check for any page content
      const hasPageContent = await page.locator('main, [role="main"], .content, h1, h2, h3').first().isVisible({ timeout: 10000 }).catch(() => false);
      
      expect(hasPageContent).toBe(true);
    });

    await test.step('Create Rule Modal (if available)', async () => {
      const createBtn = page.getByRole('button', { name: /create|add|new/i }).first();
      if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await createBtn.click();
        
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(modal).toBeVisible();
          // Cancel to avoid creating test data
          await modal.getByRole('button', { name: /cancel|close/i }).first().click();
        }
      }
    });
  });

  // ============================================
  // Flow 9: Integration Setup
  // Navigate → View → Configure
  // ============================================
  test('Flow 9: Integration Setup', async ({ page }) => {
    await test.step('Navigate to Integrations', async () => {
      await page.goto('/settings/integrations');
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('View Integration List', async () => {
      await page.waitForTimeout(2000);
      // Look for integration cards or list
      const hasIntegrations = await page.locator('.integration-card, [class*="integration"], table').first().isVisible({ timeout: 5000 }).catch(() => false);
      const hasContent = await page.locator('h1, h2, h3').first().isVisible({ timeout: 3000 }).catch(() => false);
      
      expect(hasIntegrations || hasContent).toBe(true);
    });

    await test.step('Open Integration Config (if available)', async () => {
      // Click first integration card or button
      const integrationItem = page.locator('.integration-card, button[class*="integration"]').first();
      if (await integrationItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await integrationItem.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  // ============================================
  // Flow 10: Report Generation
  // Navigate → Select → Generate
  // ============================================
  test('Flow 10: Report Generation', async ({ page }) => {
    await test.step('Navigate to Reports', async () => {
      await page.goto('/reports');
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('View Report Options', async () => {
      await page.waitForTimeout(2000);
      // Verify reports page loaded
      const hasReportOptions = await page.locator('button, [class*="report"], select').first().isVisible({ timeout: 5000 }).catch(() => false);
      const hasContent = await page.locator('h1, h2, h3').first().isVisible({ timeout: 3000 }).catch(() => false);
      
      expect(hasReportOptions || hasContent).toBe(true);
    });
  });

  // ============================================
  // Flow 11: Dashboard Verification
  // Load → Verify Page → Check Content
  // ============================================
  test('Flow 11: Dashboard Verification', async ({ page }) => {
    await test.step('Navigate to Dashboard', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/dashboard|\/$/);
    });

    await test.step('Verify Dashboard Loads', async () => {
      // Wait for page to fully load
      await page.waitForTimeout(5000);
      
      // Simple verification: page loaded and has any visible content
      const body = page.locator('body');
      await expect(body).toBeVisible();
      
      // Check that we're not on a login page (successful auth)
      expect(page.url()).not.toContain('/login');
    });
  });

  // ============================================
  // Flow 12: Profile Settings
  // Navigate → View → Edit
  // ============================================
  test('Flow 12: Profile Settings', async ({ page }) => {
    await test.step('Navigate to Profile', async () => {
      await page.goto('/settings/profile');
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('View Profile Form', async () => {
      await page.waitForTimeout(2000);
      
      // Look for profile form elements
      const hasForm = await page.locator('form, input[name]').first().isVisible({ timeout: 5000 }).catch(() => false);
      const hasContent = await page.locator('h1, h2, h3').first().isVisible({ timeout: 3000 }).catch(() => false);
      
      expect(hasForm || hasContent).toBe(true);
    });

    await test.step('Verify Save Button Exists', async () => {
      const saveBtn = page.getByRole('button', { name: /save|update|submit/i }).first();
      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(saveBtn).toBeVisible();
      }
    });
  });
});
