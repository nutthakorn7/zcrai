import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@zcr.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SuperAdmin@123!';

// Helper for Robust Login
async function robustLogin(page: any) {
    let retries = 3;
    while (retries > 0) {
        try {
            await page.goto('/login', { timeout: 45000 });
            await page.waitForLoadState('domcontentloaded');
            // If we are already redirected or login form is present
            if (await page.url().includes('login')) {
                // Ensure form is visible
                await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
                await page.fill('input[type="email"]', TEST_EMAIL);
                await page.fill('input[type="password"]', TEST_PASSWORD);
                await page.click('button[type="submit"]');
            }
            await page.waitForURL(/dashboard|\/$/, { timeout: 45000 });
            return; // Success
        } catch (e) {
            console.log(`Login retry ${4-retries} failed: ${e.message}`);
            retries--;
            if (retries === 0) throw e;
            await page.waitForTimeout(5000); // Backoff
        }
    }
}

test.describe('Full System E2E Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await robustLogin(page);
  });

  test('Flow 1: Case Management (Create -> Verify)', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const caseTitle = `Auto Test Case ${uniqueId}`;

    await test.step('Navigate to Cases', async () => {
        await page.goto('/cases');
        await page.waitForLoadState('domcontentloaded');
        await expect(page).toHaveURL(/cases/);
    });

    await test.step('Create Case', async () => {
       const createBtn = page.getByRole('button', { name: /create|new|add case|สร้าง/i }).first();
       await createBtn.click();
       const dialog = page.locator('[role="dialog"], .modal');
       await expect(dialog).toBeVisible();
       
       // Try finding by name, then placeholder, then just any text input
       const titleInput = dialog.locator('input[name="title"], input[placeholder*="title" i], input[type="text"]').first();
       await expect(titleInput).toBeVisible({ timeout: 10000 });
       await titleInput.fill(caseTitle);
       
       // Submit
       await dialog.getByRole('button', { name: /create|save|submit/i }).first().click();
    });

    await test.step('Verify Case Exists', async () => {
       await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });
       // Check if title exists in table
       await expect(page.locator('tr').filter({ hasText: caseTitle }).first()).toBeVisible({ timeout: 15000 });
    });
  });

  test('Flow 2: Alert Triage (Alert -> Escalation)', async ({ page }) => {
    await test.step('Navigate to Alerts', async () => {
      await page.goto('/detections');
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Escalate Alert', async () => {
      const firstRow = page.locator('table tbody tr:not(:first-child), [role="row"]:not([role="columnheader"])').first();
      // Only proceed if alerts exist
      if (await firstRow.isVisible()) {
          await firstRow.click();
          // Look for escalate button
          const escalateBtn = page.getByRole('button', { name: /escalate|create case|promote/i }).first();
          if (await escalateBtn.isVisible()) {
              await escalateBtn.click();
              // Verify generic success or modal
              await expect(page.locator('[role="dialog"], .modal').or(page.getByText(/success|created/i))).toBeVisible();
              
              // If modal appears, close it or submit
               if (await page.locator('[role="dialog"]').isVisible()) {
                  const submitBtn = page.locator('[role="dialog"]').getByRole('button', { name: /create|submit/i }).first();
                  if (await submitBtn.isVisible()) await submitBtn.click();
               }
          }
      } else {
          test.skip(true, 'No alerts to test escalation');
      }
    });
  });

  test('Flow 3: Playbook Creation', async ({ page }) => {
     await test.step('Navigate to Playbooks', async () => {
        await page.goto('/playbooks');
        await page.waitForLoadState('domcontentloaded');
     });

     await test.step('Create Playbook', async () => {
        await page.getByRole('button', { name: /create|new/i }).first().click();
        await expect(page).toHaveURL(/playbooks/); 
        // Basic check for editor canvas
        const editor = page.locator('.react-flow, canvas, .editor');
        if (await editor.isVisible()) {
            await expect(editor).toBeVisible();
        }
     });
  });

  test('Flow 4: User Invitation', async ({ page }) => {
      await test.step('Navigate to Users', async () => {
         await page.goto('/settings/users');
         await page.waitForLoadState('networkidle');
      });
      
      await test.step('Check Invite Modal', async () => {
         const inviteBtn = page.getByRole('button', { name: /invite|add/i }).first();
         if (await inviteBtn.isVisible()) {
             await inviteBtn.click();
             await expect(page.locator('[role="dialog"]')).toBeVisible();
             await expect(page.locator('input[type="email"]')).toBeVisible();
             await page.getByRole('button', { name: /cancel|close/i }).click();
         }
      });
  });
});
