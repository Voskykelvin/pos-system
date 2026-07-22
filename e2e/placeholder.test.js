import { test, expect } from '@playwright/test';

test('placeholder passes', async ({ page }) => {
  await page.goto('about:blank');
  expect(true).toBeTruthy();
});
