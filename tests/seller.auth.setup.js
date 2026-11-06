const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const SellerLoginPage = require('../pages/SellerLoginPage');
const { expectEnglishURL, publicLink } = require('../helpers/public-routes');
const { authDir, readData, saveSeller } = require('../helpers/workflow-data');

test('authenticate the new seller and save separate browser state', async ({ page }, testInfo) => {
  const stateFile = path.join(authDir, 'seller.json');
  fs.rmSync(stateFile, { force: true });
  const account = readData('seller-account');
  expect(account.origin).toBe(testInfo.project.use.baseURL);
  if (!account.registrationComplete || !account.username || !account.password) {
    throw new Error('A completed seller registration is required before seller authentication.');
  }
  const login = new SellerLoginPage(page);
  await login.goto();
  await login.login(account.username, account.password);
  await expectEnglishURL(page, '/seller');
  await expect(publicLink(page, '/seller/shop').first()).toBeAttached();
  await page.context().storageState({ path: stateFile });
  account.accessVerified = true;
  saveSeller(account);
});
