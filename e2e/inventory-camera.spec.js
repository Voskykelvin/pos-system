const { test, expect } = require('@playwright/test');

async function loginAsAdmin(page) {
  await page.goto('/inventory');
  await page.getByLabel('Email or phone').fill('admin@example.local');
  await page.getByLabel('Password').fill('admin12345');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const menuBtn = page.getByRole('button', { name: 'Open menu' });
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await page.getByRole('button', { name: 'Inventory' }).waitFor({ state: 'visible' });
  }
  await page.getByRole('button', { name: 'Inventory' }).click();
  await expect(page.getByPlaceholder('Scan barcode here')).toBeVisible();
}

test('phone inventory opens and safely closes the camera barcode scanner', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'This journey verifies the phone camera scanner UI.');
  await context.grantPermissions(['camera'], { origin: 'http://127.0.0.1:4173' });
  await loginAsAdmin(page);

  await page.getByRole('button', { name: 'Use camera' }).click();

  const scanner = page.getByRole('dialog', { name: 'Scan product barcode' });
  await expect(scanner).toBeVisible();
  await expect(scanner.getByText('Hold the rear camera steady over the full barcode.')).toBeVisible();
  await expect(scanner.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(scanner).toBeHidden();
  await expect(page.getByPlaceholder('Scan barcode here')).toBeInViewport();
});
