const { test, expect } = require('@playwright/test');
const { randomBytes } = require('crypto');
const { saveSeller, fillPrivate, attachRecords } = require('../../helpers/workflow-data');

test('seller can register and submit business details', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const suffix = randomBytes(4).toString('hex');
  const account = {
    origin: testInfo.project.use.baseURL,
    suffix,
    name: `QA Seller ${suffix}`,
    business: `QA Shop ${suffix}`,
    username: `qas${suffix}`,
    email: `qa.seller.${suffix}@example.com`,
    // The UI requires alphanumeric passwords; symbols are rejected.
    password: `Qa${randomBytes(5).toString('hex')}7`,
    phone: `20255501${String(parseInt(suffix.slice(0, 2), 16) % 100).padStart(2, '0')}`,
    registrationComplete: false,
  };
  saveSeller(account);
  try {
    await page.goto('/supplier', { waitUntil: 'domcontentloaded' });
    const decline = page.getByRole('button', { name: 'Decline', exact: true });
    if (await decline.isVisible()) await decline.click();
    const entry = page.locator('form[name="frmSeller"]');
    await fillPrivate(entry.locator('input[name="user_email"]'), account.email);
    await entry.locator('input[name="user_name"]').fill(account.name);
    await entry.locator('input[name="btn_submit"]').click();
    const registration = page.locator('form[name="frmSellerRegistration"]');
    await registration.locator('input[name="user_name"]').fill(account.name);
    await fillPrivate(registration.locator('input[name="user_username"]'), account.username);
    await fillPrivate(registration.locator('input[name="user_email"]'), account.email);
    await fillPrivate(registration.locator('input[name="user_password"]'), account.password);
    await fillPrivate(registration.locator('input[name="password1"]'), account.password);
    await registration.locator('input[name="agree"]').check();
    await registration.locator('input[name="btn_submit"]').click();
    const business = page.locator('form[name="frmSupplierForm"]');
    await business.locator('input[name="sformfield_1"]').fill(account.business);
    await business.locator('input[name="sformfield_3"]').fill(account.phone);
    await business.locator('input[name="sformfield_2"]').fill(account.name);
    await business.locator('input[name="btn_submit"]').click();
    await expect(business).toBeHidden();
    await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    account.registrationComplete = true;
  } finally {
    saveSeller(account);
    await attachRecords(testInfo, { seller: { name: account.name, business: account.business, registrationComplete: account.registrationComplete } });
  }
});
