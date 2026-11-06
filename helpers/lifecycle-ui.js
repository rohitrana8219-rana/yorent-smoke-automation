const { expect } = require('@playwright/test');
const { file, read, save, intent, clearIntent, noPending } = require('./rental-data');
const { money } = require('./rental-booking-ui');
const { openModal } = require('./modal-ui');

function dollars(cents) { return (cents / 100).toFixed(2); }
function displayedMoney(text) { return [...text.matchAll(/\$\s*[\d,]+(?:\.\d{2})/g)].map(match => money(match[0])); }
async function tableCell(row, label) {
  const table = row.locator('xpath=ancestor::table');
  const labels = (await table.locator('thead th').allTextContents()).map(text => text.trim().replace(/\s+/g, ' '));
  const index = labels.indexOf(label);
  expect(index, `Missing table column: ${label}`).toBeGreaterThanOrEqual(0);
  return row.locator('td').nth(index);
}
async function searchRequests(page, form, field, invoice) {
  await form.locator(`input[name="${field}"]`).fill(invoice);
  const loaded = page.waitForResponse(response => response.request().method() === 'POST'
    && /cancellation|return-request/i.test(new URL(response.url()).pathname)
    && /search/i.test(new URL(response.url()).pathname));
  await form.locator('input[name=btn_submit]:visible').click();
  const response = await loaded;
  expect(response.ok()).toBe(true);
  await response.finished();
}
async function confirmSubmit(page, button, expectedMessage) {
  const confirmation = page.waitForEvent('dialog');
  const submitted = button.click();
  const dialog = await confirmation;
  if (dialog.type() !== 'confirm' || dialog.message() !== expectedMessage) {
    await dialog.dismiss();
    await submitted;
    throw new Error('Unexpected money-transfer confirmation. Submission was not accepted.');
  }
  await dialog.accept();
  await submitted;
}
async function wallet(page, data) {
  await page.goto('/en/account/credits');
  // The unique original credit also proves this is the same Buyer's wallet.
  const original = page.locator('tr').filter({ has: page.getByText(data.wallet.description, { exact: true }) });
  await expect(original).toHaveCount(1);
  await expect(original).toContainText(data.wallet.transactionId);
  return money(await page.locator('.credit-balance-start .text-balance').innerText());
}
async function ledger(page, description, expectedCredit) {
  const row = page.locator('tr').filter({ has: page.getByText(description, { exact: true }) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Transaction Completed');
  expect(money(await (await tableCell(row, 'Credit')).innerText())).toBe(expectedCredit);
  expect(money(await (await tableCell(row, 'Debit')).innerText())).toBe(0);
  const transactionId = (await row.innerText()).match(/TN-\d+/)?.[0];
  expect(transactionId).toBeTruthy();
  return { transactionId, amount: dollars(expectedCredit), balance: dollars(money(await (await tableCell(row, 'Balance')).innerText())) };
}
async function withBuyer(browser, baseURL, action) {
  const context = await browser.newContext({ baseURL, storageState: file('buyer') });
  context.setDefaultTimeout(15000);
  try { return await action(await context.newPage()); } finally { await context.close(); }
}
function ownRow(page, invoice, linked = true) {
  return linked ? page.locator('tr').filter({ has: page.getByRole('link', { name: invoice, exact: true }) })
    : page.locator('tbody tr').filter({ hasText: invoice });
}
function idFromText(text) {
  const match = text.trim().match(/^(?:#C)?0*([1-9]\d*)$/);
  if (!match) throw new Error('Expected an exact cancellation request ID.');
  return match[1];
}
module.exports = { expect, read, save, intent, clearIntent, noPending, dollars, displayedMoney, tableCell, searchRequests, openModal, confirmSubmit, wallet, ledger, withBuyer, ownRow, idFromText };
