import { test, expect } from '@playwright/test';

test.describe('Auth Flows', () => {
  test('should display forgot password page', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page).toHaveURL(/forgot-password/);
    
    // Check for email input
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
    
    // Check for submit button
    const submitBtn = page.getByRole('button', { name: /send|reset|submit/i }).first();
    await expect(submitBtn).toBeVisible();
  });

  test('should display reset password page', async ({ page }) => {
    // Note: This page typically requires a token in URL, so we just check it loads
    await page.goto('/reset-password');
    await expect(page).toHaveURL(/reset-password/);
    
    // Should show password inputs or redirect/error message
    const content = page.locator('input[type="password"], h1, h2').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('should have link from login to forgot password', async ({ page }) => {
    await page.goto('/login');
    
    const forgotLink = page.getByRole('link', { name: /forgot|ลืมรหัสผ่าน/i });
    await expect(forgotLink).toBeVisible();
    
    await forgotLink.click();
    await expect(page).toHaveURL(/forgot-password/);
  });
});
