const { test, expect } = require('@playwright/test');

async function loginAsCashier(page) {
  await page.goto('/checkout');
  await page.getByLabel('Email or phone').fill('cashier@example.local');
  await page.getByLabel('Password').fill('cashier12345');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByPlaceholder('Scan barcode or search a product...')).toBeVisible();
}

test('cashier completes a cash sale and receives a receipt', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The complete checkout journey runs once on desktop.');
  await loginAsCashier(page);

  await page.getByLabel('Auto-print Receipts').uncheck();
  await page.getByPlaceholder('Scan barcode or search a product...').fill('Fresh Milk');
  await page.getByRole('button', { name: /Fresh Milk 500ml/ }).click();

  await expect(page.getByText('Current sale')).toBeVisible();
  await expect(page.getByText('KES 65.00').first()).toBeVisible();
  await page.getByLabel('Cash received').fill('100');
  await page.getByLabel('Cash received').blur();
  await expect(page.getByText('KES 35.00')).toBeVisible();
  await page.getByRole('button', { name: /Confirm sale - KES 65.00/ }).click();

  await expect(page.getByText('Sale completed successfully.').first()).toBeVisible();
  await expect(page.getByText('Receipt', { exact: true })).toBeVisible();
  await expect(page.getByText('KES 35.00')).toBeVisible();
});

test('phone layout keeps sign out and checkout navigation accessible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'This assertion targets the phone navigation layout.');
  await loginAsCashier(page);

  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByPlaceholder('Scan barcode or search a product...')).toBeInViewport();
});
