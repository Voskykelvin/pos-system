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
  const clicked = await page.evaluate((label) => {
    const buttons = Array.from(document.querySelectorAll('.sidebar .navButton'));
    const target = buttons.find((button) => button.textContent.replace(/\s+/g, ' ').trim() === label);
    if (!target) return false;
    target.click();
    return true;
  }, name);

  if (!clicked) {
    throw new Error(`Primary nav button "${name}" was not found`);
  }
}

module.exports = {
  openMobileNav,
  clickPrimaryNav
};
