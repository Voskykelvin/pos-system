const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

async function expectNoSeriousViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const violations = results.violations
    .filter((violation) => ['serious', 'critical'].includes(violation.impact))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      targets: violation.nodes.flatMap((node) => node.target)
    }));
  if (violations.length > 0) {
    // eslint-disable-next-line no-console
    console.log('Accessibility violations found:', JSON.stringify(violations, null, 2));
  }
  expect(violations).toEqual([]);
}

test('marketing homepage has no serious automated accessibility violations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The public page audit runs once on desktop.');
  await page.goto('/home');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('phone login has no serious automated accessibility violations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'The phone login audit runs once.');
  await page.goto('/checkout');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expectNoSeriousViolations(page);
});
