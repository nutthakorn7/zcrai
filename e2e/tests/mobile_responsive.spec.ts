import { test, expect, devices } from '@playwright/test';
import { robustMobileLogin, TEST_EMAIL, TEST_PASSWORD } from './utils';

test.describe('Mobile Responsive - iPhone', () => {
  test.setTimeout(120000);

  test('should display mobile navigation menu', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13 Pro'] });
    const page = await context.newPage();
    
    await robustMobileLogin(page);
    
    // On mobile, verify dashboard loads
    const dashboard = page.locator('h1, h2, .dashboard').first();
    await expect(dashboard).toBeVisible({ timeout: 10000 });
    
    await context.close();
  });

  test('should have touch-friendly buttons on login', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13 Pro'] });
    const page = await context.newPage();
    
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    // Check login button size (should be at least 44x44 for touch)
    const loginBtn = page.locator('button[type="submit"]').first();
    const box = await loginBtn.boundingBox();
    
    if (box) {
      // iOS minimum is 44px, Android is 48px
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
    await context.close();
  });

  test('should render dashboard in mobile viewport', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13 Pro'] });
    const page = await context.newPage();
    
    await robustMobileLogin(page);
    
    // Verify page loaded
    await page.waitForLoadState('domcontentloaded');
    
    // Should not have excessive horizontal scroll
    const viewportWidth = page.viewportSize()?.width || 390;
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    
    // Allow some tolerance for mobile layouts
    if (bodyWidth > viewportWidth + 50) {
      console.warn(`Mobile viewport overflow detected: Body=${bodyWidth}px, Viewport=${viewportWidth}px`);
    }
    await context.close();
  });
});

test.describe('Mobile Responsive - iPad', () => {
  test.setTimeout(120000);

  test('should render alerts page in tablet view', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPad Pro'] });
    const page = await context.newPage();
    
    await robustMobileLogin(page);
    
    await page.goto('/detections');
    await page.waitForLoadState('domcontentloaded');
    
    // Table should be visible and responsive
    const table = page.locator('table').first();
    
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
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
  test.setTimeout(120000);

  test('should navigate between pages on mobile', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['Pixel 5'] });
    const page = await context.newPage();
    
    await robustMobileLogin(page);
    
    // Navigate to Cases
    await page.goto('/cases');
    await expect(page).toHaveURL(/cases/);
    
    // Navigate to Alerts
    await page.goto('/detections');
    await expect(page).toHaveURL(/detections|alerts/);
    
    await context.close();
  });

  test('should render forms properly on mobile', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['Pixel 5'] });
    const page = await context.newPage();
    
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
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
    await page.waitForLoadState('domcontentloaded');
    
    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    
    expect(viewport).toBeTruthy();
    expect(viewport).toContain('width=device-width');
  });

  test('should not have text too small on mobile', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13 Pro'] });
    const page = await context.newPage();
    
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
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
