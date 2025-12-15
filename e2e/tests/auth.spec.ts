import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    
    // Check login page elements
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    // Use first() to get main submit button, not SSO button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=/invalid|error|incorrect|ไม่ถูกต้อง/i')).toBeVisible({ timeout: 10000 });
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
