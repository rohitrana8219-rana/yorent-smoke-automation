const { test } = require('../rental/fixture');
const { reconcileRefund } = require('../../helpers/refund-ui');
test('SC-REF-04 Buyer reconciles both Seller refunds and unique wallet transactions', async ({ page }) => {
  test.setTimeout(90000);
  await reconcileRefund(page);
});
