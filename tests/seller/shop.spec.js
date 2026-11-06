const { test, expect } = require('@playwright/test');
const { readData, saveSeller, attachRecords } = require('../../helpers/workflow-data');
const { createShippingProfile } = require('../../helpers/shipping-ui');

test('seller can save a shop and shipping profile', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const account = readData('seller-account');
  expect(account.origin).toBe(testInfo.project.use.baseURL);
  expect(account.accessVerified).toBe(true);
  try {
    await test.step('Save and reload shop details', async () => {
      await page.goto('/en/seller/shop', { waitUntil: 'domcontentloaded' });
      const form = page.locator('form[name="frmShop"]');
      account.shop = { name: account.business, identifier: `qa-shop-${account.suffix}`, slug: `qa-shop-${account.suffix}` };
      await form.locator('input[name="shop_identifier"]').fill(account.shop.identifier);
      await form.locator('input[name="shop_name"]').fill(account.shop.name);
      await form.locator('input[name="urlrewrite_custom"]').fill(account.shop.slug);
      await form.locator('input[name="shop_address_line_1"]').fill('123 QA Demo Road');
      await form.locator('select[name="shop_country_code"]').selectOption('US');
      await form.locator('select[name="shop_state"]').selectOption('NY');
      await form.locator('input[name="shop_city"]').fill('New York');
      await form.locator('input[name="shop_postalcode"]').fill('10001');
      await form.locator('input[name="shop_phone"]').fill(account.phone);
      await form.locator('select[name="shop_partial_payment_type"]').selectOption('0');
      await form.locator('select[name="shop_scan_code_type"]').selectOption('C128');
      await form.locator('select[name="shop_fulfillment_type"]').selectOption('2');
      await form.locator('input[name="shop_supplier_display_status"]').check();
      await form.locator('input[name="btn_submit"]').click();
      await expect(form.locator('input[name="shop_id"]')).toHaveValue(/^[1-9]\d*$/);
      account.shop.id = await form.locator('input[name="shop_id"]').inputValue();
      saveSeller(account);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(form.locator('input[name="shop_name"]')).toHaveValue(account.shop.name);
      await expect(form.locator('input[name="shop_identifier"]')).toHaveValue(account.shop.identifier);
      await expect(form.locator('input[name="shop_address_line_1"]')).toHaveValue('123 QA Demo Road');
      await expect(form.locator('select[name="shop_country_code"]')).toHaveValue('US');
      await expect(form.locator('select[name="shop_state"]')).toHaveValue('NY');
      await expect(form.locator('input[name="shop_city"]')).toHaveValue('New York');
      await expect(form.locator('input[name="shop_postalcode"]')).toHaveValue('10001');
      await expect(form.locator('select[name="shop_scan_code_type"]')).toHaveValue('C128');
      await expect(form.locator('select[name="shop_fulfillment_type"]')).toHaveValue('2');
      await expect(form.locator('input[name="shop_supplier_display_status"]')).toBeChecked();
    });
    await test.step('Save and verify a seller-owned shipping profile', async () => {
      account.shipping = {
        admin: false, name: `QA Seller Ship ${account.suffix}`, rateName: `QA Seller Rate ${account.suffix}`,
        cost: '9.50', days: '2',
      };
      await createShippingProfile(page, account.shipping);
      if (account.id) await expect(page.locator('input[name="shipprofile_user_id"]')).toHaveValue(account.id);
    });
  } finally {
    saveSeller(account);
    await attachRecords(testInfo, { seller: { name: account.name, id: account.id }, shop: account.shop, shipping: account.shipping });
  }
});
