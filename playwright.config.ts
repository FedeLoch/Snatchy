import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // The specs assert English copy, and the app otherwise follows the system
    // locale, so the runner has to be pinned rather than inherited from CI.
    locale: 'en-US',
    // The quick-start guide opens on a first visit; other specs start past
    // it. tests/e2e/onboarding.spec.ts clears this to test the guide itself.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://127.0.0.1:4173',
          localStorage: [{ name: 'snatchy-onboarding-v1', value: 'done' }],
        },
      ],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
