import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 4,
  reporter: [['html'], ['list']],
  
  // Increased timeout settings for production testing
  timeout: 120000, // 2 minutes per test
  globalTimeout: 1200000, // 20 minutes total
  expect: {
    timeout: 30000, // 30 seconds for assertions
  },
  
  use: {
    baseURL: process.env.BASE_URL || 'https://app.zcr.ai',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 30000,
    navigationTimeout: 60000,
    // Persist auth state
    storageState: 'playwright/.auth/user.json',
  },
  
  // Projects configuration
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        storageState: undefined, // Don't use storage state for setup
      },
    },
    // Main tests that depend on auth
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
