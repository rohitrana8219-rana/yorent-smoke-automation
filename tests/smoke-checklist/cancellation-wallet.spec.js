const { test } = require('../rental/fixture');
const { reconcileCancellation } = require('../../helpers/cancellation-ui');
test('SC-CAN-04 Buyer reconciles both cancellations and unique refund ledger entries', async ({ page }) => {
  test.setTimeout(90000);
  await reconcileCancellation(page);
});
