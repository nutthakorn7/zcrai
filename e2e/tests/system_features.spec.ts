import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

test.describe('System Enterprise Features', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL(/dashboard|\/$/);
    await page.goto('/settings');
    await page.waitForURL(/\/settings/);
  });

  test('should verify token expiry visibility in Integrations', async ({ page }) => {
    await page.click('text=Integrations');
    await expect(page).toHaveURL(/settings\/integrations/);

    // Check for "Token Expiry" text which ensures our UI logic is rendering
    // It might say "Token Expiry: Not monitored" or a date.
    // We check for "Token Expiry" label.
    // Use first() because multiple cards might have it.
    await expect(page.getByText('Token Expiry').first()).toBeVisible();
  });

  test('should navigate to System Management and see Backups', async ({ page }) => {
    // Click System Management link (we just added it)
    await page.click('text=System Management');
    await expect(page).toHaveURL(/settings\/system/);

    // Verify Tab Headers
    await expect(page.getByRole('tab', { name: 'System Backups' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'License' })).toBeVisible();

    // Verify Backup Actions
    await expect(page.getByRole('button', { name: 'Create Manual Backup' })).toBeVisible();
    
    // Check if table exists
    await expect(page.getByRole('grid')).toBeVisible();
    
    // Check for Download Button (icon button)
    // We can't easily check for specific icon without test-id, but we can check if table has content or "No backups found"
    // If table has rows, check for download button.
  });
  
  test('should verify Approval Center navigation', async ({ page }) => {
    // Navigate to Approvals (Sidebar main menu)
    // Need to find "Approvals" link in main sidebar.
    // It might be under "Automation" or top level.
    // In AppRoutes, it is /approvals.
    // Let's try direct navigation.
    await page.goto('/approvals');
    await expect(page).toHaveURL(/\/approvals/);
    await expect(page.getByText('Approval Center')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Action Approvals' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Input Requests' })).toBeVisible();
  });
});
