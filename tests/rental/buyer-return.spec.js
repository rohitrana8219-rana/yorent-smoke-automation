const { test } = require('./fixture');
const { requireOrder } = require('../../helpers/rental-data');
const { buyerReturn } = require('../../helpers/rental-orders-ui');
for (const source of ['admin', 'seller']) {
  test('buyer-return: exact ' + source + ' inventory suborder', async ({ page }) => {
    test.setTimeout(120000);
    await buyerReturn(page, requireOrder(), source);
  });
}
