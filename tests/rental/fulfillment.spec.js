const { test } = require('./fixture');
const { requireOrder } = require('../../helpers/rental-data');
const { fulfill } = require('../../helpers/rental-orders-ui');
for (const source of ['admin', 'seller']) {
  test('fulfillment: exact ' + source + ' inventory suborder', async ({ page }) => {
    test.setTimeout(120000);
    await fulfill(page, requireOrder(), source);
  });
}
