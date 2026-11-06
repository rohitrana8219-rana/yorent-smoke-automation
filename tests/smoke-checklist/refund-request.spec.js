const { test } = require('../rental/fixture');
const { requestRefund } = require('../../helpers/refund-ui');
for (const source of ['admin', 'seller']) {
  test(`SC-REF-02 Buyer submits a direct Refund Request for the ${source} line`, async ({ page }) => {
    test.setTimeout(90000);
    await requestRefund(page, source);
  });
}
