const { test, expect } = require('@playwright/test');
const { readData, saveSeller, attachRecords } = require('../../helpers/workflow-data');

test('admin verifies or approves the newly registered seller request', async ({ page }, testInfo) => {
  const account = readData('seller-account');
  expect(account.origin).toBe(testInfo.project.use.baseURL);
  expect(account.registrationComplete).toBe(true);
  await page.goto('/admin/users/seller-approval-requests', { waitUntil: 'domcontentloaded' });
  const form = page.locator('#frmSupplierReqSrch');
  // Search by the nonsecret display name; never include login details in assertion output.
  await form.locator('input[name="keyword"]').fill(account.name);
  await form.locator('select[name="status"]').selectOption('-1');
  const result = page.waitForResponse(r => new URL(r.url()).pathname === '/admin/users/seller-approval-request-search');
  await form.locator('input[name="btn_submit"]').click();
  await (await result).finished();
  const row = page.locator('main table tbody tr').filter({ has: page.getByText(account.name, { exact: true }) });
  await expect(page.locator('main')).toContainText(new RegExp(`${account.name}|No Record Found`));
  if (await row.count() === 0) {
    await expect(page.getByText('No Record Found', { exact: true })).toBeVisible();
    account.requestAbsent = true;
    account.approvalStatus = 'No request listed; seller access must be verified by seller-setup';
  } else {
    await expect(row).toHaveCount(1);
    const userLink = row.locator('a[onclick^="redirectfunc("]');
    const id = (await userLink.getAttribute('onclick')).match(/,\s*([1-9]\d*)\)$/)?.[1];
    expect(id).toMatch(/^[1-9]\d*$/);
    account.id = id;
    account.requestReference = (await row.locator('td').nth(1).innerText()).trim();
    const status = row.locator('td').nth(5);
    if ((await status.innerText()).trim() === 'Pending') {
      page.once('dialog', dialog => dialog.accept());
      await row.getByTitle('Approve Request', { exact: true }).click();
    }
    await expect(status).toHaveText('Approved');
    account.approvalStatus = 'Approved';
  }
  saveSeller(account);
  await attachRecords(testInfo, { seller: { name: account.name, id: account.id, requestReference: account.requestReference, approvalStatus: account.approvalStatus } });
});
