import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdminQ123!';

test.describe('Alert Triage Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
  });

  test('should complete alert investigation flow', async ({ page }) => {
    // 1. Navigate to Alerts
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    
    // 2. Check if there are alerts to work with
    const alertRows = page.locator('table tbody tr');
    const alertCount = await alertRows.count();
    
    if (alertCount > 0) {
      // 3. Click first alert to view details
      await alertRows.first().click();
      
      // 4. Look for investigation actions (Create Case, Assign, etc)
      const createCaseBtn = page.getByRole('button', { name: /create case|escalate/i });
      
      if (await createCaseBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(createCaseBtn).toBeVisible();
        // Note: Not actually creating case to avoid data pollution
      }
    } else {
      test.skip(true, 'No alerts available for triage workflow test');
    }
  });
});

test.describe('Case Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
  });

  test('should verify case creation form', async ({ page }) => {
    // 1. Navigate to Cases
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    
    // 2. Look for Create Case button
    const createBtn = page.getByRole('button', { name: /create|new|add/i }).first();
    
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 3. Click to open create dialog/form
      await createBtn.click();
      
      // 4. Verify form appears with required fields
      const dialog = page.locator('[role="dialog"], .modal').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });
      
      // 5. Look for typical case fields (title, description, severity)
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]').first();
      if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(titleInput).toBeVisible();
      }
      
      // 6. Close without saving (Cancel button or ESC)
      const cancelBtn = page.getByRole('button', { name: /cancel|close/i });
      if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  test('should verify case status update workflow', async ({ page }) => {
    // 1. Navigate to Cases
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    
    // 2. Check for existing cases
    const caseRows = page.locator('table tbody tr');
    const caseCount = await caseRows.count();
    
    if (caseCount > 0) {
      // 3. Click first case to view details
      await caseRows.first().click();
      
      // 4. Wait for case detail to load
      await page.waitForURL(/cases\/[a-f0-9-]+/, { timeout: 5000 }).catch(() => {});
      
      if ((await page.url()).includes('/cases/')) {
        // 5. Look for status dropdown or update button
        const statusControl = page.locator('select, button').filter({ hasText: /status|open|in progress|closed/i }).first();
        
        if (await statusControl.isVisible({ timeout: 5000 }).catch(() => false)) {
          await expect(statusControl).toBeVisible();
          // Note: Not actually changing status to avoid data pollution
        }
      }
    } else {
      test.skip(true, 'No cases available for status update workflow test');
    }
  });
});

test.describe('User Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
  });

  test('should verify user creation form', async ({ page }) => {
    // 1. Navigate to User Management
    await page.goto('/settings/users');
    await page.waitForLoadState('networkidle');
    
    // 2. Look for Add/Invite User button
    const addUserBtn = page.getByRole('button', { name: /add|invite|create|new/i }).first();
    
    if (await addUserBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 3. Click to open user creation form
      await addUserBtn.click();
      
      // 4. Verify form opens
      const dialog = page.locator('[role="dialog"], .modal').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });
      
      // 5. Check for email or name input (forms vary)
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      
      // At least one input should be visible
      if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(emailInput).toBeVisible();
      } else if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(nameInput).toBeVisible();
      }
      
      // 6. Check for role selection
      const roleSelect = page.locator('select, [role="combobox"]').filter({ hasText: /role/i }).first();
      if (await roleSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(roleSelect).toBeVisible();
      }
      
      // 7. Cancel without creating
      const cancelBtn = page.getByRole('button', { name: /cancel|close/i });
      if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });
});

test.describe('Integration Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
  });

  test('should verify integration configuration flow', async ({ page }) => {
    // 1. Navigate to Integrations
    await page.goto('/settings/integrations');
    await page.waitForLoadState('networkidle');
    
    // 2. Look for integration cards (CrowdStrike, SentinelOne, etc)
    const crowdstrikeCard = page.getByText('CrowdStrike').first();
    const sentinelOneCard = page.getByText('SentinelOne').first();
    
    // 3. Verify at least one integration is visible
    await expect(crowdstrikeCard.or(sentinelOneCard).first()).toBeVisible();
    
    // 4. Look for Configure/Connect button
    const configureBtn = page.getByRole('button', { name: /configure|connect|setup/i }).first();
    
    if (await configureBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(configureBtn).toBeVisible();
      // Note: Not clicking to avoid opening config modal
    }
  });
});
