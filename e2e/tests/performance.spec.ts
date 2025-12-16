import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

test.describe('Performance - Page Load Times', () => {
  test('login page should load within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    console.log(`Login page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test('dashboard should load within 3 seconds after login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    const startTime = Date.now();
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    console.log(`Dashboard load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test('alerts page should load within 2 seconds', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    const startTime = Date.now();
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    console.log(`Alerts page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(2000);
  });
});

test.describe('Performance - Core Web Vitals', () => {
  test('should measure Core Web Vitals on dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    await page.waitForLoadState('networkidle');
    
    // Get Web Vitals using Performance API
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {};
        
        // LCP - Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        
        // FID - First Input Delay (approximated by checking if we can measure it)
        vitals.fid = 0; // FID requires user interaction, set to 0 for automated tests
        
        // CLS - Cumulative Layout Shift
        new PerformanceObserver((list) => {
          let cls = 0;
          for (const entry of list.getEntries() as any[]) {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value;
            }
          }
          vitals.cls = cls;
        }).observe({ type: 'layout-shift', buffered: true });
        
        // Wait a bit for metrics to be collected
        setTimeout(() => resolve(vitals), 2000);
      });
    });
    
    console.log('Core Web Vitals:', metrics);
    
    // LCP should be under 2.5s (good), we'll accept up to 4s
    if (metrics.lcp) {
      expect(metrics.lcp).toBeLessThan(4000);
    }
    
    // CLS should be under 0.1 (good), we'll accept up to 0.25
    if (metrics.cls !== undefined) {
      expect(metrics.cls).toBeLessThan(0.25);
    }
  });

  test('should have reasonable Time to Interactive', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Wait for page to be interactive (can click elements)
    await page.getByText(/security dashboard/i).first().waitFor({ state: 'visible' });
    
    const tti = Date.now() - startTime;
    console.log(`Time to Interactive: ${tti}ms`);
    
    // TTI should be under 5 seconds
    expect(tti).toBeLessThan(5000);
  });
});

test.describe('Performance - API Response Times', () => {
  test('API requests should respond within 1 second', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Track API response times using timestamps
    const apiTimes: { url: string; duration: number }[] = [];
    const requestTimes = new Map<string, number>();
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        requestTimes.set(request.url(), Date.now());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        const startTime = requestTimes.get(response.url());
        if (startTime) {
          const duration = Date.now() - startTime;
          apiTimes.push({
            url: response.url(),
            duration: duration
          });
        }
      }
    });
    
    // Navigate to a page that makes API calls
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for all API calls to complete
    await page.waitForTimeout(2000);
    
    console.log('API Response Times:', apiTimes);
    
    // Check that most API calls are under 1 second
    const slowCalls = apiTimes.filter(api => api.duration > 1000);
    console.log(`Slow API calls (>1s): ${slowCalls.length}/${apiTimes.length}`);
    
    // Should have some API calls
    expect(apiTimes.length).toBeGreaterThan(0);
    
    // Allow up to 30% of calls to be slow (relaxed for production)
    if (apiTimes.length > 0) {
      expect(slowCalls.length).toBeLessThan(Math.max(1, apiTimes.length * 0.3));
    }
  });
});

test.describe('Performance - Resource Loading', () => {
  test('should not load excessive resources', async ({ page }) => {
    let resourceCount = 0;
    let totalSize = 0;
    
    page.on('response', response => {
      resourceCount++;
      response.body().then(body => {
        totalSize += body.length;
      }).catch(() => {});
    });
    
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    await page.waitForLoadState('networkidle');
    
    console.log(`Resources loaded: ${resourceCount}`);
    console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Should load reasonable number of resources (under 100)
    expect(resourceCount).toBeLessThan(100);
    
    // Total size should be under 10MB
    expect(totalSize).toBeLessThan(10 * 1024 * 1024);
  });

  test('should cache static assets', async ({ page, context }) => {
    // First load
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const firstLoadResources = new Set<string>();
    page.on('response', response => {
      if (response.url().includes('.js') || response.url().includes('.css')) {
        firstLoadResources.add(response.url());
      }
    });
    
    // Second load (should use cache)
    const page2 = await context.newPage();
    let cachedCount = 0;
    let totalStaticResources = 0;
    
    page2.on('response', async (response) => {
      if (response.url().includes('.js') || response.url().includes('.css')) {
        totalStaticResources++;
        // Check cache headers
        const headers = response.headers();
        const cacheControl = headers['cache-control'] || '';
        const expires = headers['expires'];
        
        // Consider cached if it has cache headers or is from service worker/disk cache
        if (cacheControl.includes('max-age') || 
            cacheControl.includes('immutable') || 
            expires ||
            response.status() === 304) { // 304 Not Modified
          cachedCount++;
        }
      }
    });
    
    await page2.goto('/login');
    await page2.waitForLoadState('networkidle');
    
    console.log(`Static resources with cache headers: ${cachedCount}/${totalStaticResources}`);
    
    // At least 50% of static resources should have cache headers
    expect(totalStaticResources).toBeGreaterThan(0);
    expect(cachedCount).toBeGreaterThan(totalStaticResources * 0.5);
    
    await page2.close();
  });
});

test.describe('Performance - Memory Usage', () => {
  test('should not have significant memory leaks', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/);
    
    // Get initial memory
    const initialMemory = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Navigate through several pages
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Get final memory
    const finalMemory = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = finalMemory - initialMemory;
      const increasePercent = (memoryIncrease / initialMemory) * 100;
      
      console.log(`Memory usage: ${(initialMemory / 1024 / 1024).toFixed(2)}MB → ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Increase: ${increasePercent.toFixed(2)}%`);
      
      // Memory should not increase more than 50% after navigation
      expect(increasePercent).toBeLessThan(50);
    }
  });
});
