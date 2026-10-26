const { test, expect } = require('@playwright/test');

test('opens the blank page', async ({ page }) => {
  await page.goto('about:blank');
  await expect(page).toHaveURL('about:blank');
});
