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

test('session reload uses the secure refresh cookie without persisting the bearer token', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The secure session persistence check runs once on desktop.');
  await loginAsCashier(page);

  await expect.poll(() => page.evaluate(() => localStorage.getItem('pos_auth_token'))).toBeNull();
  await page.reload();

  await expect(page.getByPlaceholder('Scan barcode or search a product...')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pos_auth_token'))).toBeNull();
});

test('cashier queues a cash sale while offline and sees reconciliation status', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The offline checkout journey runs once on desktop.');
  await loginAsCashier(page);
  await page.getByLabel('Auto-print Receipts').uncheck();
  await page.waitForTimeout(500);
  await context.setOffline(true);

  await page.getByPlaceholder('Scan barcode or search a product...').fill('Fresh Milk');
  await page.getByRole('button', { name: /Fresh Milk 500ml/ }).click();
  await page.getByLabel('Cash received').fill('100');
  await page.getByLabel('Cash received').blur();
  await page.getByRole('button', { name: /Confirm sale - KES 65.00/ }).click();

  await expect(page.getByText('Offline reconciliation')).toBeVisible();
  await expect(page.getByText(/1 waiting/)).toBeVisible();
  await expect(page.getByText(/OFFLINE-1/)).toBeVisible();
});

test('phone cashier switches from products to cart and completes a cash sale', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'This journey verifies the phone checkout controls.');
  await loginAsCashier(page);
  await page.getByLabel('Auto-print Receipts').uncheck();

  await page.getByPlaceholder('Scan barcode or search a product...').fill('White Bread');
  await page.getByRole('button', { name: /White Bread 400g/ }).click();
  await expect(page.getByText('KES 70.00').last()).toBeVisible();
  await page.getByRole('button', { name: 'Cart (1)' }).click();

  await expect(page.getByRole('heading', { name: 'Current sale' })).toBeVisible();
  await page.getByLabel('Cash received').fill('100');
  await page.getByLabel('Cash received').blur();
  await expect(page.getByText('KES 30.00')).toBeVisible();
  await page.getByRole('button', { name: /Confirm sale - KES 70.00/ }).click();

  await expect(page.getByText('Sale completed successfully.').first()).toBeVisible();
  await expect(page.getByText('Receipt', { exact: true })).toBeVisible();
});
