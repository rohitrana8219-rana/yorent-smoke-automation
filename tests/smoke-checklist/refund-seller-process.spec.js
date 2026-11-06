const { test } = require('../rental/fixture');
const { processRefund } = require('../../helpers/refund-ui');
for (const source of ['admin', 'seller']) {
  test(`SC-REF-03 Seller approves ${source} refund and verifies the same Buyer wallet`, async ({ page, browser }, info) => {
    test.setTimeout(90000);
    await processRefund(page, browser, info.project.use.baseURL, source);
  });
}
