const { test, expect } = require('@playwright/test');
const { readData, saveSeller, attachRecords } = require('../../helpers/workflow-data');
const { retainInventory } = require('../../helpers/inventory-ui');

for (const source of ['admin', 'seller']) {
  test(`seller can retain sale and rental inventory for the ${source} catalog product`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);
    const account = readData('seller-account');
    const admin = readData('admin-workflow');
    expect(account.origin).toBe(testInfo.project.use.baseURL);
    expect(admin.origin).toBe(testInfo.project.use.baseURL);
    expect(admin.complete).toBe(true);
    expect(account.product.approvalStatus).toBe('Approved');
    account.inventories = account.inventories || {};
    try {
      await retainInventory(page, {
        account, source, catalog: source === 'admin' ? admin.product : account.product,
        option: admin.option, previous: account.inventories[source],
        update: record => { account.inventories[source] = record; saveSeller(account); },
      });
    } finally {
      saveSeller(account);
      await attachRecords(testInfo, { seller: { name: account.name, id: account.id }, source, inventory: account.inventories[source] });
    }
  });
}
