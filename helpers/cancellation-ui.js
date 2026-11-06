const { branchData } = require('./smoke-branch-data');
const { lineIdentity, activeStatus } = require('./rental-orders-ui');
const { money } = require('./rental-booking-ui');
const { dismissCookies } = require('./rental-data');
const { expectEnglishURL, publicLink, expectPublicHref } = require('./public-routes');
const { expect, read, save, intent, clearIntent, noPending, dollars, displayedMoney, tableCell, searchRequests, openModal, confirmSubmit, wallet, ledger, withBuyer, ownRow, idFromText } = require('./lifecycle-ui');

const buyerRoute = '/en/buyer/rental-order-cancellation-requests';
async function buyerRecord(page, data, source) {
  await page.goto(buyerRoute);
  const line = data.lines[source];
  const row = ownRow(page, line.invoice);
  await expect(row).toHaveCount(1);
  const request = data.lifecycle.requests[source];
  await expect(row).toContainText(request.reason);
  await expect(row).toContainText(request.comment);
  const requestId = idFromText(await (await tableCell(row, 'ID')).innerText());
  if (request.requestId) expect(requestId).toBe(String(Number(request.requestId)));
  request.requestId = requestId;
  const amounts = displayedMoney(await (await tableCell(row, 'Amount')).innerText());
  expect(amounts).toHaveLength(2);
  request.paidAmount = dollars(amounts[0]);
  request.quotedExSecurity = dollars(amounts[1]);
  request.security = dollars(money(await (await tableCell(row, 'Security Amount (per Qty)')).innerText()));
  expect((await (await tableCell(row, 'Purchased Quantity')).innerText()).trim()).toBe('1');
  request.status = (await (await tableCell(row, 'Status')).innerText()).trim();
  expect(['Pending', 'Approved']).toContain(request.status);
  save('journey', data);
  return row;
}
async function requestCancellation(page, source) {
  const data = branchData('cancel');
  const line = data.lines[source];
  let request = data.lifecycle.requests[source];
  if (request) {
    await buyerRecord(page, data, source);
    if (data.pending?.key === `cancel-request:${line.id}`) clearIntent(data);
    return;
  }
  noPending(data);
  await lineIdentity(page, data, source, 'buyer');
  await expect(activeStatus(page)).toHaveText('Payment Confirmed');
  const link = publicLink(page, `/buyer/order-cancellation-request/${line.id}`);
  await expect(link).toHaveCount(1);
  await link.click();
  await page.waitForLoadState('load');
  await dismissCookies(page);
  const form = page.locator('form[name=frmOrderCancel]');
  await expect(form.locator('input[name=op_id]')).toHaveValue(line.id);
  request = { lineId: line.id, invoice: line.invoice, inventoryId: data.inventory[source].id,
    reason: 'I ordered the wrong product(s)', comment: `QA cancel ${data.run} ${source}`, phase: 'request-submitted' };
  await form.locator('select[name=ocrequest_ocreason_id]').selectOption({ label: request.reason });
  await form.locator('textarea[name=ocrequest_message]').fill(request.comment);
  await dismissCookies(page);
  data.lifecycle.requests[source] = request;
  intent(data, `cancel-request:${line.id}`, { orderId: data.order.id, lineId: line.id });
  await form.locator('input[name=btn_submit]').click();
  await expectEnglishURL(page, buyerRoute);
  await buyerRecord(page, data, source);
  expect(request.status).toBe('Pending');
  await page.reload();
  await buyerRecord(page, data, source);
  request.phase = 'pending'; clearIntent(data);
}
async function sellerView(page, source) {
  const data = branchData('cancel');
  const request = data.lifecycle.requests[source];
  if (!request?.requestId) throw new Error('Submit the exact Buyer cancellation request first.');
  await page.goto('/en/seller/rental-order-cancellation-requests');
  await searchRequests(page, page.locator('form[name=frmOrderCancellationRequest]'), 'op_invoice_number', request.invoice);
  const row = ownRow(page, request.invoice);
  await expect(row).toHaveCount(1);
  expect(idFromText(await (await tableCell(row, 'ID')).innerText())).toBe(request.requestId);
  await expect(row).toContainText(request.reason);
  await expect(row).toContainText(request.comment);
  await expect(row).toContainText(request.status);
  // The observed rental cancellation table exposes only View Order. Seller
  // never opens a status form or submits an approval in this business branch.
  await expectPublicHref(row.getByTitle('View Order', { exact: true }), `/seller-orders/view-order/${request.lineId}`);
  await expect(row.locator('a,button')).toHaveCount(1);
  request.sellerViewVerified = true; save('journey', data);
}
async function adminRow(page, data, source) {
  const request = data.lifecycle.requests[source];
  await page.goto('/admin/order-cancellation-requests/rental');
  await searchRequests(page, page.locator('form[name=frmRequestSearch]'), 'keyword', request.invoice);
  const row = ownRow(page, request.invoice, false);
  await expect(row).toHaveCount(1);
  expect(idFromText(await (await tableCell(row, 'ID')).innerText())).toBe(request.requestId);
  const buyer = read('buyer-account');
  await expect(row.getByRole('link', { name: buyer.name, exact: true })).toHaveAttribute('onclick', `redirectfunc("/admin/users", ${data.buyerId})`);
  await expect(row.getByRole('link', { name: data.sellerName, exact: true })).toHaveAttribute('onclick', `redirectfunc("/admin/users", ${data.sellerId})`);
  return row;
}
async function verifyCancellationCredit(page, request) {
  const refund = await ledger(page, `Cancel Request Approved For Order #${request.invoice}`, Math.round(Number(request.quote.exSecurity) * 100));
  const security = await ledger(page, `Refunded Security Amount #${request.invoice}`, Math.round(Number(request.quote.security) * 100));
  expect(Math.round(Number(security.balance) * 100)).toBe(Math.round(Number(refund.balance) * 100) + Math.round(Number(security.amount) * 100));
  if (request.walletBefore) expect(Math.round(Number(security.balance) * 100)).toBe(Math.round(Number(request.walletBefore) * 100) + Math.round(Number(request.quote.total) * 100));
  request.refundTransactions = [refund.transactionId, security.transactionId];
  request.refundAmount = request.quote.total;
  request.walletAfter = security.balance;
}
async function approveCancellation(page, browser, baseURL, source) {
  const data = branchData('cancel');
  const request = data.lifecycle.requests[source];
  if (!request?.sellerViewVerified) throw new Error('Seller must verify the exact cancellation request, view only, before Admin approval.');
  let row = await adminRow(page, data, source);
  const status = (await (await tableCell(row, 'Status')).innerText()).trim();
  expect(['Pending', 'Approved']).toContain(status);
  const modal = await openModal(page, row.getByTitle('View', { exact: true }));
  await expect(modal).toContainText(request.invoice);
  await expect(modal).toContainText(request.reason);
  await expect(modal).toContainText(request.comment);
  const text = await modal.innerText();
  const exSecurity = text.match(/Refundable Amount\(after Penalty Is\)[\s\S]*?\$([\d,.]+)/)?.[1];
  const security = text.match(/Security \(per Qty\):\s*\$([\d,.]+)/)?.[1];
  const addon = text.match(/Addon Refundable Amount After Penalty:\s*\$([\d,.]+)/)?.[1];
  expect(exSecurity).toBeTruthy(); expect(security).toBeTruthy(); expect(addon).toBeTruthy();
  // This controlled order has no addons; use the application's quoted amounts,
  // not a hardcoded refund percentage or a recalculated tax policy.
  expect(Number(addon)).toBe(0);
  const total = money(`$${exSecurity}`) + money(`$${security}`);
  expect(total).toBeGreaterThan(0); expect(total).toBeLessThanOrEqual(money(`$${request.paidAmount}`));
  const quote = { exSecurity: dollars(money(`$${exSecurity}`)), security: dollars(money(`$${security}`)), total: dollars(total) };
  if (request.quote) expect(quote).toEqual(request.quote);
  request.quote = quote; save('journey', data);
  await modal.locator('.btn-close').click();
  await expect(modal).toBeHidden();
  if (status === 'Approved') {
    await withBuyer(browser, baseURL, async buyer => { await wallet(buyer, data); await verifyCancellationCredit(buyer, request); });
    request.status = 'Approved'; request.phase = 'approved';
    if (data.pending?.key === `cancel-approval:${request.requestId}`) clearIntent(data);
    save('journey', data); return;
  }
  noPending(data);
  const before = await withBuyer(browser, baseURL, buyer => wallet(buyer, data));
  request.walletBefore = dollars(before);
  const edit = await openModal(page, row.getByTitle('Edit', { exact: true }));
  const form = edit.locator('form[name=frmUpdateStatus]');
  await expect(form.locator('input[name=ocrequest_id]')).toHaveValue(request.requestId);
  await form.locator('select[name=ocrequest_status]').selectOption({ label: 'Approved' });
  await expect(form.locator('input[name=ocrequest_refund_in_wallet]')).toHaveValue('1');
  request.phase = 'approval-submitted';
  intent(data, `cancel-approval:${request.requestId}`, { orderId: data.order.id, requestId: request.requestId, quotedRefund: quote.total, walletBefore: request.walletBefore });
  await confirmSubmit(page, edit.getByRole('button', { name: 'Save', exact: true }), 'Confirm Transfer ?');
  await expect(row).toContainText('Approved');
  row = await adminRow(page, data, source);
  await expect(row).toContainText('Approved'); await expect(row).toContainText('Cancelled');
  await withBuyer(browser, baseURL, async buyer => {
    expect(await wallet(buyer, data)).toBe(before + total);
    await verifyCancellationCredit(buyer, request);
  });
  request.status = 'Approved'; request.phase = 'approved'; data.lines[source].status = 'Cancelled'; clearIntent(data);
}
async function reconcileCancellation(page) {
  const data = branchData('cancel');
  const current = await wallet(page, data);
  let expected = Math.round(Number(data.wallet.balanceAfterPayment) * 100);
  for (const source of ['admin', 'seller']) {
    const request = data.lifecycle.requests[source];
    expect(request?.phase).toBe('approved');
    await verifyCancellationCredit(page, request);
    expected += Math.round(Number(request.refundAmount) * 100);
  }
  expect(current).toBe(expected);
  for (const source of ['admin', 'seller']) {
    await buyerRecord(page, data, source);
    expect(data.lifecycle.requests[source].status).toBe('Approved');
    await lineIdentity(page, data, source, 'buyer');
    // Terminal cancellation has a single status log, without the normal
    // fulfillment timeline's enable/currently classes.
    await expect(page.locator('.order-status')).toHaveCount(1);
    await expect(page.locator('.order-status')).toHaveText('Cancelled');
  }
  data.lifecycle.walletAfter = dollars(current); data.lifecycle.status = 'Cancelled / Approved'; save('journey', data);
}
module.exports = { requestCancellation, sellerView, approveCancellation, reconcileCancellation };
