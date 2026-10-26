const { expect } = require('@playwright/test');

async function chooseCatalogRecord(page, field, record) {
  const select = page.locator(`select[name="${field}"]`);
  await select.locator('..').getByRole('combobox').click();
  await page.locator('.select2-container--open input.select2-search__field').fill(record.name);
  await page.getByRole('treeitem', { name: record.name, exact: true }).click();
  if (field !== 'option_groups') await expect(select).toHaveValue(record.id);
}

async function addProductOption(page, option) {
  await page.locator('[data-bs-target="#variants-block"]').click();
  await chooseCatalogRecord(page, 'option_groups', option);
  await expect(page.locator('input[name="prod_options[]"]')).toHaveValue(option.id);
}

async function saveCatalogForm(page) {
  // Editing keeps the same URL, so wait for the next main-frame navigation explicitly.
  await Promise.all([
    page.waitForEvent('framenavigated', frame => frame === page.mainFrame()),
    page.locator('#addProductfrm input[name="btn_submit"]').click(),
  ]);
  await page.waitForLoadState('domcontentloaded');
}

module.exports = { chooseCatalogRecord, addProductOption, saveCatalogForm };
