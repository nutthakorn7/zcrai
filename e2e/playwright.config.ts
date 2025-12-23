import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  // Timeout settings
  timeout: 60000,
  globalTimeout: 600000,
  expect: {
    timeout: 10000,
  },
  
  use: {
    baseURL: process.env.BASE_URL || 'https://app.zcr.ai',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 45000,
  },
});
