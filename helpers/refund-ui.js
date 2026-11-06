const { branchData } = require('./smoke-branch-data');
const { lineIdentity, activeStatus } = require('./rental-orders-ui');
const { dismissCookies } = require('./rental-data');
const { money } = require('./rental-booking-ui');
const { publicPath, expectEnglishURL, expectPublicHref } = require('./public-routes');
const { expect, read, save, intent, clearIntent, noPending, dollars, tableCell, searchRequests, confirmSubmit, wallet, ledger, withBuyer, ownRow } = require('./lifecycle-ui');

async function refundView(page, data, source, role) {
  const request = data.lifecycle.requests[source];
  if (!request?.requestId) throw new Error('The exact saved Refund Request ID is required before processing.');
  const route = role === 'buyer' ? `/en/buyer/view-order-return-request/${request.requestId}/0/2`
    : `/en/seller/view-order-return-request/${request.requestId}/2`;
  await page.goto(route);
  await dismissCookies(page);
  await expect(page.locator('form[name=frmOrderReturnRequestMsgsSrch] input[name=orrequest_id]')).toHaveValue(request.requestId);
  const item = ownRow(page, request.invoice, false);
  await expect(item).toHaveCount(1);
  await expect(item).toContainText(data.inventory[source].title);
  expect((await (await tableCell(item, 'Return Qty')).innerText()).trim()).toBe('1');
  expect((await (await tableCell(item, 'Request Type')).innerText()).trim()).toBe('Refund');
  const details = page.locator('tr').filter({ has: page.getByText(request.reason, { exact: true }) });
  await expect(details).toHaveCount(1);
  await expect(page.getByText(request.comment, { exact: true })).toBeVisible();
  const buyer = read('buyer-account');
  await expect(page.locator('main')).toContainText(role === 'seller' ? `Customer Name: ${buyer.name}` : `Vendor Name: ${data.sellerName}`);
  const status = (await (await tableCell(details, 'Status')).innerText()).trim();
  expect(['Pending', 'Refunded']).toContain(status);
  return { details, status };
}
async function buyerRefundRecord(page, data, source) {
  const request = data.lifecycle.requests[source];
  await page.goto('/en/buyer/rental-order-return-requests');
  const row = ownRow(page, request.invoice, false);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(data.inventory[source].title);
  expect((await (await tableCell(row, 'Return Qty')).innerText()).trim()).toBe('1');
  const href = await row.getByTitle('View Return Order Request', { exact: true }).getAttribute('href');
  const id = publicPath(href).match(/^\/buyer\/view-order-return-request\/([1-9]\d*)\/0\/2$/)?.[1];
  expect(id).toBeTruthy();
  if (request.requestId) expect(id).toBe(request.requestId);
  request.requestId = id;
  request.displayId = (await (await tableCell(row, 'ID/Order Date')).innerText()).trim().split('\n')[0];
  const result = await refundView(page, data, source, 'buyer');
  request.status = result.status;
  save('journey', data);
  return result;
}
async function requestRefund(page, source) {
  const data = branchData('refund');
  const line = data.lines[source];
  if (data.lifecycle.requests[source]) {
    await buyerRefundRecord(page, data, source);
    if (data.pending?.key === `refund-request:${line.id}`) clearIntent(data);
    return;
  }
  noPending(data);
  await lineIdentity(page, data, source, 'buyer');
  await expect(activeStatus(page)).toHaveText('Delivered');
  await expect(page.locator('.timeline li.enable .order-status').filter({ hasText: /^Ready for Rental Return - Buyer$/ })).toHaveCount(0);
  const link = page.getByRole('link', { name: 'Refunds', exact: true });
  await expectPublicHref(link, `/buyer/order-return-request/${line.id}`);
  await link.click();
  await page.waitForLoadState('load');
  await dismissCookies(page);
  const form = page.locator('form[name=frmOrderReturnRequest]');
  await expect(form.locator('input[name=op_id]')).toHaveValue(line.id);
  await expect(form.locator('input[name=orrequest_type]')).toHaveValue('2');
  const quantity = form.locator('input[name=orrequest_qty]');
  if (await quantity.isEditable()) await quantity.fill('1');
  await expect(quantity).toHaveValue('1');
  const request = { lineId: line.id, invoice: line.invoice, inventoryId: data.inventory[source].id,
    quantity: 1, reason: 'Not happy with the product', comment: `QA refund ${data.run} ${source}`,
    phase: 'request-submitted', fulfillmentAtRequest: 'Delivered' };
  await form.locator('select[name=orrequest_returnreason_id]').selectOption({ label: request.reason });
  await form.locator('textarea[name=orrmsg_msg]').fill(request.comment);
  await dismissCookies(page);
  data.lifecycle.requests[source] = request;
  intent(data, `refund-request:${line.id}`, { orderId: data.order.id, lineId: line.id });
  await form.locator('input[name=btn_submit]').click();
  await expectEnglishURL(page, '/buyer/rental-orders');
  await buyerRefundRecord(page, data, source);
  expect(request.status).toBe('Pending');
  await refundView(page, data, source, 'buyer');
  request.phase = 'pending'; clearIntent(data);
}
async function refundCredits(page, request) {
  // The observed full-quantity Seller action posts one credit including security.
  // Require the exact application-generated comment, not concatenated row text.
  const entry = await ledger(page, `Return Request Approved For Order #${request.invoice}`, Math.round(Number(request.quote.total) * 100));
  if (request.walletBefore) expect(Math.round(Number(entry.balance) * 100)).toBe(Math.round(Number(request.walletBefore) * 100) + Math.round(Number(request.quote.total) * 100));
  if (request.refundTransactions) expect(request.refundTransactions).toEqual([entry.transactionId]);
  request.refundTransactions = [entry.transactionId];
  request.refundAmount = entry.amount; request.walletAfter = entry.balance;
}

async function processRefund(page, browser, baseURL, source) {
  const data = branchData('refund');
  const request = data.lifecycle.requests[source];
  if (!request?.requestId) throw new Error('Submit the exact delivered line\'s Refund Request first.');
  await page.goto('/en/seller/rental-order-return-requests');
  await dismissCookies(page);
  await searchRequests(page, page.locator('form[name=frmOrderReturnRequest]'), 'keyword', request.invoice);
  const row = ownRow(page, request.invoice, false);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(data.inventory[source].title);
  const href = await row.getByTitle('View Return Order Request', { exact: true }).getAttribute('href');
  expect(publicPath(href)).toBe(`/seller/view-order-return-request/${request.requestId}/2`);
  const { details, status } = await refundView(page, data, source, 'seller');
  const values = {};
  for (const [key, label] of Object.entries({ rental: 'Product Price', security: 'Security Amount', tax: 'Tax', shipping: 'Shipping', total: 'Total Amount' })) {
    values[key] = dollars(money(await (await tableCell(details, label)).innerText()));
  }
  expect(['rental', 'security', 'tax', 'shipping'].reduce((sum, key) => sum + Math.round(Number(values[key]) * 100), 0)).toBe(Math.round(Number(values.total) * 100));
  if (request.quote) expect(values).toEqual(request.quote);
  request.quote = values; request.paidAmount = values.total; save('journey', data);
  if (status === 'Refunded') {
    if (request.approvedBy !== 'Seller' && request.approvalRole !== 'Seller') {
      throw new Error('Refund is already approved, but this run has no Seller approval receipt/intent. Reconcile the approver; do not attribute an external approval to Seller.');
    }
    await expect(page.getByRole('link', { name: 'Approve Refund', exact: true })).toHaveCount(0);
    await withBuyer(browser, baseURL, async buyer => { await wallet(buyer, data); await refundCredits(buyer, request); });
    request.phase = 'refunded'; request.status = 'Refunded'; request.approvedBy = 'Seller';
    if (data.pending?.key === `refund-approval:${request.requestId}`) clearIntent(data);
    save('journey', data); return;
  }
  noPending(data);
  const before = await withBuyer(browser, baseURL, buyer => wallet(buyer, data));
  request.walletBefore = dollars(before);
  const approve = page.getByRole('link', { name: 'Approve Refund', exact: true });
  await expectPublicHref(approve, `/seller/approve-order-return-request/${request.requestId}`);
  request.phase = 'approval-submitted';
  request.approvalRole = 'Seller';
  intent(data, `refund-approval:${request.requestId}`, { requestId: request.requestId, orderId: data.order.id, walletBefore: request.walletBefore, quotedRefund: values.total });
  await confirmSubmit(page, approve, 'Do you want to proceed?');
  // The approval redirects to a route without the rental-type suffix. Reopen
  // the exact verified rental view to verify persistence rather than approving again.
  const persisted = await refundView(page, data, source, 'seller');
  expect(persisted.status).toBe('Refunded');
  await expect(page.getByRole('link', { name: 'Approve Refund', exact: true })).toHaveCount(0);
  await withBuyer(browser, baseURL, async buyer => {
    expect(await wallet(buyer, data)).toBe(before + Math.round(Number(values.total) * 100));
    await refundCredits(buyer, request);
  });
  request.phase = 'refunded'; request.status = 'Refunded'; request.approvedBy = 'Seller'; clearIntent(data);
}
async function reconcileRefund(page) {
  const data = branchData('refund');
  const current = await wallet(page, data);
  let expected = Math.round(Number(data.wallet.balanceAfterPayment) * 100);
  for (const source of ['admin', 'seller']) {
    const request = data.lifecycle.requests[source];
    expect(request?.phase).toBe('refunded'); expect(request.approvedBy).toBe('Seller');
    await refundCredits(page, request);
    expected += Math.round(Number(request.refundAmount) * 100);
  }
  expect(current).toBe(expected);
  for (const source of ['admin', 'seller']) {
    const result = await buyerRefundRecord(page, data, source);
    expect(result.status).toBe('Refunded');
  }
  data.lifecycle.walletAfter = dollars(current); data.lifecycle.status = 'Refunded by Seller'; save('journey', data);
}
module.exports = { refundView, requestRefund, processRefund, reconcileRefund };
