import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

test.describe('Visual Regression - Key Pages', () => {
  test('login page should match baseline screenshot', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot and compare with baseline
    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixels: 100, // Allow minor rendering differences
      threshold: 0.2
    });
  });

  test('dashboard should match baseline screenshot', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    await page.waitForLoadState('networkidle');
    
    // Wait for dynamic content to load
    await page.waitForTimeout(2000);
    
    await expect(page).toHaveScreenshot('dashboard-page.png', {
      maxDiffPixels: 500, // Dashboard has dynamic content
      threshold: 0.3
    });
  });

  test('alerts page should match baseline screenshot', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page).toHaveScreenshot('alerts-page.png', {
      maxDiffPixels: 300,
      threshold: 0.3
    });
  });

  test('settings page should match baseline screenshot', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('settings-page.png', {
      maxDiffPixels: 200,
      threshold: 0.2
    });
  });
});

test.describe('Visual Regression - Component Screenshots', () => {
  test('navigation menu should be consistent', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Screenshot the navigation element
    const nav = page.locator('nav, aside, [role="navigation"]').first();
    
    if (await nav.isVisible().catch(() => false)) {
      await expect(nav).toHaveScreenshot('navigation-menu.png', {
        maxDiffPixels: 50
      });
    }
  });

  test('header should be consistent across pages', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Screenshot the header
    const header = page.locator('header, [role="banner"]').first();
    
    if (await header.isVisible().catch(() => false)) {
      await expect(header).toHaveScreenshot('header-component.png', {
        maxDiffPixels: 100
      });
    }
  });
});

test.describe('Visual Regression - Responsive Breakpoints', () => {
  test('mobile viewport (375x667) should render correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('mobile-login-375.png', {
      maxDiffPixels: 100,
      fullPage: true
    });
  });

  test('tablet viewport (768x1024) should render correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page).toHaveScreenshot('tablet-dashboard-768.png', {
      maxDiffPixels: 300,
      fullPage: false
    });
  });

  test('desktop viewport (1920x1080) should render correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page).toHaveScreenshot('desktop-dashboard-1920.png', {
      maxDiffPixels: 500,
      fullPage: false
    });
  });

  test('breakpoint transitions should not break layout', async ({ page }) => {
    // Test multiple breakpoints
    const breakpoints = [
      { width: 320, height: 568, name: 'small-mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1280, height: 720, name: 'laptop' },
      { width: 1920, height: 1080, name: 'desktop' }
    ];
    
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    for (const bp of breakpoints) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(500); // Let CSS transitions finish
      
      // Check that main content is visible
      const mainContent = await page.locator('main, [role="main"], h1').first()
        .isVisible().catch(() => false);
      
      expect(mainContent).toBe(true);
    }
  });
});

test.describe('Visual Regression - Dark Mode', () => {
  test('should handle dark mode if available', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Look for theme toggle
    const themeToggle = page.locator('[aria-label*="theme" i], button:has-text(/dark|light/i)').first();
    
    if (await themeToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Take screenshot of light mode
      await expect(page).toHaveScreenshot('dashboard-light-mode.png', {
        maxDiffPixels: 500
      });
      
      // Toggle to dark mode
      await themeToggle.click();
      await page.waitForTimeout(500);
      
      // Take screenshot of dark mode
      await expect(page).toHaveScreenshot('dashboard-dark-mode.png', {
        maxDiffPixels: 500
      });
    }
  });
});

test.describe('Visual Regression - Modal Consistency', () => {
  test('modal dialogs should render consistently', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Navigate to page with modals (settings/users)
    await page.goto('/settings/users');
    await page.waitForLoadState('networkidle');
    
    // Try to open a modal
    const addButton = page.locator('button:has-text(/add|create|new/i)').first();
    
    if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Screenshot the modal
      const modal = page.locator('[role="dialog"], .modal').first();
      
      if (await modal.isVisible().catch(() => false)) {
        await expect(modal).toHaveScreenshot('user-modal.png', {
          maxDiffPixels: 100
        });
      }
    }
  });
});

test.describe('Visual Regression - Data Tables', () => {
  test('data tables should render consistently', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Screenshot the table
    const table = page.locator('table, [role="table"]').first();
    
    if (await table.isVisible().catch(() => false)) {
      await expect(table).toHaveScreenshot('alerts-table.png', {
        maxDiffPixels: 300
      });
    }
  });
});

test.describe('Visual Regression - Form Elements', () => {
  test('form inputs should be styled consistently', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Screenshot the login form
    const form = page.locator('form').first();
    
    await expect(form).toHaveScreenshot('login-form.png', {
      maxDiffPixels: 50
    });
  });

  test('buttons should maintain consistent styling', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Screenshot primary button
    const submitButton = page.locator('button[type="submit"]').first();
    
    await expect(submitButton).toHaveScreenshot('primary-button.png', {
      maxDiffPixels: 20
    });
  });
});
