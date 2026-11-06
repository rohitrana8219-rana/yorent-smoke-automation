const { expect } = require('@playwright/test');
const { randomInt } = require('crypto');
const { fillLocalizedName } = require('./localized-name');
const { expectEnglishURL } = require('./public-routes');

async function searchInventory(page, route, title) {
  await page.goto(`/en${route}`, { waitUntil: 'domcontentloaded' });
  const form = page.locator('form[name="frmSearch"]');
  await form.locator('input[name="keyword"]').fill(title);
  const result = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.replace(/^\/en(?=\/)/, '').startsWith('/seller-inventories/seller-products'));
  await form.locator('input[name="btn_submit"]').click();
  await (await result).finished();
  await expect(page.locator('body')).toContainText(new RegExp(`${title}|No Records Found`));
  return page.locator('tr').filter({ has: page.getByText(title, { exact: true }) });
}

async function selectToday(page, field) {
  await field.click();
  await page.locator('#ui-datepicker-div .ui-datepicker-today a').click();
  await expect(field).not.toHaveValue('');
  return field.inputValue();
}

async function openScanCodes(page, rental) {
  // Bootstrap ignores dismiss actions while its opening transition is running.
  // Register before clicking, including when the modal is inserted by AJAX.
  await page.evaluate(() => {
    window.__qaScanCodesShown = new Promise(resolve => {
      const shown = event => {
        if (!event.target.querySelector('#savecode')) return;
        document.removeEventListener('shown.bs.modal', shown);
        resolve();
      };
      document.addEventListener('shown.bs.modal', shown);
    });
  });
  await rental.getByTitle('Add Barcode And Sku', { exact: true }).click();
  await page.evaluate(() => window.__qaScanCodesShown);
  await page.evaluate(() => { delete window.__qaScanCodesShown; });
}

async function verifyRental(page, record, catalog, shipping) {
  const rental = page.locator('form[name="frmSellerProduct"]');
  await expect(rental).toBeVisible();
  await expect(rental.locator('input[name="selprod_product_id"]')).toHaveValue(catalog.id);
  await expect(rental.locator('input[name="selprod_title1"]')).toHaveValue(record.title);
  await expect(rental.locator('select[name="sprodata_rental_active"]')).toHaveValue('1');
  await expect(rental.locator('select[name="sprodata_rental_condition"]')).toHaveValue('1');
  await expect(rental.locator('select[name="sprodata_min_duration_type"]')).toHaveValue('2');
  await expect(rental.locator('input[name="sprodata_minimum_rental_duration"]')).toHaveValue('1');
  await expect(rental.locator('input[name="sprodata_minimum_rental_quantity"]')).toHaveValue('1');
  await expect(rental.locator('select[name="sprodata_fullfillment_type"]')).toHaveValue('2');
  await expect(rental.locator('select[name="shipping_profile"]')).toHaveValue(shipping.id);
  await expect(rental.locator('input[name="sprodata_rental_available_from"]')).toHaveValue(record.availableFrom);
  expect(Number(await rental.locator('input[name="selprod_cost"]').inputValue())).toBe(200);
  expect(Number(await rental.locator('input[name="sprodata_rental_security"]').inputValue())).toBe(25);
  expect(Number(await rental.locator('input[name="sprodata_rental_buffer_days"]').inputValue())).toBe(1);
  expect(Number(await rental.getByPlaceholder('Hourly Rental Price', { exact: true }).inputValue())).toBe(5);
  expect(Number(await rental.getByPlaceholder('Daily Rental Price', { exact: true }).inputValue())).toBe(15);
  expect(Number(await rental.getByPlaceholder('Monthly Rental Price', { exact: true }).inputValue())).toBe(200);
  expect(Number(await rental.getByPlaceholder('Rental Stock', { exact: true }).inputValue())).toBe(3);
  await openScanCodes(page, rental);
  for (let i = 0; i < record.scanCodes.length; i++) {
    await expect(page.locator(`input[name="barcode_${i}"]`)).toHaveValue(record.scanCodes[i]);
  }
  await page.locator('#savecode').click();
  await expect(page.locator('#savecode')).toBeHidden();
}

async function retainInventory(page, { account, catalog, option, source, previous, update }) {
  const record = previous || {
    title: `QA ${source === 'admin' ? 'Admin' : 'Seller'} Stock ${account.suffix}`,
    productId: catalog.id,
    saleSku: String(randomInt(100000000, 999999999)),
    phase: 'started',
  };
  update(record);
  // A rerun resumes its own retained inventory instead of replacing existing scan codes.
  let row = await searchInventory(page, '/seller-inventories/products', record.title);
  if (await row.count()) {
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(catalog.name);
    const href = await row.getByTitle('Edit', { exact: true }).getAttribute('href');
    const match = href.match(/\/seller-product-form\/([1-9]\d*)\/([1-9]\d*)\/0$/);
    expect(match).not.toBeNull();
    expect(match[1]).toBe(catalog.id);
    record.id = match[2];
    await row.getByTitle('Edit', { exact: true }).click();
    await verifyRental(page, record, catalog, account.shipping);
    await page.locator('a.tabs_003').click();
  } else {
    await page.goto(source === 'admin' ? '/en/seller/catalog/0' : '/en/seller/catalog', { waitUntil: 'domcontentloaded' });
    const search = page.locator('#frmSearchCatalogProduct');
    await search.locator('input[name="keyword"]').fill(catalog.identifier);
    await search.locator('input[name="btn_submit"]').click();
    const catalogRow = page.locator('tr').filter({ has: page.getByText(catalog.name, { exact: true }) });
    await expect(catalogRow).toHaveCount(1);
    await expect(catalogRow).toContainText('Approved');
    await catalogRow.getByTitle('Add Inventory', { exact: true }).click();
    const rental = page.locator('form[name="frmSellerProduct"]');
    await fillLocalizedName(rental, 'selprod_title', record.title, 'Inventory Data For English');
    await rental.locator('input[name="selprod_url_keyword"]').fill(`qa-${source}-${account.suffix}`);
    await rental.locator('select[name="sprodata_rental_active"]').selectOption('1');
    record.availableFrom = await selectToday(page, rental.locator('input[name="sprodata_rental_available_from"]'));
    await rental.locator('select[name="sprodata_rental_condition"]').selectOption('1');
    await rental.locator('input[name="sprodata_minimum_rental_duration"]').fill('1');
    await rental.locator('select[name="sprodata_min_duration_type"]').selectOption('2');
    await rental.locator('select[name="sprodata_fullfillment_type"]').selectOption('2');
    await rental.locator('select[name="shipping_profile"]').selectOption(account.shipping.id);
    await rental.locator('input[name="sprodata_minimum_rental_quantity"]').fill('1');
    await rental.locator('input[name="selprod_cost"]').fill('200');
    await rental.locator('input[name="sprodata_rental_security"]').fill('25');
    await rental.locator('input[name="sprodata_rental_buffer_days"]').fill('1');
    await rental.locator('select[name="varient_id"]').selectOption({ label: option.value });
    // Choosing an option changes input names; these are the UI's stable placeholders.
    await rental.getByPlaceholder('Hourly Rental Price', { exact: true }).fill('5');
    await rental.getByPlaceholder('Daily Rental Price', { exact: true }).fill('15');
    await rental.getByPlaceholder('Monthly Rental Price', { exact: true }).fill('200');
    await rental.getByPlaceholder('Rental Stock', { exact: true }).fill('3');
    await openScanCodes(page, rental);
    record.scanCodes = Array.from({ length: 3 }, (_, i) => `Q${account.suffix}${source === 'admin' ? 'A' : 'S'}${i + 1}`);
    update(record);
    for (let i = 0; i < record.scanCodes.length; i++) {
      await page.locator(`input[name="barcode_${i}"]`).fill(record.scanCodes[i]);
    }
    // The visible Continue button has aria-label="Close" in this application.
    await page.locator('#savecode').click();
    await expect(page.locator('#savecode')).toBeHidden();
    await rental.locator('input[name="btn_submit"]').click();
  }

  const sale = page.locator('form[name="frmProductRentalDetails"]');
  await expect(sale).toBeVisible();
  record.id = await sale.locator('input[name^="selprod_id["]').inputValue();
  expect(record.id).toMatch(/^[1-9]\d*$/);
  if (!['sale-saved', 'complete'].includes(record.phase)) record.phase = 'rental-saved';
  update(record);
  // A new sale form can display Publish=Yes before anything has been saved.
  if (!['sale-saved', 'complete'].includes(record.phase)) {
    await sale.locator('input[name="selprod_subtract_stock"]').check();
    await sale.locator('input[name="selprod_track_inventory"]').check();
    await sale.locator('input[name="selprod_threshold_stock_level"]').fill('1');
    await sale.locator('input[name="selprod_min_order_qty"]').fill('1');
    await sale.locator('select[name="selprod_active"]').selectOption('1');
    record.saleAvailableFrom = await selectToday(page, sale.locator('input[name="selprod_available_from"]'));
    await sale.locator('select[name="selprod_condition"]').selectOption('1');
    await sale.locator('select[name="use_shop_policy"]').selectOption('1');
    const saleFulfillment = sale.locator('select[name="fulfillment_method"]');
    if (await saleFulfillment.count()) await saleFulfillment.selectOption('2');
    await sale.locator('input[name^="selprod_price["]').fill('199.99');
    await sale.locator('input[name^="selprod_stock["]').fill('3');
    // Unlike the rental scan code, the sale SKU field requires an integer.
    await sale.locator('input[name^="selprod_sku["]').fill(record.saleSku);
    const saved = page.waitForResponse(r => new URL(r.url()).pathname.replace(/^\/en(?=\/)/, '') === '/seller-inventories/setup-prod-sale-details' && r.request().method() === 'POST');
    await sale.locator('input[name="btn_submit"]').click();
    await (await saved).finished();
    await expectEnglishURL(page, '/seller-inventories/products');
    record.phase = 'sale-saved';
    update(record);
  }

  row = await searchInventory(page, '/seller-inventories/products', record.title);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(catalog.name);
  await expect(row).toContainText(option.value);
  await expect(row).toContainText('$5.00/Hour');
  await row.getByTitle('Edit', { exact: true }).click();
  await verifyRental(page, record, catalog, account.shipping);
  await page.locator('a.tabs_003').click();
  await expect(sale).toBeVisible();
  await expect(sale.locator('select[name="selprod_active"]')).toHaveValue('1');
  await expect(sale.locator('select[name="selprod_condition"]')).toHaveValue('1');
  await expect(sale.locator('input[name="selprod_min_order_qty"]')).toHaveValue('1');
  await expect(sale.locator('input[name="selprod_available_from"]')).toHaveValue(record.saleAvailableFrom);
  const savedFulfillment = sale.locator('select[name="fulfillment_method"]');
  if (await savedFulfillment.count()) await expect(savedFulfillment).toHaveValue('2');
  expect(Number(await sale.locator('input[name^="selprod_price["]').inputValue())).toBe(199.99);
  expect(Number(await sale.locator('input[name^="selprod_stock["]').inputValue())).toBe(3);
  await expect(sale.locator('input[name^="selprod_sku["]')).toHaveValue(record.saleSku);
  row = await searchInventory(page, '/seller-inventories/sales', record.title);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(catalog.name);
  await expect(row).toContainText('$199.99');
  record.phase = 'complete';
  record.quantity = 3;
  record.hourlyPrice = '5.00';
  record.dailyPrice = '15.00';
  record.monthlyPrice = '200.00';
  record.salePrice = '199.99';
  update(record);
  return record;
}

module.exports = { retainInventory };
