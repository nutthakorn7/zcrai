import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdminQ123!';

test.describe('Settings Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard then navigate to settings
    await page.waitForURL(/dashboard|\/$/);
    await page.goto('/settings');
    // Settings usually redirects to /settings/profile
    await page.waitForURL(/\/settings/);
  });

  test('should redirect to profile by default', async ({ page }) => {
    await expect(page).toHaveURL(/settings\/profile/);
    
    // Check for "My Profile" tab being active or "Personal Information" header
    await expect(page.getByText('Personal Information').first()).toBeVisible();
    await expect(page.locator('input[value="superadmin@zcr.ai"]')).toBeVisible();
  });

  test('should navigate to integrations', async ({ page }) => {
    // Click Integrations tab or link
    await page.click('text=Integrations');
    
    await expect(page).toHaveURL(/settings\/integrations/);
    await expect(page.getByText('CrowdStrike', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('SentinelOne', { exact: false }).first()).toBeVisible();
  });

  test('should navigate to user management', async ({ page }) => {
    // Click User Management tab
    await page.click('text=User Management');
    
    await expect(page).toHaveURL(/settings\/users/);
    
    // Check for users list/table
    const table = page.locator('table, [role="grid"]').first();
    await expect(table).toBeVisible();
    
    // Check for "Add User" or "Invite" button
    await expect(page.getByRole('button', { name: /add|invite|เพิ่ม/i }).first()).toBeVisible();
  });

  test('should navigate to SSO settings', async ({ page }) => {
    await page.click('text=Single Sign-On');
    await expect(page).toHaveURL(/settings\/sso/);
    await expect(page.locator('h1, h2').filter({ hasText: /sso|single sign/i }).first()).toBeVisible();
  });

  test('should navigate to MFA settings', async ({ page }) => {
    await page.click('text=MFA');
    await expect(page).toHaveURL(/settings\/mfa/);
    await expect(page.locator('h1, h2').filter({ hasText: /mfa|multi.factor|two.factor/i }).first()).toBeVisible();
  });

  test('should navigate to Notification Channels', async ({ page }) => {
    await page.click('text=Notifications');
    await expect(page).toHaveURL(/settings\/notifications/);
    const content = page.locator('table, .grid, h1, h2').first();
    await expect(content).toBeVisible();
  });

  test('should navigate to Tenant Management', async ({ page }) => {
    await page.click('text=Tenant Management');
    await expect(page).toHaveURL(/settings\/tenants/);
    const table = page.locator('table, [role="grid"]').first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Retention Settings', async ({ page }) => {
    await page.click('text=Retention');
    await expect(page).toHaveURL(/settings\/retention/);
    await expect(page.locator('h1, h2').filter({ hasText: /retention|data/i }).first()).toBeVisible();
  });

  test('should navigate to Parsers', async ({ page }) => {
    await page.click('text=Parsers');
    await expect(page).toHaveURL(/settings\/parsers/);
    const content = page.locator('table, .grid, h1, h2').first();
    await expect(content).toBeVisible();
  });

  test('should navigate to EDR Actions', async ({ page }) => {
    await page.click('text=EDR Actions');
    await expect(page).toHaveURL(/settings\/edr-actions/);
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible();
  });

  test('should navigate to Audit Logs', async ({ page }) => {
    await page.click('text=Audit Logs');
    await expect(page).toHaveURL(/settings\/audit-logs/);
    const table = page.locator('table, [role="grid"]').first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });
});
