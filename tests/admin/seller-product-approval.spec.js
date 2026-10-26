const { test, expect } = require('@playwright/test');
const { readData, saveSeller, attachRecords } = require('../../helpers/workflow-data');
const { saveCatalogForm } = require('../../helpers/catalog-ui');

test('admin verifies ownership and approves the new seller product', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const account = readData('seller-account');
  expect(account.origin).toBe(testInfo.project.use.baseURL);
  expect(account.product.id).toMatch(/^[1-9]\d*$/);
  await page.goto('/admin/products', { waitUntil: 'domcontentloaded' });
  await page.locator('#frmSearch input[name="keyword"]').fill(account.product.identifier);
  await page.locator('#frmSearch input[name="btn_submit"]').click();
  const row = page.locator('#frmProdListing tbody tr').filter({ has: page.locator(`img[alt="${account.product.name}"]`) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(account.name);
  await expect(row.locator('a[title="Edit"]')).toHaveAttribute('href', `/admin/products/single-form/${account.product.id}`);
  await row.locator('a[title="Edit"]').click();
  const form = page.locator('#addProductfrm');
  await expect(form.locator('input[name="product_identifier"]')).toHaveValue(account.product.identifier);
  // The seller form does not expose this required admin field for a new catalog product.
  await form.locator('select[name="product_fulfillment_type"]').selectOption('2');
  await form.locator('input[name="product_approved"]').check();
  await saveCatalogForm(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(form.locator('input[name="product_approved"]')).toBeChecked();
  await expect(form.locator('select[name="product_fulfillment_type"]')).toHaveValue('2');
  account.product.approvalStatus = 'Approved';
  saveSeller(account);
  await attachRecords(testInfo, { seller: { name: account.name, id: account.id }, product: account.product });
});
