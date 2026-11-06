const { expect } = require('@playwright/test');

async function openModal(page, opener, selector = '.modal.show') {
  // Register before the UI action: Bootstrap ignores dismiss while opening.
  await page.evaluate(selector => {
    window.__qaModalShown = new Promise(resolve => {
      const shown = event => {
        if (!event.target.matches(selector)) return;
        document.removeEventListener('shown.bs.modal', shown);
        resolve();
      };
      document.addEventListener('shown.bs.modal', shown);
    });
  }, selector);
  await opener.click();
  await page.evaluate(() => window.__qaModalShown);
  await page.evaluate(() => { delete window.__qaModalShown; });
  const modal = page.locator(selector);
  await expect(modal).toHaveCount(1);
  await expect(modal).toBeVisible();
  return modal;
}
module.exports = { openModal };
