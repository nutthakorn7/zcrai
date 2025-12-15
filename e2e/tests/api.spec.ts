import { test, expect } from '@playwright/test';

test.describe('API Health Checks', () => {
  test('should return healthy API status', async ({ request }) => {
    const response = await request.get('https://app.zcr.ai/api/health');
    
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('should return 401 for unauthenticated API calls', async ({ request }) => {
    const response = await request.get('https://app.zcr.ai/api/dashboard/summary');
    
    // Should be unauthorized
    expect(response.status()).toBe(401);
  });

  test('should serve static assets', async ({ request }) => {
    const response = await request.get('https://app.zcr.ai/');
    
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('root');
  });
});

test.describe('Performance', () => {
  test('login page should load within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/login');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/login');
    
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });
});
