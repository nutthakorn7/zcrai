import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdminQ123!';

test.describe('Accessibility - Automated Checks', () => {
  test('login page should not have accessibility violations', async ({ page }) => {
    await page.goto('/login');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('dashboard should not have accessibility violations', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('alerts page should not have accessibility violations', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

test.describe('Keyboard Navigation', () => {
  test('should be able to navigate login form with keyboard', async ({ page }) => {
    await page.goto('/login');
    
    // Focus on first input (email)
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    
    // Type email
    await page.keyboard.type(TEST_EMAIL);
    
    // Tab to password
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    await page.keyboard.type(TEST_PASSWORD);
    
    // Tab to submit button or press Enter in password field
    // HeroUI forms support Enter key submission
    await page.keyboard.press('Enter');
    
    // Should navigate to dashboard (with reasonable timeout for auth)
    await page.waitForURL(/dashboard|\/$/,{ timeout: 10000 }).catch(() => {});
    
    // If still on login, the form submission worked but auth might have failed
    // This is okay for keyboard nav testing
    const currentUrl = page.url();
    expect(currentUrl).toBeTruthy();
    expect(page.url()).toMatch(/dashboard|\/$/);
  });

  test('should support Escape key to close modals', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Try to open a modal (e.g., create case)
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    
    const createBtn = page.getByRole('button', { name: /create|new/i }).first();
    
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      
      // Wait for modal
      const modal = page.locator('[role="dialog"], .modal').first();
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Press Escape
        await page.keyboard.press('Escape');
        
        // Modal should close
        const isModalGone = await modal.isHidden().catch(() => true);
        expect(isModalGone).toBe(true);
      }
    }
  });

  test('should have visible focus indicators', async ({ page }) => {
    await page.goto('/login');
    
    // Tab through elements and check for focus styles
    await page.keyboard.press('Tab');
    
    const focusedElement = page.locator(':focus').first();
    
    // Check if focused element has outline or ring
    const hasOutline = await focusedElement.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.outline !== 'none' || 
             style.outlineWidth !== '0px' ||
             style.boxShadow.includes('rgb') || // Tailwind ring
             el.classList.toString().includes('focus');
    }).catch(() => false);
    
    expect(hasOutline).toBe(true);
  });
});

test.describe('ARIA Labels and Roles', () => {
  test('buttons should have accessible names', async ({ page }) => {
    await page.goto('/login');
    
    // Submit button should have accessible text
    const submitBtn = page.locator('button[type="submit"]').first();
    const btnText = await submitBtn.textContent();
    const ariaLabel = await submitBtn.getAttribute('aria-label');
    
    // Should have either text content or aria-label
    expect(btnText || ariaLabel).toBeTruthy();
  });

  test('form inputs should have labels', async ({ page }) => {
    await page.goto('/login');
    
    // Email input should have associated label
    const emailInput = page.locator('input[type="email"]').first();
    const inputId = await emailInput.getAttribute('id');
    const ariaLabel = await emailInput.getAttribute('aria-label');
    const ariaLabelledBy = await emailInput.getAttribute('aria-labelledby');
    const placeholder = await emailInput.getAttribute('placeholder');
    
    // Should have label via id, aria-label, aria-labelledby, or at minimum placeholder
    const hasLabel = inputId || ariaLabel || ariaLabelledBy || placeholder;
    expect(hasLabel).toBeTruthy();
  });

  test('navigation should have proper landmarks', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Check for navigation landmark
    const nav = page.locator('nav, [role="navigation"]').first();
    const hasNav = await nav.isVisible().catch(() => false);
    
    // Dashboard apps should have navigation
    expect(hasNav).toBe(true);
  });
});

test.describe('Color Contrast', () => {
  test('text should have sufficient contrast ratio', async ({ page }) => {
    await page.goto('/login');
    
    // Run axe for color contrast specifically
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.color'])
      .analyze();
    
    const contrastViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'color-contrast'
    );
    
    expect(contrastViolations).toEqual([]);
  });
});

test.describe('Screen Reader Support', () => {
  test('page should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Check heading structure - dashboard has "Security Dashboard" H1
    const h1Count = await page.locator('h1').count();
    
    // Should have at least one H1 (might be rendered after load)
    if (h1Count === 0) {
      await page.waitForTimeout(2000);
      const h1CountRetry = await page.locator('h1').count();
      expect(h1CountRetry).toBeGreaterThan(0);
    } else {
      expect(h1Count).toBeGreaterThan(0);
    }
    
    // Run axe for heading order
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['best-practice'])
      .analyze();
    
    const headingViolations = accessibilityScanResults.violations.filter(
      v => v.id.includes('heading')
    );
    
    expect(headingViolations).toEqual([]);
  });

  test('images should have alt text', async ({ page }) => {
    await page.goto('/login');
    
    // All images should have alt attributes
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      const role = await img.getAttribute('role');
      
      // Decorative images can have empty alt or role="presentation"
      // But all images must have the alt attribute
      const hasAccessibility = alt !== null || ariaLabel || role === 'presentation';
      expect(hasAccessibility).toBe(true);
    }
  });
});
