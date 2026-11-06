const { test: base, expect } = require('@playwright/test');
const { fs, file, run, currentRun, selectRentalRun, attachRecords } = require('../../helpers/rental-data');
const test = base.extend({
  _rentalRun: [async ({}, use, info) => {
    const previous = currentRun();
    selectRentalRun(info.project.metadata.rentalRun || run);
    try { await use(); } finally { selectRentalRun(previous); }
  }, { auto: true }],
  page: async ({ page }, use, info) => {
    page.setDefaultTimeout(15000);
    await use(page);
    if (info.status !== info.expectedStatus && !page.isClosed()) {
      const masks = [page.locator('input,textarea'), page.locator('a[href^="mailto:"]')];
      if (/^\/admin\/(users|seller-orders\/rental)/.test(new URL(page.url()).pathname)) {
        // A failure before search finishes must not reveal unrelated accounts.
        masks.push(page.locator('table'));
      }
      for (const name of ['buyer-account', 'seller-account']) {
        if (!fs.existsSync(file(name))) continue;
        const account = JSON.parse(fs.readFileSync(file(name), 'utf8'));
        for (const value of [account.username, account.email, account.password].filter(Boolean)) {
          masks.push(page.getByText(value, { exact: false }));
        }
      }
      await info.attach('redacted-rental-failure', {
        body: await page.screenshot({ mask: masks }), contentType: 'image/png',
      });
    }
  },
});
test.afterEach(async ({}, info) => {
  if (!fs.existsSync(file('journey'))) return;
  const data = JSON.parse(fs.readFileSync(file('journey'), 'utf8'));
  await attachRecords(info, {
    run: data.run, buyerId: data.buyerId, sellerId: data.sellerId,
    wallet: data.wallet, order: data.order, lines: data.lines, pending: data.pending, lifecycle: data.lifecycle,
  });
});
module.exports = { test, expect };
