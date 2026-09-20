const { test, expect } = require('@playwright/test');

async function loginAsCashier(page) {
  await page.goto('/checkout');
  await page.getByLabel('Email or phone').fill('cashier@example.local');
  await page.getByLabel('Password').fill('cashier12345');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

test('cashier can open checkout and operations without an error boundary', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The route regression runs once on desktop.');
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await loginAsCashier(page);
  await expect(page.getByPlaceholder('Scan barcode or search a product...')).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);

  await page.getByRole('button', { name: 'Operations' }).click();
  await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});
