import { Page, expect, BrowserContext } from '@playwright/test';

export const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
export const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

export async function robustLogin(page: Page) {
    let retries = 3;
    while (retries > 0) {
        try {
            await page.goto('/login', { timeout: 45000 });
            await page.waitForLoadState('domcontentloaded');
            
            // If we are already redirected to dashboard, return
            if (!page.url().includes('login')) {
                 await page.waitForURL(/dashboard|\/$/, { timeout: 45000 });
                 return;
            }

            // Ensure form is visible
            const emailInput = page.locator('input[type="email"], input[name="email"]');
            if (await emailInput.isVisible({ timeout: 5000 })) {
                await emailInput.fill(TEST_EMAIL);
                await page.fill('input[type="password"]', TEST_PASSWORD);
                await page.click('button[type="submit"]');
            }
            
            await page.waitForURL(/dashboard|\/$/, { timeout: 45000 });
            return; // Success
        } catch (e: unknown) {
            const error = e as Error;
            console.log(`Login retry ${4-retries} failed: ${error.message}`);
            retries--;
            if (retries === 0) throw e;
            await page.waitForTimeout(5000); // Backoff
        }
    }
}

/**
 * Robust login for mobile/context tests where a new BrowserContext is created
 */
export async function robustMobileLogin(page: Page) {
    let retries = 3;
    while (retries > 0) {
        try {
            await page.goto('/login', { timeout: 45000 });
            await page.waitForLoadState('domcontentloaded');
            
            if (!page.url().includes('login')) {
                await page.waitForURL(/dashboard|\/$/, { timeout: 45000 });
                return;
            }

            const emailInput = page.locator('input[type="email"]');
            if (await emailInput.isVisible({ timeout: 5000 })) {
                await emailInput.fill(TEST_EMAIL);
                await page.fill('input[type="password"]', TEST_PASSWORD);
                await page.click('button[type="submit"]');
            }
            
            await page.waitForURL(/dashboard|\/$/, { timeout: 45000 });
            return;
        } catch (e: unknown) {
            const error = e as Error;
            console.log(`Mobile login retry ${4-retries} failed: ${error.message}`);
            retries--;
            if (retries === 0) throw e;
            await page.waitForTimeout(3000);
        }
    }
}

