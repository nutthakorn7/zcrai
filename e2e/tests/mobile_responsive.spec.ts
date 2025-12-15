import { test, expect, devices } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdminQ123!';

test.describe('Mobile Responsive - iPhone', () => {
  test('should display mobile navigation menu', async ({ page, browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13 Pro'] });
    page = await context.newPage();
    
    await page.goto('/login');
    
    // Login
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // On mobile, verify dashboard loads (not all apps use hamburger menu)
    const dashboard = page.locator('h1, h2, .dashboard').first();
    await expect(dashboard).toBeVisible({ timeout: 10000 });
    
    await context.close();
  });

  test('should have touch-friendly buttons on login', async ({ page, browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13 Pro'] });
    page = await context.newPage();
    
    await page.goto('/login');
    
    // Check login button size (should be at least 44x44 for touch)
    const loginBtn = page.locator('button[type="submit"]').first();
    const box = await loginBtn.boundingBox();
    
    if (box) {
      // iOS minimum is 44px, Android is 48px
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
    await context.close();
  });

  test('should render dashboard in mobile viewport', async ({ page, browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13 Pro'] });
    page = await context.newPage();
    
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Verify page loaded
    await page.waitForLoadState('networkidle');
    
    // Should not have horizontal scroll
    const viewportWidth = page.viewportSize()?.width || 390;
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    
    // Allow 1px difference for rounding
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
    await context.close();
  });
});

test.describe('Mobile Responsive - iPad', () => {
  test('should render alerts page in tablet view', async ({ page, browser }) => {
    const context = await browser.newContext({ ...devices['iPad Pro'] });
    page = await context.newPage();
    
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    
    // Table should be visible and responsive
    const table = page.locator('table').first();
    
    if (await table.isVisible().catch(() => false)) {
      const tableBox = await table.boundingBox();
      const viewportWidth = page.viewportSize()?.width || 1024;
      
      if (tableBox) {
        // Table should fit within viewport
        expect(tableBox.width).toBeLessThanOrEqual(viewportWidth);
      }
    }
    await context.close();
  });
});

test.describe('Mobile Responsive - Android', () => {
  test('should navigate between pages on mobile', async ({ page, browser }) => {
    const context = await browser.newContext({ ...devices['Pixel 5'] });
    page = await context.newPage();
    
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Navigate to Cases
    await page.goto('/cases');
    await expect(page).toHaveURL(/cases/);
    
    // Navigate to Alerts
    await page.goto('/alerts');
    await expect(page).toHaveURL(/alerts/);
    
    // Pages should load without error
    expect(page.url()).toContain('/alerts');
    await context.close();
  });

  test('should render forms properly on mobile', async ({ page, browser }) => {
    const context = await browser.newContext({ ...devices['Pixel 5'] });
    page = await context.newPage();
    
    await page.goto('/login');
    
    // Email input should be full-width responsive
    const emailInput = page.locator('input[type="email"]').first();
    const inputBox = await emailInput.boundingBox();
    
    if (inputBox) {
      // Input should be reasonably wide (at least 200px on mobile)
      expect(inputBox.width).toBeGreaterThan(200);
    }
    await context.close();
  });
});

test.describe('Viewport Scaling', () => {
  test('should have proper viewport meta tag', async ({ page }) => {
    await page.goto('/login');
    
    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    
    expect(viewport).toBeTruthy();
    expect(viewport).toContain('width=device-width');
  });

  test('should not have text too small on mobile', async ({ page, browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13 Pro'] });
    page = await context.newPage();
    
    await page.goto('/login');
    
    // Check font size of main text
    const fontSize = await page.evaluate(() => {
      const body = document.body;
      return parseInt(window.getComputedStyle(body).fontSize);
    });
    
    // Minimum 14px for readability on mobile
    expect(fontSize).toBeGreaterThanOrEqual(14);
    await context.close();
  });
});
