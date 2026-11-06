const { expect } = require('@playwright/test');
const { read, save, snapshotSources, intent, clearIntent, noPending, dismissCookies } = require('./rental-data');
const { openModal } = require('./modal-ui');
const { expectEnglishURL, publicLink } = require('./public-routes');

function money(text) {
  const match = text.replace(/,/g, '').match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) throw new Error('Expected a displayed USD amount. Inspect currency/settings without changing them.');
  return Math.round(Number(match[1]) * 100);
}
async function amount(page, label, expected) {
  const row = page.locator('li').filter({ has: page.getByText(label, { exact: true }) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(`$${expected}`);
  expect(money(await row.locator('.value').innerText())).toBe(Math.round(Number(expected) * 100));
}
function futureDates() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  const add = days => { const value = new Date(date); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
  return { start: add(7), end: add(9) };
}
async function calendarDate(page, input, value) {
  await input.click();
  const calendar = page.locator('.xdsoft_datetimepicker:visible');
  await expect(calendar).toHaveCount(1);
  const [year, month, day] = value.split('-').map(Number);
  const cell = calendar.locator(`td[data-year="${year}"][data-month="${month - 1}"][data-date="${day}"]`);
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  const monthCaption = calendar.locator('.xdsoft_month > span');
  const yearCaption = calendar.locator('.xdsoft_year > span');
  // Wait for each actual month redraw before evaluating the next action.
  // Dates are at most nine days ahead, so two bounded next-month actions suffice.
  for (let next = 0; next < 2 && (await monthCaption.innerText()) !== monthName; next++) {
    const previous = await monthCaption.innerText();
    await calendar.locator('button.xdsoft_next:visible').click();
    await expect(monthCaption).not.toHaveText(previous);
  }
  await expect(monthCaption).toHaveText(monthName);
  await expect(yearCaption).toHaveText(String(year));
  await expect(cell).toHaveCount(1);
  await expect(cell).not.toHaveClass(/xdsoft_disabled/);
  await cell.click();
  await expect(input).toHaveValue(value);
}
async function verifyOrder(page, data, verifyPaymentBalance = false) {
  const buyer = read('buyer-account');
  await page.goto(`/en/buyer/view-order/${data.order.id}`);
  await expect(page.getByText(data.order.id, { exact: true })).toBeVisible();
  await expect(page.getByText('Order Payment Status Paid', { exact: true })).toBeVisible();
  await expect(page.getByText(buyer.name, { exact: true }).and(page.locator(':visible'))).toBeVisible();
  const displayDate = iso => new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
  for (const source of ['admin', 'seller']) {
    const row = page.locator('tr').filter({ has: page.getByRole('link', { name: data.inventory[source].title, exact: true }) });
    await expect(row).toHaveCount(1);
    // Order details render Seller identity as text, unlike the product's link.
    await expect(row).toContainText(`Sold By: ${data.shop.storefrontName || data.shop.name}`);
    await expect(row).toContainText('Qty : 1');
    await expect(row).toContainText(`From: ${displayDate(data.start)} 00:00`);
    await expect(row).toContainText(`To: ${displayDate(data.end)} 23:59`);
    await expect(row).toContainText('$45.00');
  }
  await amount(page, 'Cart Total', data.order.rental);
  await amount(page, 'Security Amount', data.order.security);
  await amount(page, 'Shipping Price', data.order.delivery);
  await amount(page, 'Taxes', data.order.tax);
  await amount(page, 'Order Total Amount', data.order.total);
  const transaction = (await page.locator('main').innerText()).match(/W-\d+/)?.[0];
  expect(transaction).toBeTruthy();
  if (data.order.walletTransaction) expect(transaction).toBe(data.order.walletTransaction);
  data.order.walletTransaction = transaction;
  if (verifyPaymentBalance) {
    await page.goto('/en/account/credits');
    await expect(page.locator('.credit-balance-start .text-balance')).toHaveText('$336.50');
    data.wallet.balanceAfterPayment = '336.50';
  }
  await page.goto('/en/buyer/rental-orders');
  data.lines = data.lines || {};
  for (const source of ['admin', 'seller']) {
    const row = page.locator('tr').filter({ has: page.getByText(data.inventory[source].title, { exact: true }) });
    await expect(row).toHaveCount(1);
    const link = row.getByRole('link', { name: new RegExp(`^${data.order.id}-S\\d+$`) });
    await expect(link).toHaveCount(1);
    const href = await link.getAttribute('href');
    const id = href.match(new RegExp(`/buyer/view-order/${data.order.id}/(\\d+)$`))?.[1];
    expect(id).toBeTruthy();
    if (data.lines[source]?.id) expect(id).toBe(data.lines[source].id);
    data.lines[source] = { ...data.lines[source], id, invoice: (await link.innerText()).trim() };
  }
  save('journey', data);
}
async function booking(page, data) {
  snapshotSources(data);
  if (data.order?.phase === 'paid') { await verifyOrder(page, data); return; }
  if (data.pending?.key === 'wallet-payment' && data.order?.phase === 'payment-submitted') {
    // Read-only reconciliation: never click Pay a second time. The exact saved
    // order, wallet transaction, and balance must prove the prior payment.
    await verifyOrder(page, data, true);
    data.order.phase = 'paid'; clearIntent(data); return;
  }
  noPending(data);
  if (data.order) throw new Error('An earlier checkout exists. Reconcile its exact order ID before booking again.');
  if (data.wallet?.phase !== 'verified') throw new Error('Run npm run test:buyer:credit before booking.');
  const buyer = read('buyer-account');
  await page.goto('/en/account/credits');
  await expect(page.locator('.credit-balance-start .text-balance')).toHaveText('$500.00');
  if (!data.start) Object.assign(data, futureDates());
  save('journey', data);
  await page.goto('/en/cart');
  await dismissCookies(page);
  // A fresh Buyer must not already have unrelated shopping data. A cart-add
  // intent is journaled before mutation, so uncertain adds are never repeated.
  data.cart = data.cart || {};
  if (!Object.keys(data.cart).length) {
    await expect(page.getByText('Your Shopping Bag Is Empty', { exact: true })).toBeVisible();
  } else {
    await expect(page.locator('.cart-table-row')).toHaveCount(Object.keys(data.cart).length);
    for (const source of Object.keys(data.cart)) {
      const row = page.locator('.cart-table-row').filter({ has: page.getByRole('link', { name: data.inventory[source].title, exact: true }) });
      await expect(row).toHaveCount(1);
      await expect(row.locator('.productQty-js')).toHaveValue('1');
      await expect(row).toContainText('$45.00');
    }
  }
  for (const source of ['admin', 'seller']) {
    if (data.cart[source]) continue;
    const stock = data.inventory[source];
    await page.goto('/en/');
    await dismissCookies(page);
    const search = page.locator('#frm_fat_id_frmSiteSearch_slider');
    await search.getByPlaceholder('Keyword Search', { exact: true }).fill(stock.title);
    await search.getByPlaceholder('Keyword Search', { exact: true }).press('Enter');
    await expectEnglishURL(page, '/products/search');
    const pageSize = page.locator('#pageSizeSelect');
    await expect(pageSize).toBeVisible();
    // The observed search returns broader keyword results. Use its largest
    // local page size, then require the exact retained inventory (never latest).
    const results = page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith('/products/search'));
    await pageSize.selectOption({ label: '48 Items' });
    const response = await results;
    expect(response.ok()).toBe(true);
    await response.finished();
    const product = page.getByRole('link', { name: stock.title, exact: true });
    await expect(product).toHaveCount(1);
    await product.click();
    const form = page.locator('#frmBuyProduct');
    const ids = form.locator('input[name=selprod_id]');
    await expect(ids).toHaveCount(2);
    expect(await ids.evaluateAll(es => es.map(e => e.value))).toEqual([String(stock.id), String(stock.id)]);
    const shopLink = publicLink(page, `/${data.shop.slug}`);
    await expect(shopLink).toHaveCount(1);
    const storefrontName = (await shopLink.innerText()).trim();
    expect([data.shop.name, data.shop.identifier]).toContain(storefrontName);
    if (data.shop.storefrontName) expect(storefrontName).toBe(data.shop.storefrontName);
    data.shop.storefrontName = storefrontName;
    save('journey', data);
    await page.getByText('Rent Now', { exact: true }).and(page.locator('span.title')).click();
    await expect(form.locator('input[name=radio_for_rent_sale_section][value="2"]')).toBeChecked();
    await page.locator('label[for="btn-check-2"]').click();
    await expect(page.getByRole('radio', { name: 'Day Or More', exact: true })).toBeChecked();
    await expect(form.locator('.productQty-js')).toHaveValue('1');
    expect(Number(stock.dailyPrice)).toBe(15);
    await calendarDate(page, page.locator('#rental-start-date-js'), data.start);
    await calendarDate(page, page.locator('#rental-end-date-js'), data.end);
    const breakup = await openModal(page, page.getByRole('button', { name: 'View Price Breakup', exact: true }), '#price-breakup-js');
    await expect(breakup).toContainText('$15.00');
    await expect(breakup).toContainText('$45.00');
    await expect(breakup).toContainText('3');
    await breakup.locator('[data-bs-dismiss="modal"]').click();
    await expect(breakup).toBeHidden();
    intent(data, 'cart-add', { inventoryId: stock.id });
    await form.locator('input[name=btnAddToCart]').click();
    await page.getByRole('link', { name: 'Go To Cart', exact: true }).click();
    const row = page.locator('.cart-table-row').filter({ has: page.getByRole('link', { name: stock.title, exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.productQty-js')).toHaveValue('1');
    await expect(row).toContainText('$45.00');
    data.cart[source] = { inventoryId: stock.id, quantity: 1, rental: '45.00', security: '25.00' };
    clearIntent(data);
  }
  await expect(page.locator('.cart-table-row')).toHaveCount(2);
  await amount(page, 'Rental Amount', '90.00');
  await amount(page, 'Rental Security', '50.00');
  await amount(page, 'Net Payable', '140.00');
  intent(data, 'checkout', { buyerId: buyer.id, inventories: Object.values(data.inventory).map(stock => stock.id) });
  await page.getByRole('button', { name: 'Checkout', exact: true }).click();
  await expectEnglishURL(page, '/checkout');
  await expect(page.locator('main.checkout-page-main')).toBeVisible();
  const address = page.locator('form[name=frmAddress]');
  const values = { addr_title: `QA Rental ${data.run}`, addr_name: buyer.name, addr_address1: '100 QA Rental Road', addr_city: 'New York', addr_zip: '10001', addr_phone: buyer.phone };
  // Initial checkout has an address form. A manually reconciled run may have
  // its exact saved address already; never create another address blindly.
  if (!data.address) {
    await expect(address).toBeVisible();
    for (const [name, value] of Object.entries(values)) await address.locator(`input[name=${name}]`).fill(value);
    await address.locator('select[name=addr_country_id]').selectOption({ label: 'United States' });
    await address.locator('select[name=addr_state_id]').selectOption({ label: 'New York' });
    await address.locator('input[name=btn_submit]').click();
  } else {
    const edit = page.locator('button[onclick="showAddressList()"]');
    await edit.click();
  }
  const shippingAddress = page.locator('input[name=shipping_address_id]:checked');
  await expect(shippingAddress).toHaveCount(1);
  if (data.address) await expect(shippingAddress).toHaveValue(data.address.id);
  data.address = { id: await shippingAddress.inputValue(), title: values.addr_title, name: buyer.name };
  expect(data.address.id).toMatch(/^\d+$/);
  save('journey', data);
  await expect(page.locator('main.checkout-page-main')).toContainText('100 QA Rental Road');
  await expect(page.locator('main.checkout-page-main')).toContainText(buyer.name);
  await page.locator('button[onclick^="setUpAddressSelection("]:visible').click();
  for (const source of ['admin', 'seller']) {
    const rate = page.locator(`select[name="shipping_services[${data.inventory[source].id}]"]`);
    await expect(rate).toHaveValue(String(data.shipping.rateId));
    expect((await rate.locator('option:checked').innerText()).replace(/\s/g, '')).toBe(`${data.shipping.rateName}(${data.shipping.days}Day(s)-$${data.shipping.cost})`.replace(/\s/g, ''));
  }
  await page.locator('button[onclick^="setUpShippingMethod("]:visible').click();
  const payment = page.locator('form[name=frmPaymentForm]');
  const orderId = await payment.locator('input[name=orderId]').inputValue();
  expect(orderId).toMatch(/^O\d+$/);
  data.order = { id: orderId, phase: 'draft', buyerId: data.buyerId, sellerId: data.sellerId, items: Object.values(data.inventory).map(stock => stock.id), rental: '90.00', security: '50.00', tax: '4.50', delivery: '19.00', total: '163.50' };
  save('journey', data);
  // Do not pay a changed price: this smoke's controlled fixtures must produce
  // these verified rates. Report changes rather than altering global settings.
  await amount(page, 'Rental Amount', '90.00');
  await amount(page, 'Rental Security', '50.00');
  await amount(page, 'Net Payable', '163.50');
  expect(9000 + 5000 + 450 + 1900).toBe(16350);
  await page.locator('label.wallet').click();
  await expect(page.locator('#pay_from_wallet')).toBeChecked();
  const wallet = page.locator('form[name=frmWalletPayment]');
  await expect(wallet.locator('input[name=order_id]')).toHaveValue(orderId);
  data.order.phase = 'payment-submitted';
  intent(data, 'wallet-payment', { orderId, total: '163.50' });
  await wallet.getByRole('button', { name: 'Pay $163.50', exact: true }).click();
  await expectEnglishURL(page, `/custom/payment-success/${orderId}`);
  await expect(page.getByText(`Your Order #${orderId} Has Been Placed!`, { exact: true })).toBeVisible();
  await verifyOrder(page, data, true);
  data.order.phase = 'paid'; clearIntent(data);
}
module.exports = { booking, verifyOrder, calendarDate, money, amount };
