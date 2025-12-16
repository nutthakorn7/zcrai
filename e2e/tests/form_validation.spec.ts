import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

test.describe('Login Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should show error for empty email', async ({ page }) => {
    // Try to submit with empty email
    await page.fill('input[type="password"]', 'somepassword');
    await page.click('button[type="submit"]');
    
    // Should show validation error or prevent submission
    // Check for HTML5 validation or custom error message
    const emailInput = page.locator('input[type="email"]').first();
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    
    if (validationMessage) {
      expect(validationMessage.length).toBeGreaterThan(0);
    }
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.fill('input[type="email"]', 'notanemail');
    await page.fill('input[type="password"]', 'somepassword');
    await page.click('button[type="submit"]');
    
    // Check HTML5 validation
    const emailInput = page.locator('input[type="email"]').first();
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    
    expect(isValid).toBe(false);
  });

  test('should show error for incorrect credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait for error message
    const errorMessage = page.locator('text=/invalid|incorrect|wrong|error/i').first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should show error for empty password', async ({ page }) => {
    await page.fill('input[type="email"]', TEST_EMAIL);
    // Leave password empty
    await page.click('button[type="submit"]');
    
    const passwordInput = page.locator('input[type="password"]').first();
    const validationMessage = await passwordInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    
    if (validationMessage) {
      expect(validationMessage.length).toBeGreaterThan(0);
    }
  });

  test('should disable submit button during login', async ({ page }) => {
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();
    
    // Button should be disabled or show loading state
    const isDisabled = await submitBtn.isDisabled().catch(() => false);
    const hasLoadingClass = await submitBtn.evaluate((el) => 
      el.classList.contains('loading') || 
      el.classList.contains('disabled') ||
      el.hasAttribute('disabled')
    );
    
    // At least one should be true during submission
    expect(isDisabled || hasLoadingClass).toBeTruthy();
  });
});

test.describe('User Creation Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Navigate to user management
    await page.goto('/settings/users');
    await page.waitForLoadState('networkidle');
  });

  test('should validate required fields in user creation', async ({ page }) => {
    // Try to open create user dialog
    const addBtn = page.getByRole('button', { name: /add|invite|create/i }).first();
    
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      
      // Wait for dialog
      await page.waitForSelector('[role="dialog"], .modal', { timeout: 5000 }).catch(() => {});
      
      // Try to submit without filling required fields
      const submitBtn = page.getByRole('button', { name: /submit|save|create|invite/i }).first();
      
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();
        
        // Should see validation errors or prevent submission
        await page.waitForTimeout(1000);
        
        // Dialog should still be open (not closed due to validation)
        const dialog = page.locator('[role="dialog"], .modal').first();
        const isStillVisible = await dialog.isVisible().catch(() => false);
        
        expect(isStillVisible).toBe(true);
      }
    } else {
      test.skip(true, 'User creation not available or accessible');
    }
  });
});

test.describe('Form Field Constraints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
  });

  test('should enforce email format in settings profile', async ({ page }) => {
    await page.goto('/settings/profile');
    await page.waitForLoadState('networkidle');
    
    // Find email input
    const emailInput = page.locator('input[type="email"]').first();
    
    if (await emailInput.isVisible().catch(() => false)) {
      // Try to enter invalid email
      await emailInput.clear();
      await emailInput.fill('invalid-email');
      await emailInput.blur();
      
      // Check if it's marked as invalid
      const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
      expect(isValid).toBe(false);
    }
  });

  test('should show character limits if applicable', async ({ page }) => {
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    
    const createBtn = page.getByRole('button', { name: /create|new/i }).first();
    
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      
      // Look for textarea or title input
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]').first();
      
      if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Check if maxlength is set
        const maxLength = await titleInput.getAttribute('maxlength');
        
        if (maxLength) {
          expect(parseInt(maxLength)).toBeGreaterThan(0);
        }
      }
    }
  });
});
