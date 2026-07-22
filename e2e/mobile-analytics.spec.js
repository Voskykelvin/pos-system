const { test, expect } = require('@playwright/test');

test('phone admin can review responsive live analytics without page overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'This journey verifies the phone analytics layout.');
  await page.goto('/analytics');
  await page.getByLabel('Email or phone').fill('admin@example.local');
  await page.getByLabel('Password').fill('admin12345');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Analytics' }).click();

  await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();
  await expect(page.getByText('Gross sales')).toBeInViewport();
  await expect(page.getByRole('img', { name: 'Sales and gross profit trend chart' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
