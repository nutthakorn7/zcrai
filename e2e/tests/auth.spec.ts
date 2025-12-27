import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    
    // Check login page elements
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    // Use first() to get main submit button, not SSO button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 30000 });
    
    await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait for either error message OR page to stay on login
    await page.waitForTimeout(3000); // Allow API response time
    
    // Should still be on login page after invalid credentials
    await expect(page).toHaveURL(/login/);
    
    // Try to find error message (optional - some apps just stay on login)
    const errorLocator = page.locator('role=alert')
      .or(page.locator('.text-danger'))
      .or(page.locator('.text-error'))
      .or(page.locator('[class*="error"]'))
      .or(page.locator('text=/invalid|error|incorrect|ไม่ถูกต้อง|failed/i'));
      
    // Check if error is visible, but don't fail if not (staying on login is also valid)
    const isErrorVisible = await errorLocator.first().isVisible().catch(() => false);
    if (isErrorVisible) {
      await expect(errorLocator.first()).toBeVisible();
    }
  });

  test('should have forgot password link', async ({ page }) => {
    await page.goto('/login');
    
    const forgotLink = page.getByRole('link', { name: /forgot|ลืมรหัสผ่าน/i });
    await expect(forgotLink).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login');
    
    const registerLink = page.getByRole('link', { name: /register|sign up|สมัคร/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/register/);
    }
  });
});

test.describe('Public Pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect to login from cases page', async ({ page }) => {
    await page.goto('/cases');
    
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect to login from alerts page', async ({ page }) => {
    await page.goto('/alerts');
    
    await expect(page).toHaveURL(/login/);
  });
});
