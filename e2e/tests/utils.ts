import { Page, expect } from '@playwright/test';

export const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
export const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

/**
 * Robust login function with retries and better error handling
 */
export async function robustLogin(page: Page) {
    let retries = 3;
    while (retries > 0) {
        try {
            // Check if already logged in
            const currentUrl = page.url();
            if (currentUrl.includes('dashboard') || (!currentUrl.includes('login') && !currentUrl.includes('register'))) {
                return; // Already logged in
            }

            await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
            
            // If redirected away from login (already authenticated), return
            if (!page.url().includes('login')) {
                return;
            }

            // Wait for and fill email input
            const emailInput = page.locator('input[type="email"], input[name="email"]').first();
            await emailInput.waitFor({ state: 'visible', timeout: 30000 });
            await emailInput.fill(TEST_EMAIL);
            
            // Fill password
            const passwordInput = page.locator('input[type="password"]').first();
            await passwordInput.fill(TEST_PASSWORD);
            
            // Submit form
            await page.locator('button[type="submit"]').click();
            
            // Wait for navigation to complete
            await page.waitForURL(/dashboard|\//, { timeout: 60000, waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
            
            return; // Success
        } catch (e: unknown) {
            const error = e as Error;
            console.log(`Login retry ${4-retries} failed: ${error.message}`);
            retries--;
            if (retries === 0) throw e;
            await page.waitForTimeout(3000); // Backoff
        }
    }
}

/**
 * Robust login for mobile/context tests where a new BrowserContext is created
 */
export async function robustMobileLogin(page: Page) {
    return robustLogin(page); // Use same logic
}

/**
 * Helper to check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
    const url = page.url();
    return !url.includes('login') && !url.includes('register');
}

/**
 * Navigate to a page with authentication check
 */
export async function navigateAuthenticated(page: Page, path: string) {
    await robustLogin(page);
    await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
}
