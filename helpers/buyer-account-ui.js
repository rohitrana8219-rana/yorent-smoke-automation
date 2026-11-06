const { expect } = require('@playwright/test');
const { randomBytes } = require('crypto');
const { expectEnglishURL } = require('./public-routes');
const { currentRun, file, fs, save, journey, read, dismissCookies, verifyIdentity, fillPrivate, noPending, intent, clearIntent } = require('./rental-data');

async function registerBuyer(page, origin) {
  const run = currentRun();
  if (fs.existsSync(file('buyer-account'))) {
    throw new Error('This run already has a Buyer registration attempt. Use a new registration run; never resubmit an uncertain account.');
  }
  const account = {
    origin: origin, suffix: run, name: `QA Buyer ${run}`,
    username: `qab${run}`, email: `qa.buyer.${run}@example.com`,
    password: `Qa${randomBytes(5).toString('hex')}7`,
    phone: `20255501${String(parseInt(run.slice(0, 2), 16) % 100).padStart(2, '0')}`,
    phase: 'registration-started',
  };
  save('buyer-account', account);
  await page.goto('/en/guest-user/login-form/1');
  await dismissCookies(page);
  const form = page.locator('form[name=frmRegister]');
  await form.locator('input[name=user_name]').fill(account.name);
  await fillPrivate(form.locator('input[name=user_username]'), account.username);
  await fillPrivate(form.locator('input[name=user_email]'), account.email);
  await fillPrivate(form.locator('input[name=user_password]'), account.password);
  await fillPrivate(form.locator('input[name=password1]'), account.password);
  await form.locator('input[name=agree]').check();
  account.phase = 'registration-submitted'; save('buyer-account', account);
  await form.locator('input[name=btn_submit]').click();
  await expectEnglishURL(page, '/buyer');
  await verifyIdentity(page, account, 'buyer');
  account.phase = 'registered'; save('buyer-account', account);
  save('journey', { origin: account.origin, run, buyerId: account.id });
  await page.context().storageState({ path: file('buyer') });
}

async function creditBuyer(page) {
  const data = journey();
  const buyer = read('buyer-account');
  expect(String(buyer.id)).toBe(data.buyerId);
  await page.goto('/admin/users');
  const search = page.locator('form[name=frmUserSearch]');
  await search.locator('input[name=keyword]').fill(buyer.name);
  await search.locator('input[name=btn_submit]').click();
  const row = page.locator('main table tbody tr').filter({ has: page.locator(`input[name="user_ids[]"][value="${buyer.id}"]`) });
  await expect(row).toHaveCount(1);
  expect((await row.innerText()).includes(buyer.name)).toBe(true);
  await expect(row.getByText('Buyer', { exact: true })).toBeVisible();
  await row.getByTitle('More', { exact: true }).click();
  await row.getByTitle('Transactions', { exact: true }).click();
  const modal = page.locator('.modal.show');
  const description = `QA rental ${data.run}`;
  const ledgerRow = modal.locator('tr').filter({ has: page.getByText(description, { exact: true }) });
  if (data.wallet?.phase !== 'verified') {
    noPending(data);
    await expect(modal.getByText('No Record Found', { exact: true })).toBeVisible();
    await modal.getByRole('link', { name: 'Add new', exact: true }).click();
    const form = modal.locator('form[name=frmUserTransaction]');
    await expect(form.locator('input[name=user_id]')).toHaveValue(String(buyer.id));
    await form.locator('select[name=type]').selectOption({ label: 'Credit' });
    await form.locator('input[name=amount]').fill('500.00');
    await form.locator('textarea[name=description]').fill(description);
    data.wallet = { amount: '500.00', description, phase: 'credit-submitted' };
    intent(data, 'wallet-credit', { buyerId: buyer.id, amount: '500.00', description });
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await modal.getByRole('link', { name: 'Transactions', exact: true }).click();
  }
  await expect(ledgerRow).toHaveCount(1);
  await expect(ledgerRow).toContainText('Transaction Completed');
  const cells = ledgerRow.locator('td');
  // Verify credited amount and resulting balance, not just the toast.
  const text = await ledgerRow.innerText();
  expect((text.match(/\$500\.00/g) || []).length).toBe(2);
  expect(text).toContain('$0.00');
  const transactionId = text.match(/TN-\d+/)?.[0];
  expect(transactionId).toBeTruthy();
  data.wallet = { ...data.wallet, amount: '500.00', description, transactionId, phase: 'verified', balanceAfter: '500.00' };
  clearIntent(data);
}

module.exports = { registerBuyer, creditBuyer };
