import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

test.describe('Playbooks Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard then navigate to playbooks
    await page.waitForURL(/dashboard|\/$/);
    await page.goto('/playbooks');
    await page.waitForLoadState('networkidle');
  });

  test('should display playbooks list', async ({ page }) => {
    await expect(page).toHaveURL(/playbooks/);
    
    // Check for header
    await expect(page.locator('h1, h2').filter({ hasText: /playbook|automation/i }).first()).toBeVisible();

    // Check for list/grid of playbooks
    const list = page.locator('table, [role="grid"], .grid, .playbook-card').first();
    await expect(list).toBeVisible({ timeout: 10000 });
  });

  test('should have create button', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /create|new|build/i }).first();
    await expect(createBtn).toBeVisible();
  });

  test('should load playbook editor/details', async ({ page }) => {
    // Click first playbook if exists
    const firstItem = page.locator('table tbody tr, .playbook-card, [role="row"]').first();
    const count = await page.locator('table tbody tr, .playbook-card, [role="row"]').count();

    if (count > 0) {
        await firstItem.click();
        
        // Should navigate to editor or details
        await expect(page).toHaveURL(/playbooks\/[a-f0-9-]+/);
        
        // Check for canvas or editor elements
        // Common canvas class/id or "Save" button
        const editorElement = page.locator('.react-flow, canvas, .editor, button:has-text("Save")').first();
        await expect(editorElement).toBeVisible();
    } else {
        test.skip(true, 'No playbooks found to test editor loading');
    }
  });
});
