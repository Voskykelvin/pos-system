const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: path.join(__dirname, 'e2e'),
  testMatch: '**/*.spec.js',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chromium',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } }
  ],
  webServer: {
    command: 'node scripts/e2e-server.js',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      PORT: '4173',
      HOST: '127.0.0.1',
      ENABLE_ETIMS_SCHEDULER: 'false',
      AUTH_TOKEN_SECRET: 'playwright-local-test-secret'
    }
  }
});
