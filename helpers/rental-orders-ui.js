const { expect } = require('@playwright/test');
const { read, save, intent, clearIntent, noPending, dismissCookies } = require('./rental-data');

const statusOrder = ['Payment Confirmed', 'In Process', 'Shipped', 'Delivered', 'Ready for Rental Return - Buyer', 'Rental Returned', 'Completed'];
function activeStatus(page) { return page.locator('.timeline li.enable.currently .order-status'); }
async function lineIdentity(page, data, source, role) {
  const line = data.lines?.[source];
  if (!line || !/^\d+$/.test(line.id)) throw new Error('Missing exact rental suborder ID; verify Buyer booking first.');
  await page.goto(role === 'seller' ? `/en/seller/view-order/${line.id}` : `/en/buyer/view-order/${data.order.id}/${line.id}`);
  await dismissCookies(page);
  await expect(page.getByText(line.invoice, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: data.inventory[source].title, exact: true })).toBeVisible();
  const buyer = read('buyer-account');
  await expect(page.getByText(buyer.name, { exact: true }).and(page.locator(role === 'seller' ? 'span.value' : 'p:visible'))).toBeVisible();
  return line;
}
async function persistedStatus(page, status) {
  await expect(activeStatus(page)).toHaveText(status);
  await page.reload();
  await expect(activeStatus(page)).toHaveText(status);
}
async function transition(page, data, source, target, fill) {
  const current = (await activeStatus(page).innerText()).trim();
  const from = statusOrder.indexOf(current);
  const to = statusOrder.indexOf(target);
  if (from < 0 || to < 0) throw new Error('Unexpected rental status; inspect the exact suborder before changing it.');
  if (from >= to) {
    data.lines[source].status = current;
    // A previously submitted transition is safe to reconcile only when its
    // exact saved status is visible on this exact order.
    if (data.pending?.key === `status:${data.lines[source].id}:${target}`) clearIntent(data);
    save('journey', data);
    return;
  }
  if (from !== to - 1) throw new Error(`Expected ${statusOrder[to - 1]} before ${target}; run the preceding rental stage.`);
  noPending(data);
  const form = page.locator('form[name=frmOrderComments]');
  await expect(form.locator('input[name=op_id]')).toHaveValue(data.lines[source].id);
  await form.locator('select[name=op_status_id]').selectOption({ label: target });
  const notify = form.locator('select[name=customer_notified]');
  if (await notify.isVisible()) await notify.selectOption({ label: 'No' });
  await fill(form);
  await form.locator('textarea[name=comments]').fill(`QA ${data.run} ${source} ${target}`);
  intent(data, `status:${data.lines[source].id}:${target}`, { orderId: data.order.id, lineId: data.lines[source].id, target });
  await form.locator('input[name=btn_submit]').click();
  await persistedStatus(page, target);
  data.lines[source].status = target;
  clearIntent(data);
}
async function fulfill(page, data, source) {
  await lineIdentity(page, data, source, 'seller');
  const stock = data.inventory[source];
  const scan = stock.scanCodes[0];
  data.lines[source].scan = scan;
  save('journey', data);
  for (const target of ['In Process', 'Shipped', 'Delivered']) {
    await transition(page, data, source, target, async form => {
      if (target !== 'Shipped') return;
      await form.locator('input[name=tracking_number]').fill(`QA${data.run}${source === 'admin' ? 'A' : 'S'}`);
      await form.locator('input[name=opship_tracking_url]').fill(`https://example.com/qa-tracking/${data.run}/${source}`);
      await form.locator('select[name="op_shipped_scanned_code[]"]').selectOption(scan);
    });
  }
}
async function buyerReturn(page, data, source) {
  const line = await lineIdentity(page, data, source, 'buyer');
  await transition(page, data, source, 'Ready for Rental Return - Buyer', async form => {
    await form.locator('select[name=op_return_fullfillment_type]').selectOption({ label: 'Ship' });
    // This UI locks the full rental quantity; verify rather than overriding it.
    await expect(form.locator('input[name=return_qty]')).toHaveValue('1');
    await expect(form.locator('input[name=op_qty]')).toHaveValue('1');
    await form.locator('input[name=tracking_number]').fill(`QAR${data.run}${source === 'admin' ? 'A' : 'S'}`);
    await form.locator('input[name=tracking_url]').fill(`https://example.com/qa-return/${data.run}/${source}`);
    await form.locator('input[name=tracking_courier]').fill('QA UAT Courier');
  });
  line.returnReference = `QAR${data.run}${source === 'admin' ? 'A' : 'S'}`;
  save('journey', data);
}
async function receive(page, data, source) {
  await lineIdentity(page, data, source, 'seller');
  await transition(page, data, source, 'Rental Returned', async form => {
    await form.locator('input[name=return_qty]').fill('1');
    await form.locator('select[name=refund_security_type]').selectOption({ label: 'Complete' });
    expect(Number(await form.locator('input[name=refund_security_amount]').inputValue())).toBe(25);
    const date = await form.locator('input[name=opd_mark_rental_return_date]').inputValue();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    // The UI defaults the received date to now; retain it (no calendar override).
    data.lines[source].returnDate = date;
    await form.locator('select[name="op_returned_scanned_code[]"]').selectOption(data.lines[source].scan);
  });
  await expect(page.locator('.timeline')).toContainText('1 Quantities Returned');
  await expect(page.locator('.timeline')).toContainText("Seller Recommended Rental Security Refund Of $25.00");
}
async function complete(page, data, source) {
  const line = data.lines[source];
  if (!line?.id) throw new Error('Missing exact suborder ID; run Buyer booking first.');
  await page.goto('/admin/seller-orders/rental');
  const search = page.locator('form[name=frmVendorOrderSearch]');
  await search.locator('input[name=keyword]').fill(data.order.id);
  await search.locator('input[name=btn_submit]').click();
  const row = page.locator('main tr').filter({ has: page.getByRole('link', { name: line.invoice, exact: true }) });
  await expect(row).toHaveCount(1);
  const buyer = read('buyer-account');
  await expect(row.getByRole('link', { name: buyer.name, exact: true })).toHaveAttribute('onclick', `redirectfunc("/admin/users", ${data.buyerId})`);
  await expect(row.getByRole('link', { name: data.sellerName, exact: true })).toHaveAttribute('onclick', `redirectfunc("/admin/users", ${data.sellerId})`);
  // Admin's verified link opens a new tab; navigate its exact verified href in
  // this isolated context to avoid accumulating visible tabs.
  const link = row.getByRole('link', { name: line.invoice, exact: true });
  await expect(link).toHaveAttribute('href', `/admin/seller-orders/view/${line.id}`);
  await page.goto(await link.getAttribute('href'));
  await expect(page.getByText(line.invoice, { exact: true })).toBeVisible();
  // Read the invoice summary status, never a historical comment's status.
  const summary = page.locator('main dt').filter({ hasText: /^Status$/ }).locator('..').locator('dd');
  const current = (await summary.innerText()).trim();
  if (current === 'Completed') {
    line.status = 'Completed';
    if (data.pending?.key === `complete:${line.id}`) clearIntent(data);
    save('journey', data); return;
  }
  await expect(summary).toContainText('Rental Returned');
  noPending(data);
  const form = page.locator('form[name=frmOrderComments]');
  await expect(form.locator('input[name=op_id]')).toHaveValue(line.id);
  await form.locator('select[name=op_status_id]').selectOption({ label: 'Completed' });
  await form.locator('select[name=customer_notified]').selectOption({ label: 'No' });
  await form.locator('select[name=refund_security_type]').selectOption({ label: 'Complete' });
  expect(Number(await form.locator('input[name=refund_security_amount]').inputValue())).toBe(25);
  const scan = form.locator('select[name="op_returned_scanned_code[]"]');
  await expect(scan).toBeDisabled();
  expect(await scan.evaluate(e => Array.from(e.selectedOptions).map(o => o.value))).toEqual([line.scan]);
  await form.locator('textarea[name=comments]').fill(`QA ${data.run} ${source} Completed; full security refund`);
  intent(data, `complete:${line.id}`, { orderId: data.order.id, lineId: line.id });
  await form.locator('input[name=btn_submit]').click();
  await expect(form).toHaveCount(0);
  await page.reload();
  await expect(summary).toContainText('Completed');
  line.status = 'Completed'; clearIntent(data);
}
module.exports = { activeStatus, lineIdentity, fulfill, buyerReturn, receive, complete };
