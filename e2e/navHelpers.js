async function openMobileNav(page) {
  const menuBtn = page.getByRole('button', { name: 'Open menu' });
  if (!(await menuBtn.isVisible().catch(() => false))) return;

  await menuBtn.click();
  await page.waitForFunction(() => {
    const sidebar = document.querySelector('.sidebar.sidebarOpen');
    if (!sidebar) return false;
    return sidebar.getBoundingClientRect().left >= -2;
  });
}

async function clickPrimaryNav(page, name) {
  await openMobileNav(page);
  const target = page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('button', { name, exact: true });
  if ((await target.count()) < 1) throw new Error(`Primary nav button "${name}" was not found`);

  // Use Playwright's interaction rather than dispatching a DOM click inside
  // page.evaluate. The latter can race the mobile sidebar transition and skip
  // React's navigation handler in Chromium emulation.
  await target.first().click();
}

module.exports = {
  openMobileNav,
  clickPrimaryNav
};
